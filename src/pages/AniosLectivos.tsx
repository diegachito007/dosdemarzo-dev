import { useState, useEffect, startTransition, useCallback } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { AnioLectivo, PeriodoEvaluacion } from '../types';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaCalendarAlt, FaInfoCircle, FaClock, FaSpinner } from 'react-icons/fa';

interface PeriodoCalculado {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  orden: number;
}

export default function AniosLectivos() {
  const { user } = useAuth();
  const [anios, setAnios] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    fechaInicio: '',
    fechaFin: '',
    tipoEvaluacion: 'trimestral' as 'trimestral' | 'quimestral',
    activo: false
  });

  const [periodosEditables, setPeriodosEditables] = useState<PeriodoCalculado[]>([]);

  const calcularNombre = (fechaInicio: string, fechaFin: string): string => {
    if (!fechaInicio || !fechaFin) return '';
    
    const yearInicio = new Date(fechaInicio).getFullYear();
    const yearFin = new Date(fechaFin).getFullYear();
    
    return `${yearInicio}-${yearFin}`;
  };

  const nombreGenerado = calcularNombre(formData.fechaInicio, formData.fechaFin);

  // ✅ Calcular períodos automáticamente
  const calcularPeriodos = useCallback((fechaInicio: string, fechaFin: string, tipo: 'trimestral' | 'quimestral'): PeriodoCalculado[] => {
    if (!fechaInicio || !fechaFin) return [];

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const totalDias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    
    const numPeriodos = tipo === 'trimestral' ? 3 : 2;
    const diasPorPeriodo = Math.floor(totalDias / numPeriodos);
    
    const periodos: PeriodoCalculado[] = [];
    
    for (let i = 0; i < numPeriodos; i++) {
      const periodoInicio = new Date(inicio.getTime() + (i * diasPorPeriodo * 24 * 60 * 60 * 1000));
      const periodoFin = i === numPeriodos - 1 
        ? fin 
        : new Date(periodoInicio.getTime() + (diasPorPeriodo * 24 * 60 * 60 * 1000) - 1);
      
      const nombre = tipo === 'trimestral' 
        ? `Trimestre ${i + 1}` 
        : `Quimestre ${i + 1}`;
      
      periodos.push({
        nombre,
        fechaInicio: periodoInicio.toISOString().split('T')[0],
        fechaFin: periodoFin.toISOString().split('T')[0],
        orden: i + 1
      });
    }
    
    return periodos;
  }, []);

  // ✅ Actualizar un período específico
  const actualizarPeriodo = (index: number, campo: 'fechaInicio' | 'fechaFin', valor: string) => {
    setPeriodosEditables(prev => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  const cargarAnios = useCallback(async () => {
    try {
      const q = query(collection(db, 'aniosLectivos'), orderBy('nombre', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AnioLectivo));
      
      startTransition(() => {
        setAnios(data);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error cargando años lectivos:', error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  const cargarPeriodosExistentes = useCallback(async (anioId: string) => {
    try {
      const q = query(
        collection(db, 'periodosEvaluacion'),
        where('anioLectivoId', '==', anioId),
        orderBy('orden', 'asc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PeriodoEvaluacion));
      
      if (data.length > 0) {
        setPeriodosEditables(data.map(p => ({
          nombre: p.nombre,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          orden: p.orden
        })));
      }
    } catch (error) {
      console.error('Error cargando períodos:', error);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fechaInicio || !formData.fechaFin) {
      alert('Las fechas son obligatorias');
      return;
    }

    if (new Date(formData.fechaFin) <= new Date(formData.fechaInicio)) {
      alert('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }

    if (periodosEditables.length === 0) {
      alert('No se han generado los períodos');
      return;
    }

    for (const periodo of periodosEditables) {
      if (!periodo.fechaInicio || !periodo.fechaFin) {
        alert(`Las fechas del ${periodo.nombre} son obligatorias`);
        return;
      }
      if (new Date(periodo.fechaFin) <= new Date(periodo.fechaInicio)) {
        alert(`La fecha de fin del ${periodo.nombre} debe ser posterior a la fecha de inicio`);
        return;
      }
      if (new Date(periodo.fechaInicio) < new Date(formData.fechaInicio) || 
          new Date(periodo.fechaFin) > new Date(formData.fechaFin)) {
        alert(`Las fechas del ${periodo.nombre} deben estar dentro del rango del año lectivo`);
        return;
      }
    }

    const nombre = calcularNombre(formData.fechaInicio, formData.fechaFin);
    const hayPeriodoActivo = anios.some(a => a.activo && a.id !== editingId);

    if (hayPeriodoActivo && !editingId) {
      setShowConfirmModal(true);
      return;
    }

    await guardarAnioLectivo(nombre);
  };

  const confirmarCreacion = async () => {
    setShowConfirmModal(false);
    const nombre = calcularNombre(formData.fechaInicio, formData.fechaFin);
    await guardarAnioLectivo(nombre, true);
  };

  const cancelarCreacion = () => {
    setShowConfirmModal(false);
  };

  const guardarAnioLectivo = async (nombre: string, forzarActivo = false) => {
    setIsSaving(true);
    
    try {
      let estadoActivo: boolean;

      if (editingId) {
        estadoActivo = formData.activo;
      } else {
        estadoActivo = forzarActivo || !anios.some(a => a.activo);
      }

      if (estadoActivo) {
        const aniosActivos = anios.filter(a => a.activo && a.id !== editingId);
        for (const anio of aniosActivos) {
          await updateDoc(doc(db, 'aniosLectivos', anio.id), { activo: false });
        }
      }

      let anioId: string;

      if (editingId) {
        anioId = editingId;
        await updateDoc(doc(db, 'aniosLectivos', editingId), {
          nombre,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          tipoEvaluacion: formData.tipoEvaluacion,
          activo: estadoActivo,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, 'aniosLectivos'), {
          nombre,
          fechaInicio: formData.fechaInicio,
          fechaFin: formData.fechaFin,
          tipoEvaluacion: formData.tipoEvaluacion,
          activo: estadoActivo,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
        anioId = docRef.id;
      }

      if (editingId) {
        const periodosAnteriores = await getDocs(
          query(collection(db, 'periodosEvaluacion'), where('anioLectivoId', '==', editingId))
        );
        for (const p of periodosAnteriores.docs) {
          await deleteDoc(doc(db, 'periodosEvaluacion', p.id));
        }
      }

      for (const periodo of periodosEditables) {
        await addDoc(collection(db, 'periodosEvaluacion'), {
          nombre: periodo.nombre,
          tipo: formData.tipoEvaluacion === 'trimestral' ? 'trimestre' : 'quimestre',
          anioLectivoId: anioId,
          fechaInicio: periodo.fechaInicio,
          fechaFin: periodo.fechaFin,
          orden: periodo.orden,
          activo: true,
          createdAt: serverTimestamp()
        });
      }

      resetForm();
      await cargarAnios();
    } catch (error) {
      console.error('Error guardando año lectivo:', error);
      alert('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (anio: AnioLectivo) => {
    setFormData({
      fechaInicio: anio.fechaInicio,
      fechaFin: anio.fechaFin,
      tipoEvaluacion: anio.tipoEvaluacion || 'trimestral',
      activo: anio.activo
    });
    setEditingId(anio.id);
    setShowForm(true);
    
    cargarPeriodosExistentes(anio.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este año lectivo? Se eliminarán también los períodos asociados.')) return;

    try {
      const periodos = await getDocs(
        query(collection(db, 'periodosEvaluacion'), where('anioLectivoId', '==', id))
      );
      for (const p of periodos.docs) {
        await deleteDoc(doc(db, 'periodosEvaluacion', p.id));
      }

      await deleteDoc(doc(db, 'aniosLectivos', id));
      await cargarAnios();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  };

  const handleActivar = async (id: string) => {
    setIsSaving(true);
    try {
      const updates = anios
        .filter(a => a.activo)
        .map(a => updateDoc(doc(db, 'aniosLectivos', a.id), { activo: false }));
      
      await Promise.all(updates);
      await updateDoc(doc(db, 'aniosLectivos', id), { activo: true });
      await cargarAnios();
    } catch (error) {
      console.error('Error activando:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fechaInicio: '',
      fechaFin: '',
      tipoEvaluacion: 'trimestral',
      activo: false
    });
    setEditingId(null);
    setShowForm(false);
    setPeriodosEditables([]);
  };

  useEffect(() => {
    cargarAnios();
  }, [cargarAnios]);

  if (loading) {
    return (
      <Layout title="Años Lectivos" subtitle="Gestiona los periodos académicos del sistema" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando periodos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Años Lectivos" 
      subtitle="Gestiona los periodos académicos del sistema"
      showBack
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <FaPlus className="text-sm" />
          {showForm ? 'Cancelar' : 'Nuevo Periodo'}
        </button>
      }
    >
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3">
            <h3 className="text-white font-semibold text-base">
              {editingId ? 'Editar Periodo Académico' : 'Nuevo Periodo Académico'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5">
            {nombreGenerado && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <FaInfoCircle className="text-sm" />
                  <span className="text-sm font-medium">Periodo académico:</span>
                  <span className="text-lg font-bold text-blue-900">{nombreGenerado}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={formData.fechaInicio}
                  onChange={(e) => {
                    const nuevaFecha = e.target.value;
                    setFormData({...formData, fechaInicio: nuevaFecha});
                    if (nuevaFecha && formData.fechaFin) {
                      const nuevosPeriodos = calcularPeriodos(nuevaFecha, formData.fechaFin, formData.tipoEvaluacion);
                      setPeriodosEditables(nuevosPeriodos);
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  value={formData.fechaFin}
                  onChange={(e) => {
                    const nuevaFecha = e.target.value;
                    setFormData({...formData, fechaFin: nuevaFecha});
                    if (formData.fechaInicio && nuevaFecha) {
                      const nuevosPeriodos = calcularPeriodos(formData.fechaInicio, nuevaFecha, formData.tipoEvaluacion);
                      setPeriodosEditables(nuevosPeriodos);
                    }
                  }}
                  min={formData.fechaInicio}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Tipo de Evaluación *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({...formData, tipoEvaluacion: 'trimestral'});
                    if (formData.fechaInicio && formData.fechaFin) {
                      const nuevosPeriodos = calcularPeriodos(formData.fechaInicio, formData.fechaFin, 'trimestral');
                      setPeriodosEditables(nuevosPeriodos);
                    }
                  }}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    formData.tipoEvaluacion === 'trimestral'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="font-semibold text-slate-900 text-sm mb-1">Trimestral</div>
                  <div className="text-xs text-slate-600">3 períodos de evaluación</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({...formData, tipoEvaluacion: 'quimestral'});
                    if (formData.fechaInicio && formData.fechaFin) {
                      const nuevosPeriodos = calcularPeriodos(formData.fechaInicio, formData.fechaFin, 'quimestral');
                      setPeriodosEditables(nuevosPeriodos);
                    }
                  }}
                  className={`p-4 border-2 rounded-lg transition-all text-left ${
                    formData.tipoEvaluacion === 'quimestral'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="font-semibold text-slate-900 text-sm mb-1">Quimestral</div>
                  <div className="text-xs text-slate-600">2 períodos de evaluación</div>
                </button>
              </div>
            </div>

            {periodosEditables.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-green-800 mb-3">
                  <FaCalendarAlt className="text-sm" />
                  <span className="text-sm font-semibold">
                    Períodos de Evaluación (editables):
                  </span>
                </div>
                <div className="space-y-3">
                  {periodosEditables.map((periodo, idx) => (
                    <div key={idx} className="bg-white rounded-lg px-4 py-3 border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-green-100 text-green-700 rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {periodo.orden}
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{periodo.nombre}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Fecha Inicio</label>
                          <input
                            type="date"
                            value={periodo.fechaInicio}
                            onChange={(e) => actualizarPeriodo(idx, 'fechaInicio', e.target.value)}
                            min={formData.fechaInicio}
                            max={periodo.fechaFin || formData.fechaFin}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Fecha Fin</label>
                          <input
                            type="date"
                            value={periodo.fechaFin}
                            onChange={(e) => actualizarPeriodo(idx, 'fechaFin', e.target.value)}
                            min={periodo.fechaInicio || formData.fechaInicio}
                            max={formData.fechaFin}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-700 mt-3 flex items-center gap-1">
                  <FaInfoCircle className="text-xs" />
                  Las fechas se calcularon automáticamente. Puedes ajustarlas según necesites.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="activo"
                checked={formData.activo}
                onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="activo" className="text-sm text-slate-700">
                {editingId 
                  ? (formData.activo ? 'Mantener como activo' : 'Marcar como activo') 
                  : 'Marcar como periodo activo'}
              </label>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <FaSpinner className="text-xs animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FaCheck className="text-xs" />
                    {editingId ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTimes className="text-xs" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Periodo
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Fecha Inicio
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Fecha Fin
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">
                  Estado
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-36">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {anios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="bg-slate-100 rounded-full p-4 mb-3">
                        <FaCalendarAlt className="text-3xl text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium mb-1">No hay periodos académicos</p>
                      <p className="text-slate-500 text-sm mb-3">Crea el primer periodo académico</p>
                      <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        <FaPlus className="text-xs" />
                        Crear periodo
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                anios.map((anio) => (
                  <tr key={anio.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900 text-base">
                          {anio.nombre}
                        </div>
                        {anio.activo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                            <FaCheck className="text-[8px]" />
                            Vigente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        anio.tipoEvaluacion === 'trimestral'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {anio.tipoEvaluacion === 'trimestral' ? 'Trimestral' : 'Quimestral'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <FaClock className="text-slate-400 text-xs" />
                        {new Date(anio.fechaInicio).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <FaClock className="text-slate-400 text-xs" />
                        {new Date(anio.fechaFin).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {anio.activo ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-linear-to-r from-green-500 to-green-600 text-white shadow-sm">
                          <FaCheck className="mr-1 text-[10px]" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center gap-1">
                        {!anio.activo && (
                          <button
                            onClick={() => handleActivar(anio.id)}
                            disabled={isSaving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all disabled:opacity-50"
                            title="Activar periodo"
                          >
                            <FaCheck className="text-sm" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(anio)}
                          disabled={isSaving}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all disabled:opacity-50"
                          title="Editar"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(anio.id)}
                          disabled={isSaving}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all disabled:opacity-50"
                          title="Eliminar"
                        >
                          <FaTrash className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {anios.length > 0 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total: <strong>{anios.length}</strong> periodo{anios.length !== 1 ? 's' : ''}</span>
              <span>{anios.filter(a => a.activo).length} activo{anios.filter(a => a.activo).length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Crear Nuevo Periodo Académico"
        message={`Ya existe un periodo académico activo. Si creas este nuevo periodo (${nombreGenerado}), se convertirá en el vigente y el periodo actual se inactivará automáticamente. Todo el sistema trabajará con el nuevo periodo. ¿Deseas continuar?`}
        onConfirm={confirmarCreacion}
        onCancel={cancelarCreacion}
        confirmText="Sí, crear nuevo periodo"
        cancelText="Cancelar"
        type="warning"
      />
    </Layout>
  );
}