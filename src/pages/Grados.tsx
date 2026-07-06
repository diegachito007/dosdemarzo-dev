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
import type { Grado, AnioLectivo } from '../types';
import Layout from '../components/Layout';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaGraduationCap, FaInfoCircle, FaCalendarAlt } from 'react-icons/fa';

const NIVELES = ['Inicial 1', 'Inicial 2', 'Preparatoria'];
const PARALELOS = ['A', 'B', 'C', 'D', 'E'];

export default function Grados() {
  const { user } = useAuth();
  const [grados, setGrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    paralelo: '',
    activo: true
  });

  // ✅ Obtener año lectivo activo automáticamente
  const anioActivo = aniosLectivos.find(a => a.activo);

  const resetForm = useCallback(() => {
    setFormData({
      nombre: '',
      paralelo: '',
      activo: true
    });
    setEditingId(null);
    setShowForm(false);
  }, []);

  const cargarAniosLectivos = useCallback(async () => {
    try {
      const q = query(collection(db, 'aniosLectivos'), where('activo', '==', true));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AnioLectivo));
      
      startTransition(() => {
        setAniosLectivos(data);
      });
    } catch (error) {
      console.error('Error cargando años lectivos:', error);
    }
  }, []);

  const cargarGrados = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'grados'),
        orderBy('orden', 'asc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Grado));
      
      startTransition(() => {
        setGrados(data);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error cargando grados:', error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  const guardarGrado = useCallback(async () => {
    if (!anioActivo) {
      alert('No hay un año lectivo activo. Crea uno primero en el módulo de Años Lectivos.');
      return;
    }

    try {
      const ordenNivel = NIVELES.indexOf(formData.nombre) + 1;
      const ordenParalelo = PARALELOS.indexOf(formData.paralelo) + 1;
      const orden = (ordenNivel * 100) + ordenParalelo;

      if (editingId) {
        await updateDoc(doc(db, 'grados', editingId), {
          nombre: formData.nombre,
          paralelo: formData.paralelo,
          activo: formData.activo,
          orden,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'grados'), {
          nombre: formData.nombre,
          paralelo: formData.paralelo,
          anioLectivoId: anioActivo.id, // ✅ Automático
          activo: true,
          orden,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      }

      resetForm();
      await cargarGrados();
    } catch (error) {
      console.error('Error guardando grado:', error);
      alert('Error al guardar');
    }
  }, [formData, editingId, user, anioActivo, resetForm, cargarGrados]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.paralelo) {
      alert('Todos los campos son obligatorios');
      return;
    }

    if (!anioActivo) {
      alert('No hay un año lectivo activo');
      return;
    }

    const yaExiste = grados.some(g => 
      g.nombre === formData.nombre && 
      g.paralelo === formData.paralelo &&
      g.anioLectivoId === anioActivo.id &&
      g.id !== editingId
    );

    if (yaExiste) {
      alert(`Ya existe el grado ${formData.nombre} - ${formData.paralelo} para el año lectivo ${anioActivo.nombre}`);
      return;
    }

    await guardarGrado();
  };

  const handleEdit = useCallback((grado: Grado) => {
    setFormData({
      nombre: grado.nombre,
      paralelo: grado.paralelo,
      activo: grado.activo
    });
    setEditingId(grado.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este grado? Esta acción no se puede deshacer.')) return;

    try {
      await deleteDoc(doc(db, 'grados', id));
      await cargarGrados();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  }, [cargarGrados]);

  const handleToggleActivo = useCallback(async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, 'grados', id), {
        activo: !estadoActual
      });
      await cargarGrados();
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  }, [cargarGrados]);

  useEffect(() => {
    cargarAniosLectivos();
    cargarGrados();
  }, [cargarAniosLectivos, cargarGrados]);

  if (loading) {
    return (
      <Layout title="Grados" subtitle="Gestiona los niveles educativos y paralelos" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando grados...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Grados" 
      subtitle="Gestiona los niveles educativos y paralelos"
      showBack
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
        >
          <FaPlus className="text-sm" />
          {showForm ? 'Cancelar' : 'Nuevo Grado'}
        </button>
      }
    >
      {/* ✅ Indicador de Año Lectivo Activo */}
      {anioActivo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <FaCalendarAlt className="text-sm" />
            <span className="text-sm font-medium">Trabajando con año lectivo:</span>
            <span className="text-base font-bold text-blue-900">{anioActivo.nombre}</span>
          </div>
        </div>
      )}

      {!anioActivo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-start gap-2">
            <FaInfoCircle className="text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-yellow-800 font-semibold text-sm mb-1">
                No hay año lectivo activo
              </h4>
              <p className="text-yellow-700 text-sm">
                Debes crear y activar un año lectivo primero en el módulo de Años Lectivos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3">
            <h3 className="text-white font-semibold text-base">
              {editingId ? 'Editar Grado' : 'Nuevo Grado'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Nivel Educativo *
                </label>
                <select
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {NIVELES.map(nivel => (
                    <option key={nivel} value={nivel}>{nivel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Paralelo *
                </label>
                <select
                  value={formData.paralelo}
                  onChange={(e) => setFormData({...formData, paralelo: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {PARALELOS.map(par => (
                    <option key={par} value={par}>{par}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="activo"
                checked={formData.activo}
                onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="activo" className="text-sm text-slate-700">
                {editingId ? 'Mantener como activo' : 'Grado activo (visible en el sistema)'}
              </label>
            </div>

            {formData.nombre && formData.paralelo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <FaInfoCircle className="text-sm" />
                  <span className="text-sm font-medium">Nombre completo:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formData.nombre} - {formData.paralelo}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
              >
                <FaCheck className="text-xs" />
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all text-sm font-medium"
              >
                <FaTimes className="text-xs" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de Grados */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Grado
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">
                  Estado
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {grados.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="bg-slate-100 rounded-full p-4 mb-3">
                        <FaGraduationCap className="text-3xl text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium mb-1">No hay grados registrados</p>
                      <p className="text-slate-500 text-sm mb-3">Comienza creando el primer grado</p>
                      <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        <FaPlus className="text-xs" />
                        Crear grado
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                grados.map((grado) => (
                  <tr key={grado.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-linear-to-br from-blue-500 to-purple-600 text-white rounded-lg w-10 h-10 flex items-center justify-center font-bold text-sm">
                          {grado.paralelo}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base">
                            {grado.nombre}
                          </div>
                          <div className="text-slate-500 text-xs">
                            Paralelo {grado.paralelo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleToggleActivo(grado.id, grado.activo)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          grado.activo
                            ? 'bg-linear-to-r from-green-500 to-green-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {grado.activo ? (
                          <>
                            <FaCheck className="mr-1 text-[10px]" />
                            Activo
                          </>
                        ) : (
                          'Inactivo'
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleEdit(grado)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Editar"
                        >
                          <FaEdit className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDelete(grado.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
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
        
        {grados.length > 0 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total: <strong>{grados.length}</strong> grado{grados.length !== 1 ? 's' : ''}</span>
              <span>{grados.filter(g => g.activo).length} activo{grados.filter(g => g.activo).length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}