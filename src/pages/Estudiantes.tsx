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
import type { Estudiante, Grado, AnioLectivo } from '../types';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaUsers, FaInfoCircle, FaSearch, FaExclamationTriangle, FaCalendarAlt } from 'react-icons/fa';

interface EstudianteData {
  cedula: string;
  apellidos: string;
  nombres: string;
}

export default function Estudiantes() {
  const { user } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMassive, setIsMassive] = useState(false);
  const [massiveData, setMassiveData] = useState('');
  const [parsedStudents, setParsedStudents] = useState<EstudianteData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    cedula: '',
    gradoId: '',
    activo: true
  });

  // ✅ Obtener año lectivo activo automáticamente
  const anioActivo = aniosLectivos.find(a => a.activo);

  const resetForm = useCallback(() => {
    setFormData({
      apellidos: '',
      nombres: '',
      cedula: '',
      gradoId: '',
      activo: true
    });
    setEditingId(null);
    setShowForm(false);
    setIsMassive(false);
    setMassiveData('');
    setParsedStudents([]);
    setValidationErrors([]);
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
        where('activo', '==', true),
        orderBy('orden', 'asc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Grado));
      
      startTransition(() => {
        setGrados(data);
      });
    } catch (error) {
      console.error('Error cargando grados:', error);
    }
  }, []);

  const cargarEstudiantes = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'estudiantes'),
        orderBy('apellidos', 'asc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Estudiante));
      
      startTransition(() => {
        setEstudiantes(data);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  const validarEstudiante = useCallback((cedula: string, apellidos: string, nombres: string, gradoId: string, excludeId?: string): string[] => {
    const errors: string[] = [];

    if (!cedula || cedula.trim() === '') {
      errors.push('La cédula es obligatoria');
    } else if (cedula.length < 10) {
      errors.push(`La cédula "${cedula}" debe tener al menos 10 dígitos`);
    }

    if (!apellidos || apellidos.trim() === '') {
      errors.push('Los apellidos son obligatorios');
    } else if (apellidos.trim().split(' ').length < 2) {
      errors.push(`Los apellidos "${apellidos}" deben contener al menos dos apellidos`);
    }

    if (!nombres || nombres.trim() === '') {
      errors.push('Los nombres son obligatorios');
    }

    if (!gradoId) {
      errors.push('Debe seleccionar un grado');
    }

    if (cedula) {
      const existeDuplicado = estudiantes.some(e => 
        e.cedula === cedula.trim() && e.id !== excludeId
      );
      if (existeDuplicado) {
        errors.push(`Ya existe un estudiante con la cédula "${cedula}"`);
      }
    }

    return errors;
  }, [estudiantes]);

  const parseMassiveData = useCallback((data: string): { students: EstudianteData[]; parseErrors: string[] } => {
    const lines = data.trim().split('\n');
    const students: EstudianteData[] = [];
    const parseErrors: string[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const separators = [',', ';', '|', '\t'];
      let parts: string[] = [];
      
      for (const sep of separators) {
        if (trimmedLine.includes(sep)) {
          parts = trimmedLine.split(sep).map(p => p.trim());
          break;
        }
      }

      if (parts.length < 3) {
        parseErrors.push(`Línea ${index + 1}: Formato inválido. Use: "Cédula, Apellidos, Nombres"`);
        return;
      }

      const cedula = parts[0];
      const apellidos = parts[1];
      const nombres = parts.slice(2).join(' ').trim();

      students.push({ cedula, apellidos, nombres });
    });

    return { students, parseErrors };
  }, []);

  const validarEstudiantesMasivos = useCallback((students: EstudianteData[], gradoId: string): string[] => {
    const allErrors: string[] = [];
    const cedulasVistas = new Set<string>();

    students.forEach((est, index) => {
      const errors = validarEstudiante(est.cedula, est.apellidos, est.nombres, gradoId);
      
      if (cedulasVistas.has(est.cedula)) {
        errors.push(`Cédula "${est.cedula}" duplicada en el lote`);
      }
      cedulasVistas.add(est.cedula);

      if (errors.length > 0) {
        allErrors.push(`Línea ${index + 1} (${est.cedula}): ${errors.join(', ')}`);
      }
    });

    return allErrors;
  }, [validarEstudiante]);

  const guardarEstudianteIndividual = useCallback(async () => {
    const errors = validarEstudiante(formData.cedula, formData.apellidos, formData.nombres, formData.gradoId, editingId || undefined);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const grado = grados.find(g => g.id === formData.gradoId);
      const anioLectivoId = grado?.anioLectivoId || '';

      if (editingId) {
        await updateDoc(doc(db, 'estudiantes', editingId), {
          apellidos: formData.apellidos.trim(),
          nombres: formData.nombres.trim(),
          cedula: formData.cedula.trim(),
          gradoId: formData.gradoId,
          anioLectivoId,
          activo: formData.activo,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'estudiantes'), {
          apellidos: formData.apellidos.trim(),
          nombres: formData.nombres.trim(),
          cedula: formData.cedula.trim(),
          gradoId: formData.gradoId,
          anioLectivoId,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      }

      resetForm();
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error guardando estudiante:', error);
      alert('Error al guardar');
    }
  }, [formData, grados, editingId, user, resetForm, cargarEstudiantes, validarEstudiante]);

  const guardarEstudiantesMasivos = useCallback(async () => {
    if (!massiveData.trim()) {
      setValidationErrors(['No hay datos para procesar. Ingrese al menos un estudiante.']);
      return;
    }

    if (!formData.gradoId) {
      setValidationErrors(['Debe seleccionar un grado antes de registrar.']);
      return;
    }

    const { students, parseErrors } = parseMassiveData(massiveData);

    if (parseErrors.length > 0) {
      setValidationErrors(parseErrors);
      setParsedStudents([]);
      return;
    }

    if (students.length === 0) {
      setValidationErrors(['No se encontraron estudiantes válidos. Verifique el formato.']);
      return;
    }

    const validationErrors = validarEstudiantesMasivos(students, formData.gradoId);

    if (validationErrors.length > 0) {
      setValidationErrors(validationErrors);
      setParsedStudents([]);
      return;
    }

    setParsedStudents(students);
    setValidationErrors([]);
    setShowConfirmModal(true);
  }, [massiveData, formData.gradoId, parseMassiveData, validarEstudiantesMasivos]);

  const confirmarGuardadoMasivo = useCallback(async () => {
    setShowConfirmModal(false);
    
    try {
      const grado = grados.find(g => g.id === formData.gradoId);
      const anioLectivoId = grado?.anioLectivoId || '';
      
      const batch = parsedStudents.map(async (est) => {
        await addDoc(collection(db, 'estudiantes'), {
          apellidos: est.apellidos.trim(),
          nombres: est.nombres.trim(),
          cedula: est.cedula.trim(),
          gradoId: formData.gradoId,
          anioLectivoId,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      });

      await Promise.all(batch);
      
      resetForm();
      await cargarEstudiantes();
      
      alert(`✅ Se registraron ${parsedStudents.length} estudiante(s) correctamente`);
    } catch (error) {
      console.error('Error guardando estudiantes masivos:', error);
      alert('Error al guardar los estudiantes');
    }
  }, [parsedStudents, formData.gradoId, grados, user, resetForm, cargarEstudiantes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMassive) {
      await guardarEstudiantesMasivos();
    } else {
      await guardarEstudianteIndividual();
    }
  };

  const handleEdit = useCallback((estudiante: Estudiante) => {
    setFormData({
      apellidos: estudiante.apellidos,
      nombres: estudiante.nombres,
      cedula: estudiante.cedula || '',
      gradoId: estudiante.gradoId,
      activo: estudiante.activo
    });
    setEditingId(estudiante.id);
    setShowForm(true);
    setIsMassive(false);
    setValidationErrors([]);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este estudiante? Esta acción no se puede deshacer.')) return;

    try {
      await deleteDoc(doc(db, 'estudiantes', id));
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  }, [cargarEstudiantes]);

  const handleToggleActivo = useCallback(async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, 'estudiantes', id), {
        activo: !estadoActual
      });
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  }, [cargarEstudiantes]);

  useEffect(() => {
    cargarAniosLectivos();
    cargarGrados();
    cargarEstudiantes();
  }, [cargarAniosLectivos, cargarGrados, cargarEstudiantes]);

  const estudiantesFiltrados = estudiantes.filter(est => {
    const matchGrado = grados.find(g => g.id === est.gradoId);
    const searchText = searchTerm.toLowerCase();
    
    return (
      est.apellidos.toLowerCase().includes(searchText) ||
      est.nombres.toLowerCase().includes(searchText) ||
      (est.cedula && est.cedula.includes(searchTerm)) ||
      (matchGrado && `${matchGrado.nombre} ${matchGrado.paralelo}`.toLowerCase().includes(searchText))
    );
  });

  if (loading) {
    return (
      <Layout title="Estudiantes" subtitle="Administra la matrícula de alumnos" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando estudiantes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Estudiantes" 
      subtitle="Administra la matrícula de alumnos"
      showBack
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
        >
          <FaPlus className="text-sm" />
          {showForm ? 'Cancelar' : 'Nuevo Estudiante'}
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

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-base">
              {editingId ? 'Editar Estudiante' : (isMassive ? 'Ingreso Masivo' : 'Nuevo Estudiante')}
            </h3>
            {!editingId && (
              <button
                type="button"
                onClick={() => {
                  setIsMassive(!isMassive);
                  setMassiveData('');
                  setParsedStudents([]);
                  setValidationErrors([]);
                }}
                className="text-white text-sm hover:bg-white/20 px-3 py-1 rounded transition"
              >
                {isMassive ? 'Modo Individual' : 'Modo Masivo'}
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="p-5">
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <FaExclamationTriangle className="text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-semibold text-sm mb-1">
                      {validationErrors.length} error{validationErrors.length !== 1 ? 'es' : ''} encontrado{validationErrors.length !== 1 ? 's' : ''}:
                    </h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {!isMassive ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Cédula/Identificación *
                  </label>
                  <input
                    type="text"
                    value={formData.cedula}
                    onChange={(e) => setFormData({...formData, cedula: e.target.value})}
                    placeholder="Ej: 1712345678"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Apellidos *
                  </label>
                  <input
                    type="text"
                    value={formData.apellidos}
                    onChange={(e) => setFormData({...formData, apellidos: e.target.value})}
                    placeholder="Ej: Pérez García"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    value={formData.nombres}
                    onChange={(e) => setFormData({...formData, nombres: e.target.value})}
                    placeholder="Ej: Juan Carlos"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Grado y Paralelo *
                  </label>
                  <select
                    value={formData.gradoId}
                    onChange={(e) => setFormData({...formData, gradoId: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {grados.map(grado => (
                      <option key={grado.id} value={grado.id}>
                        {grado.nombre} - {grado.paralelo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="activo" className="ml-2 text-sm text-slate-700">
                    {editingId ? 'Mantener como activo' : 'Estudiante activo'}
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Grado y Paralelo *
                  </label>
                  <select
                    value={formData.gradoId}
                    onChange={(e) => setFormData({...formData, gradoId: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  >
                    <option value="">Seleccionar grado...</option>
                    {grados.map(grado => (
                      <option key={grado.id} value={grado.id}>
                        {grado.nombre} - {grado.paralelo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Datos de Estudiantes (Cédula, Apellidos, Nombres) *
                  </label>
                  <textarea
                    value={massiveData}
                    onChange={(e) => setMassiveData(e.target.value)}
                    placeholder={`Ejemplo:
1712345678, Pérez García, Juan Carlos
1787654321, González López, María Fernanda
1723456789, Rodríguez, Carlos Alberto`}
                    rows={10}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    <FaInfoCircle className="inline mr-1" />
                    Formato: Cédula, Apellidos, Nombres. Use coma (,), punto y coma (;), barra (|) o tabulación como separador
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
              >
                <FaCheck className="text-xs" />
                {editingId ? 'Actualizar' : (isMassive ? 'Registrar Todos' : 'Guardar')}
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por apellidos, nombres, cédula o grado..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Apellidos y Nombres
                </th>
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
              {estudiantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="bg-slate-100 rounded-full p-4 mb-3">
                        <FaUsers className="text-3xl text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium mb-1">
                        {searchTerm ? 'No se encontraron estudiantes' : 'No hay estudiantes registrados'}
                      </p>
                      {!searchTerm && (
                        <>
                          <p className="text-slate-500 text-sm mb-3">Comienza registrando el primer estudiante</p>
                          <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            <FaPlus className="text-xs" />
                            Registrar estudiante
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                estudiantesFiltrados.map((est) => {
                  const grado = grados.find(g => g.id === est.gradoId);
                  
                  return (
                    <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {est.apellidos} {est.nombres}
                          </div>
                          {est.cedula && (
                            <div className="text-slate-500 text-xs mt-0.5">
                              CI: {est.cedula}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {grado ? (
                          <div className="flex items-center gap-2">
                            <div className="bg-linear-to-br from-blue-500 to-purple-600 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                              {grado.paralelo}
                            </div>
                            <div className="text-sm text-slate-700">
                              {grado.nombre}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleToggleActivo(est.id, est.activo)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            est.activo
                              ? 'bg-linear-to-r from-green-500 to-green-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {est.activo ? (
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
                            onClick={() => handleEdit(est)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="Editar"
                          >
                            <FaEdit className="text-sm" />
                          </button>
                          <button
                            onClick={() => handleDelete(est.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Eliminar"
                          >
                            <FaTrash className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {estudiantesFiltrados.length > 0 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando <strong>{estudiantesFiltrados.length}</strong> estudiante{estudiantesFiltrados.length !== 1 ? 's' : ''}
                {searchTerm && ` de ${estudiantes.length}`}
              </span>
              <span>{estudiantes.filter(e => e.activo).length} activo{estudiantes.filter(e => e.activo).length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirmar Registro Masivo"
        message={`Se analizaron y validaron correctamente ${parsedStudents.length} estudiante(s). ¿Deseas registrarlos en el sistema? Esta acción no se puede deshacer.`}
        onConfirm={confirmarGuardadoMasivo}
        onCancel={() => {
          setShowConfirmModal(false);
          setParsedStudents([]);
        }}
        confirmText="Sí, registrar todos"
        cancelText="Cancelar"
        type="info"
      />
    </Layout>
  );
}