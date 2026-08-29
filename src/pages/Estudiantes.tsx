import { useState, useEffect, startTransition, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  where,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Estudiante, Grado, AnioLectivo } from '../types';
import Layout from '../components/Layout';
import {
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes,
  FaUsers,
  FaInfoCircle,
  FaSearch,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaUserTie,
  FaBookOpen,
  FaLock,
  FaUpload
} from 'react-icons/fa';

// ✅ Función para formatear texto: MAYÚSCULAS, sin tildes y sin números
const formatText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\d/g, '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};

export default function Estudiantes() {
  const { user, userData } = useAuth();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradoId, setSelectedGradoId] = useState<string | null>(null);
  
  // Estados para edición individual
  const [formData, setFormData] = useState({
    apellidos: '',
    nombres: '',
    cedula: '',
    activo: true
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ✅ Estados para ingreso masivo
  const [showMassiveForm, setShowMassiveForm] = useState(false);
  const [massiveData, setMassiveData] = useState("");
  const [parsedStudents, setParsedStudents] = useState<{cedula: string, apellidos: string, nombres: string}[]>([]);
  const [isSavingMassive, setIsSavingMassive] = useState(false);

  const docenteSinGrados = userData?.role === 'docente' && (!userData?.gradosAsignados || userData.gradosAsignados.length === 0);
  const esAdmin = userData?.role === 'super_admin';
  const anioActivo = aniosLectivos.find(a => a.activo);

  // ✅ Filtrar tutorDe solo para el año lectivo activo
  const tutorDeAnioActivo = useMemo(() => {
    if (!userData?.tutorDe) return [];
    return grados.filter(g => userData.tutorDe?.includes(g.id)).map(g => g.id);
  }, [grados, userData]);

  const puedeGestionarEstudiantes = useCallback((gradoId: string): boolean => {
    if (esAdmin) return true;
    if (userData?.role === 'docente') {
      return userData?.tutorDe?.includes(gradoId) || false;
    }
    return false;
  }, [esAdmin, userData?.role, userData?.tutorDe]);

  // ✅ Solo puede registrar si es admin o tutor del grado seleccionado
  const puedeRegistrar = (esAdmin || (userData?.role === 'docente' && selectedGradoId && tutorDeAnioActivo.includes(selectedGradoId))) && !!selectedGradoId;

  const resetForm = useCallback(() => {
    setFormData({
      apellidos: '',
      nombres: '',
      cedula: '',
      activo: true
    });
    setEditingId(null);
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
      let q;
      if (userData?.role === 'docente' && userData?.gradosAsignados && userData.gradosAsignados.length > 0) {
        q = query(
          collection(db, 'grados'),
          where('__name__', 'in', userData.gradosAsignados),
          where('activo', '==', true),
          orderBy('orden', 'asc')
        );
      } else if (userData?.role === 'docente') {
        startTransition(() => {
          setGrados([]);
        });
        return;
      } else {
        q = query(
          collection(db, 'grados'),
          where('activo', '==', true),
          orderBy('orden', 'asc')
        );
      }
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Grado));
      startTransition(() => {
        setGrados(data);
        if (userData?.role === 'docente' && data.length > 0 && !selectedGradoId) {
          setSelectedGradoId(data[0].id);
        }
      });
    } catch (error) {
      console.error('Error cargando grados:', error);
    }
  }, [userData, selectedGradoId]);

  const cargarEstudiantes = useCallback(async () => {
    if (userData?.role === 'docente' && !selectedGradoId) {
      startTransition(() => {
        setEstudiantes([]);
        setLoading(false);
      });
      return;
    }

    let q;
    if (userData?.role === 'docente' && selectedGradoId) {
      q = query(
        collection(db, 'estudiantes'),
        where('gradoId', '==', selectedGradoId),
        orderBy('apellidos', 'asc')
      );
    } else if (esAdmin && selectedGradoId) {
      q = query(
        collection(db, 'estudiantes'),
        where('gradoId', '==', selectedGradoId),
        orderBy('apellidos', 'asc')
      );
    } else {
      q = query(
        collection(db, 'estudiantes'),
        orderBy('apellidos', 'asc')
      );
    }
    
    try {
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Estudiante));
      startTransition(() => {
        setEstudiantes(data);
      });
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [userData, selectedGradoId, esAdmin]);

  useEffect(() => {
    let isMounted = true;

    const fetchEstudiantes = async () => {
      if (!selectedGradoId && !esAdmin) {
        if (isMounted) {
          startTransition(() => {
            setEstudiantes([]);
            setLoading(false);
          });
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
      }

      let q;
      if (userData?.role === 'docente' && selectedGradoId) {
        q = query(
          collection(db, 'estudiantes'),
          where('gradoId', '==', selectedGradoId),
          orderBy('apellidos', 'asc')
        );
      } else if (esAdmin && selectedGradoId) {
        q = query(
          collection(db, 'estudiantes'),
          where('gradoId', '==', selectedGradoId),
          orderBy('apellidos', 'asc')
        );
      } else {
        q = query(
          collection(db, 'estudiantes'),
          orderBy('apellidos', 'asc')
        );
      }
      
      try {
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Estudiante));
        if (isMounted) {
          startTransition(() => {
            setEstudiantes(data);
            setLoading(false);
          });
        }
      } catch (error) {
        console.error('Error cargando estudiantes:', error);
        if (isMounted) {
          startTransition(() => {
            setLoading(false);
          });
        }
      }
    };

    fetchEstudiantes();

    return () => {
      isMounted = false;
    };
  }, [selectedGradoId, esAdmin, userData?.role]);

  // ✅ Parseo de datos masivos (Formato: Cédula, Apellidos y Nombres)
  const parseMassiveData = useCallback(() => {
    const lines = massiveData.trim().split('\n');
    const students: {cedula: string, apellidos: string, nombres: string}[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length < 2) {
        errors.push(`Línea ${index + 1}: Formato inválido. Use: Cédula, Apellidos y Nombres`);
        return;
      }
      
      const [cedula, ...nombreCompletoParts] = parts;
      const nombreCompleto = nombreCompletoParts.join(' ').trim();
      
      if (cedula.length !== 10 || !/^\d+$/.test(cedula)) {
        errors.push(`Línea ${index + 1}: La cédula "${cedula}" debe tener 10 dígitos numéricos`);
        return;
      }
      
      if (!nombreCompleto || nombreCompleto.length < 10) {
        errors.push(`Línea ${index + 1}: El nombre completo es muy corto (mínimo 10 caracteres)`);
        return;
      }
      
      if (/\d/.test(nombreCompleto)) {
        errors.push(`Línea ${index + 1}: El nombre no puede contener números`);
        return;
      }

      const nombreLimpio = formatText(nombreCompleto);
      const palabras = nombreLimpio.split(' ').filter(p => p.length > 0);
      
      if (palabras.length < 3) {
        errors.push(`Línea ${index + 1}: Se requieren al menos 3 palabras (2 apellidos + 1 nombre)`);
        return;
      }
      
      const apellidos = palabras.slice(0, 2).join(' ');
      const nombres = palabras.slice(2).join(' ');

      students.push({ cedula, apellidos, nombres });
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setParsedStudents([]);
    } else {
      const cedulasVistas = new Set<string>();
      const duplicadosInternos = students.filter(s => {
        if (cedulasVistas.has(s.cedula)) return true;
        cedulasVistas.add(s.cedula);
        return false;
      });

      if (duplicadosInternos.length > 0) {
        setValidationErrors(['Existen cédulas duplicadas en la lista ingresada']);
        setParsedStudents([]);
      } else {
        setValidationErrors([]);
        setParsedStudents(students);
      }
    }
  }, [massiveData]);

  // ✅ Guardado masivo
  const guardarEstudiantesMasivos = useCallback(async () => {
    if (!anioActivo) {
      alert('No hay un año lectivo activo.');
      return;
    }
    if (!selectedGradoId) {
      alert('Debe seleccionar un grado primero.');
      return;
    }
    if (parsedStudents.length === 0) {
      alert('No hay estudiantes válidos para registrar.');
      return;
    }

    setIsSavingMassive(true);
    try {
      const q = query(collection(db, 'estudiantes'), where('gradoId', '==', selectedGradoId));
      const snap = await getDocs(q);
      const existentes = new Set(snap.docs.map(doc => doc.data().cedula));

      const duplicados = parsedStudents.filter(s => existentes.has(s.cedula));
      if (duplicados.length > 0) {
        const cedulasDuplicadas = duplicados.map(s => s.cedula).join(', ');
        setValidationErrors([`Las siguientes cédulas ya existen en este grado: ${cedulasDuplicadas}`]);
        setIsSavingMassive(false);
        return;
      }

      const promesas = parsedStudents.map(async (est) => {
        await addDoc(collection(db, 'estudiantes'), {
          cedula: est.cedula,
          apellidos: est.apellidos,
          nombres: est.nombres,
          gradoId: selectedGradoId,
          anioLectivoId: anioActivo.id,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      });

      await Promise.all(promesas);
      
      alert(`✅ Se registraron ${parsedStudents.length} estudiante(s) correctamente`);
      setMassiveData("");
      setParsedStudents([]);
      setShowMassiveForm(false);
      setValidationErrors([]);
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error guardando estudiantes masivos:', error);
      alert('Error al guardar los estudiantes');
    } finally {
      setIsSavingMassive(false);
    }
  }, [parsedStudents, selectedGradoId, anioActivo, user, cargarEstudiantes]);

  const validarEstudiante = useCallback((cedula: string, apellidos: string, nombres: string, excludeId?: string): string[] => {
    const errors: string[] = [];
    if (!cedula || cedula.trim() === '') {
      errors.push('La cédula es obligatoria');
    } else if (cedula.length < 10) {
      errors.push(`La cédula "${cedula}" debe tener al menos 10 dígitos`);
    }
    if (!apellidos || apellidos.trim() === '') {
      errors.push('Los apellidos son obligatorios');
    }
    if (!nombres || nombres.trim() === '') {
      errors.push('Los nombres son obligatorios');
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

  const guardarEstudianteIndividual = useCallback(async () => {
    const errors = validarEstudiante(formData.cedula, formData.apellidos, formData.nombres, editingId || undefined);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, 'estudiantes', editingId), {
          apellidos: formData.apellidos.trim(),
          nombres: formData.nombres.trim(),
          cedula: formData.cedula.trim(),
          activo: formData.activo,
          updatedAt: serverTimestamp()
        });
      }
      resetForm();
      await cargarEstudiantes();
      alert('✅ Estudiante actualizado correctamente');
    } catch (error) {
      console.error('Error guardando estudiante:', error);
      alert('Error al guardar');
    }
  }, [formData, editingId, resetForm, cargarEstudiantes, validarEstudiante]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardarEstudianteIndividual();
  };

  const handleEdit = useCallback((estudiante: Estudiante) => {
    if (!puedeGestionarEstudiantes(estudiante.gradoId)) {
      alert('❌ No tienes permisos para editar estudiantes de este grado');
      return;
    }
    setFormData({
      apellidos: estudiante.apellidos,
      nombres: estudiante.nombres,
      cedula: estudiante.cedula || '',
      activo: estudiante.activo
    });
    setEditingId(estudiante.id);
    setValidationErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [puedeGestionarEstudiantes]);

  const handleDelete = useCallback(async (id: string) => {
    const estudiante = estudiantes.find(e => e.id === id);
    if (!estudiante) return;
    if (!puedeGestionarEstudiantes(estudiante.gradoId)) {
      alert('❌ No tienes permisos para eliminar estudiantes de este grado');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este estudiante? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'estudiantes', id));
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  }, [cargarEstudiantes, estudiantes, puedeGestionarEstudiantes]);

  const handleToggleActivo = useCallback(async (id: string, estadoActual: boolean) => {
    const estudiante = estudiantes.find(e => e.id === id);
    if (!estudiante) return;
    if (!puedeGestionarEstudiantes(estudiante.gradoId)) {
      alert('❌ No tienes permisos para modificar el estado de este estudiante');
      return;
    }
    try {
      await updateDoc(doc(db, 'estudiantes', id), {
        activo: !estadoActual
      });
      await cargarEstudiantes();
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  }, [cargarEstudiantes, estudiantes, puedeGestionarEstudiantes]);

  useEffect(() => {
    cargarAniosLectivos();
    cargarGrados();
  }, [cargarAniosLectivos, cargarGrados]);

  const estudiantesFiltrados = estudiantes.filter(est => {
    const searchText = searchTerm.toLowerCase();
    return (
      est.apellidos.toLowerCase().includes(searchText) ||
      est.nombres.toLowerCase().includes(searchText) ||
      (est.cedula && est.cedula.includes(searchTerm))
    );
  });

  if (loading) {
    return (
      <Layout title="Estudiantes" subtitle="Gestión y registro de estudiantes" showBack>
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
      subtitle="Gestión y registro de estudiantes"
      showBack
    >
      {docenteSinGrados && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl px-8 py-12 mb-6">
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="bg-yellow-100 p-3 rounded-full">
              <FaExclamationTriangle className="text-yellow-600 text-2xl" />
            </div>
            <div className="flex-1">
              <h3 className="text-yellow-800 font-bold text-xl mb-3">
                No tienes grados asignados
              </h3>
              <p className="text-yellow-700 mb-2">
                Contacta al administrador del sistema para que te asigne los grados que podrás gestionar.
              </p>
            </div>
          </div>
        </div>
      )}

      {!docenteSinGrados && anioActivo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <FaCalendarAlt className="text-sm" />
            <span className="text-sm font-medium">Trabajando con año lectivo:</span>
            <span className="text-base font-bold text-blue-900">{anioActivo.nombre}</span>
          </div>
        </div>
      )}

      {!docenteSinGrados && !anioActivo && (
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

      {/* ✅ Botones de grados asignados para docentes */}
      {!docenteSinGrados && grados.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FaBookOpen className="text-blue-600" />
            {esAdmin ? 'Seleccionar Grado:' : 'Mis Grados Asignados:'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {esAdmin && (
              <button
                onClick={() => setSelectedGradoId(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  selectedGradoId === null
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                }`}
              >
                Todos los grados
              </button>
            )}
            {grados.map((grado) => {
              const esTutor = tutorDeAnioActivo.includes(grado.id);
              return (
                <button
                  key={grado.id}
                  onClick={() => setSelectedGradoId(grado.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 flex items-center gap-2 ${
                    selectedGradoId === grado.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <span>{grado.nombre} - {grado.paralelo}</span>
                  {esTutor && (
                    <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded">
                      Tutor
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ Formulario de edición individual */}
      {editingId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-base">Editar Estudiante</h3>
            <button
              type="button"
              onClick={() => { resetForm(); setEditingId(null); }}
              className="text-white text-sm hover:bg-white/20 px-3 py-1 rounded transition"
            >
              Cancelar
            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Cédula/Identificación *</label>
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Apellidos *</label>
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Nombres *</label>
                <input
                  type="text"
                  value={formData.nombres}
                  onChange={(e) => setFormData({...formData, nombres: e.target.value})}
                  placeholder="Ej: Juan Carlos"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="activo" className="ml-2 text-sm text-slate-700">Estudiante activo</label>
              </div>
            </div>
            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium">
                <FaCheck className="text-xs" /> Actualizar
              </button>
              <button type="button" onClick={() => { resetForm(); setEditingId(null); }} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-all text-sm font-medium">
                <FaTimes className="text-xs" /> Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ✅ Formulario de Registro Masivo */}
      {showMassiveForm && puedeRegistrar && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-green-600 to-green-700 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <FaUpload /> Registro Masivo de Estudiantes
            </h3>
            <button
              type="button"
              onClick={() => { setShowMassiveForm(false); setMassiveData(""); setParsedStudents([]); setValidationErrors([]); }}
              className="text-white text-sm hover:bg-white/20 px-3 py-1 rounded transition"
            >
              Cancelar
            </button>
          </div>
          <div className="p-5">
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <FaExclamationTriangle className="text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-semibold text-sm mb-1">Errores de formato:</h4>
                    <ul className="text-red-700 text-sm space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Lista de Estudiantes (Uno por línea)
              </label>
              <textarea
                value={massiveData}
                onChange={(e) => setMassiveData(e.target.value)}
                placeholder="Ejemplo:&#10;1712345678, PEREZ GARCIA JUAN CARLOS&#10;1723456789, LOPEZ MARTINEZ MARIA ELENA"
                rows={8}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <FaInfoCircle /> Formato obligatorio: <strong>CÉDULA, APELLIDOS Y NOMBRES</strong> (separados por coma). Se convertirán automáticamente a mayúsculas y se separarán en apellidos (2 primeras palabras) y nombres (el resto).
              </p>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={parseMassiveData}
                disabled={isSavingMassive || !massiveData.trim()}
                className="inline-flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium"
              >
                <FaSearch className="text-xs" /> Validar Lista
              </button>
            </div>

            {parsedStudents.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-green-800 mb-3">
                  <FaCheck className="text-sm" />
                  <span className="text-sm font-bold">Vista Previa: Se registrarán {parsedStudents.length} estudiante(s) en {grados.find(g => g.id === selectedGradoId)?.nombre} {grados.find(g => g.id === selectedGradoId)?.paralelo}</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {parsedStudents.map((est, idx) => (
                    <div key={idx} className="text-sm text-slate-700 bg-white px-3 py-1.5 rounded border border-green-100">
                      <span className="font-mono font-semibold">{est.cedula}</span> - {est.apellidos}, {est.nombres}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={guardarEstudiantesMasivos}
                disabled={isSavingMassive || parsedStudents.length === 0}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg transition-all text-sm font-semibold"
              >
                {isSavingMassive ? <><FaTimes className="text-xs animate-spin" /> Procesando...</> : <><FaCheck className="text-xs" /> Guardar {parsedStudents.length} Estudiante(s)</>}
              </button>
              <button
                type="button"
                onClick={() => { setShowMassiveForm(false); setMassiveData(""); setParsedStudents([]); setValidationErrors([]); }}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
              >
                <FaTimes className="text-xs" /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {!docenteSinGrados && (
        <>
          {/* Mensaje si no hay grado seleccionado para docente */}
          {userData?.role === 'docente' && !selectedGradoId && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center mb-6">
              <FaBookOpen className="text-4xl text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">Selecciona un grado para ver los estudiantes</p>
              <p className="text-slate-500 text-sm">Haz clic en uno de los botones de grados asignados arriba</p>
            </div>
          )}

          {/* Lista de estudiantes */}
          {(selectedGradoId || esAdmin) && (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por apellidos, nombres, cédula..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                
                {/* ✅ Botón de Registro Masivo */}
                {puedeRegistrar && (
                  <button
                    onClick={() => setShowMassiveForm(true)}
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"
                  >
                    <FaUpload className="text-sm" /> Registrar Estudiantes
                  </button>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* ✅ TABLA RESPONSIVE: Se convierte en tarjetas en móvil */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200 hidden md:table-header-group">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Apellidos y Nombres</th>
                        {esAdmin && (
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Grado</th>
                        )}
                        {puedeRegistrar && (
                          <>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">Estado</th>
                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-40">Acciones</th>
                          </>
                        )}
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
                              {!searchTerm && puedeRegistrar && (
                                <p className="text-slate-500 text-sm">
                                  Utilice el botón "Registrar Estudiantes" para agregar alumnos a este grado.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        estudiantesFiltrados.map((est) => {
                          const grado = grados.find(g => g.id === est.gradoId);
                          const puedeEditar = puedeGestionarEstudiantes(est.gradoId);
                          
                          return (
                            <tr key={est.id} className="block md:table-row border-b md:border-b-0 border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                              
                              {/* Columna 1: Nombre y Cédula (Visible siempre) */}
                              <td className="px-5 py-4 block md:table-cell">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-900 text-sm">{est.apellidos} {est.nombres}</span>
                                  {est.cedula && <span className="text-slate-500 text-xs mt-1">CI: {est.cedula}</span>}
                                  
                                  {/* ✅ MÓVIL: Estado y Acciones apiladas debajo (Solo si es tutor) */}
                                  {puedeEditar && (
                                    <div className="mt-3 flex flex-col gap-2 md:hidden">
                                      <button
                                        onClick={() => handleToggleActivo(est.id, est.activo)}
                                        className={`w-full inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                          est.activo
                                            ? 'bg-green-100 text-green-700 border border-green-200'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {est.activo ? <><FaCheck className="mr-2" /> Activo</> : 'Inactivo'}
                                      </button>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleEdit(est)}
                                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-medium transition-all"
                                        >
                                          <FaEdit /> Editar
                                        </button>
                                        {/* ✅ CORREGIDO: Ahora visible para tutores (ya está dentro de puedeEditar) */}
                                        <button
                                          onClick={() => handleDelete(est.id)}
                                          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-all"
                                        >
                                          <FaTrash /> Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* ✅ MÓVIL: Indicador de solo lectura (Si no es tutor) */}
                                  {!puedeEditar && (
                                    <div className="mt-2 text-xs text-slate-400 italic md:hidden flex items-center gap-1">
                                      <FaLock className="text-[10px]" /> Solo lectura
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Columna 2: Grado (Desktop: Solo Admin) */}
                              {esAdmin && (
                                <td className="hidden md:table-cell px-5 py-4">
                                  {grado && (
                                    <div className="flex items-center gap-2">
                                      <div className="bg-linear-to-br from-blue-500 to-purple-600 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                                        {grado.paralelo}
                                      </div>
                                      <div className="text-sm text-slate-700">{grado.nombre}</div>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Columna 3: Estado (Desktop: Solo si puede editar) */}
                              {puedeEditar && (
                                <td className="hidden md:table-cell px-5 py-4 text-center">
                                  <button
                                    onClick={() => handleToggleActivo(est.id, est.activo)}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                      est.activo
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {est.activo ? <><FaCheck className="mr-1 text-[10px]" /> Activo</> : 'Inactivo'}
                                  </button>
                                </td>
                              )}

                              {/* Columna 4: Acciones (Desktop: Solo si puede editar) */}
                              {puedeEditar && (
                                <td className="hidden md:table-cell px-5 py-4">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => handleEdit(est)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium"
                                    >
                                      <FaEdit /> Editar
                                    </button>
                                    {/* ✅ CORREGIDO: Ahora visible para tutores (ya está dentro de puedeEditar) */}
                                    <button
                                      onClick={() => handleDelete(est.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium"
                                    >
                                      <FaTrash /> Eliminar
                                    </button>
                                  </div>
                                </td>
                              )}
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
                      <span>Mostrando <strong>{estudiantesFiltrados.length}</strong> estudiante{estudiantesFiltrados.length !== 1 ? 's' : ''}{searchTerm && ` de ${estudiantes.length}`}</span>
                      <span>{estudiantes.filter(e => e.activo).length} activo{estudiantes.filter(e => e.activo).length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ✅ Información de permisos para docentes */}
          {userData?.role === 'docente' && (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <FaUserTie className="text-purple-600 mt-0.5" />
                <div className="text-sm text-purple-900">
                  <p className="font-semibold mb-1">
                    {tutorDeAnioActivo.length > 0
                      ? `Eres tutor de ${tutorDeAnioActivo.length} grado(s) en ${anioActivo?.nombre}`
                      : 'No eres tutor de ningún grado en este año lectivo'}
                  </p>
                  <p className="text-xs">
                    {tutorDeAnioActivo.length > 0
                      ? 'Puedes registrar, editar y eliminar estudiantes solo en los grados donde eres tutor.'
                      : 'Como docente sin rol de tutor, solo puedes visualizar los estudiantes de tus grados asignados.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}