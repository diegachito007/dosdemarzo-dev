import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Grado, Destreza, AnioLectivo, Ambito } from '../types';
import Layout from '../components/Layout';
import { 
  FaChalkboardTeacher, 
  FaGraduationCap, 
  FaCheck, 
  FaSpinner, 
  FaExclamationTriangle,
  FaBook,
  FaCheckCircle,
  FaTrash
} from 'react-icons/fa';

interface AsignaturaDocente {
  id?: string;
  docenteId: string;
  gradoId: string;
  destrezaId: string;
  anioLectivoId: string;
  activo: boolean;
  createdAt?: Timestamp | Date;
}

export default function MiHorario() {
  const { user, userData } = useAuth();
  const [grados, setGrados] = useState<Grado[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [asignaturas, setAsignaturas] = useState<AsignaturaDocente[]>([]);
  const [anioActivo, setAnioActivo] = useState<AnioLectivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedGradoId, setSelectedGradoId] = useState<string>('');

  // ✅ Cargar datos iniciales (año lectivo y grados) - solo una vez
  useEffect(() => {
    let isMounted = true;

    const cargarDatosIniciales = async () => {
      try {
        // 1. Año lectivo activo
        const qAnios = query(collection(db, 'aniosLectivos'), where('activo', '==', true));
        const snapAnios = await getDocs(qAnios);
        if (snapAnios.empty) {
          if (isMounted) setLoading(false);
          return;
        }
        const anioData = { id: snapAnios.docs[0].id, ...snapAnios.docs[0].data() } as AnioLectivo;
        if (isMounted) setAnioActivo(anioData);

        // 2. Grados asignados al usuario
        let qGrados;
        if (userData?.role === 'docente' && userData?.gradosAsignados && userData.gradosAsignados.length > 0) {
          qGrados = query(
            collection(db, 'grados'),
            where('anioLectivoId', '==', anioData.id),
            where('__name__', 'in', userData.gradosAsignados),
            where('activo', '==', true)
          );
        } else {
          qGrados = query(
            collection(db, 'grados'),
            where('anioLectivoId', '==', anioData.id),
            where('activo', '==', true)
          );
        }
        const snapGrados = await getDocs(qGrados);
        const gradosData = snapGrados.docs.map(d => ({ id: d.id, ...d.data() } as Grado));
        if (isMounted) {
          setGrados(gradosData);
          if (gradosData.length > 0) {
            setSelectedGradoId(gradosData[0].id);
          }
        }
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    cargarDatosIniciales();

    return () => {
      isMounted = false;
    };
  }, [userData]);

  // ✅ LISTENER EN TIEMPO REAL: Destrezas (se actualizan automáticamente)
  useEffect(() => {
    const q = query(collection(db, 'destrezas'), where('activo', '==', true), orderBy('orden', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const destrezasData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Destreza));
      setDestrezas(destrezasData);
    }, (error) => {
      console.error('Error escuchando destrezas:', error);
    });

    return () => unsubscribe();
  }, []);

  // ✅ LISTENER EN TIEMPO REAL: Ámbitos (se actualizan automáticamente)
  useEffect(() => {
    const q = query(collection(db, 'ambitos'), where('activo', '==', true), orderBy('orden', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ambitosData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ambito));
      setAmbitos(ambitosData);
    }, (error) => {
      console.error('Error escuchando ámbitos:', error);
    });

    return () => unsubscribe();
  }, []);

  // ✅ LISTENER EN TIEMPO REAL: Asignaturas del docente actual
  useEffect(() => {
    if (!user?.uid || !anioActivo?.id) return;

    const q = query(
      collection(db, 'asignaturasDocente'),
      where('docenteId', '==', user.uid),
      where('anioLectivoId', '==', anioActivo.id),
      where('activo', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const asignaturasData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AsignaturaDocente));
      setAsignaturas(asignaturasData);
    }, (error) => {
      console.error('Error escuchando asignaturas:', error);
    });

    return () => unsubscribe();
  }, [user?.uid, anioActivo?.id]);

  // Helper para obtener el nombre del ámbito
  const getAmbitoNombre = (ambitoId: string): string => {
    const ambito = ambitos.find(a => a.id === ambitoId);
    return ambito?.nombre || 'Sin ámbito';
  };

  // Materias del grado seleccionado
  const destrezasDelGrado = useMemo(() => {
    if (!selectedGradoId) return [];
    const ambitosDelGrado = ambitos.filter(a => a.gradoId === selectedGradoId).map(a => a.id);
    return destrezas.filter(d => ambitosDelGrado.includes(d.ambitoId));
  }, [selectedGradoId, destrezas, ambitos]);

  // Asignaturas del grado seleccionado
  const asignaturasDelGrado = useMemo(() => {
    return asignaturas.filter(a => a.gradoId === selectedGradoId);
  }, [asignaturas, selectedGradoId]);

  // Materias disponibles
  const destrezasDisponibles = useMemo(() => {
    const asignadasIds = asignaturasDelGrado.map(a => a.destrezaId);
    return destrezasDelGrado.filter(d => !asignadasIds.includes(d.id));
  }, [destrezasDelGrado, asignaturasDelGrado]);

  const verificarDisponibilidad = async (destrezaId: string): Promise<boolean> => {
    try {
      const q = query(
        collection(db, 'asignaturasDocente'),
        where('gradoId', '==', selectedGradoId),
        where('destrezaId', '==', destrezaId),
        where('anioLectivoId', '==', anioActivo?.id),
        where('activo', '==', true)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) return true;
      
      const asignacionExistente = snap.docs[0].data();
      return asignacionExistente.docenteId === user?.uid;
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      return false;
    }
  };

  const asignarMateria = async (destrezaId: string) => {
    if (!user?.uid || !anioActivo?.id || !selectedGradoId) return;

    setSaving(true);
    try {
      const disponible = await verificarDisponibilidad(destrezaId);
      if (!disponible) {
        alert('❌ Esta materia ya está asignada a otro docente en este grado');
        setSaving(false);
        return;
      }

      await addDoc(collection(db, 'asignaturasDocente'), {
        docenteId: user.uid,
        gradoId: selectedGradoId,
        destrezaId,
        anioLectivoId: anioActivo.id,
        activo: true,
        createdAt: new Date()
      });
      // ✅ Ya no necesitamos actualizar el estado local: onSnapshot lo hace automáticamente
    } catch (error) {
      console.error('Error asignando materia:', error);
      alert('Error al asignar la materia');
    } finally {
      setSaving(false);
    }
  };

  const removerMateria = async (asignacionId: string) => {
    if (!confirm('¿Quitar esta materia de tu horario?')) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, 'asignaturasDocente', asignacionId));
      // ✅ Ya no necesitamos actualizar el estado local: onSnapshot lo hace automáticamente
    } catch (error) {
      console.error('Error removiendo materia:', error);
      alert('Error al remover la materia');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Mi Horario" subtitle="Configura las materias que dictas" showBack>
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="animate-spin text-4xl text-blue-600" />
        </div>
      </Layout>
    );
  }

  if (!anioActivo) {
    return (
      <Layout title="Mi Horario" subtitle="Configura las materias que dictas" showBack>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <FaExclamationTriangle className="text-yellow-600 text-4xl mx-auto mb-3" />
          <p className="text-yellow-800">No hay año lectivo activo</p>
        </div>
      </Layout>
    );
  }

  const gradoActual = grados.find(g => g.id === selectedGradoId);

  return (
    <Layout title="Mi Horario" subtitle="Configura las materias que dictas en cada grado" showBack>
      <div className="space-y-6">
        {/* Banner de año lectivo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-blue-800">
            <FaChalkboardTeacher className="text-sm" />
            <span className="text-sm font-medium">Año lectivo:</span>
            <span className="text-base font-bold text-blue-900">{anioActivo.nombre}</span>
            {/* ✅ Indicador de tiempo real */}
            <span className="ml-auto flex items-center gap-1 text-xs text-blue-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              En vivo
            </span>
          </div>
        </div>

        {/* Selector de grados */}
        {grados.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FaGraduationCap className="text-blue-600" />
              Selecciona un Grado:
            </h3>
            <div className="flex flex-wrap gap-2">
              {grados.map(grado => {
                const countAsignadas = asignaturas.filter(a => a.gradoId === grado.id).length;
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
                    {countAsignadas > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        selectedGradoId === grado.id
                          ? 'bg-white text-blue-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {countAsignadas}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel de materias asignadas */}
        {selectedGradoId && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-green-200 overflow-hidden">
            <div className="bg-linear-to-r from-green-600 to-green-700 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-white text-lg" />
                <h3 className="text-white font-semibold">
                  Mis Materias Asignadas en {gradoActual?.nombre} - {gradoActual?.paralelo}
                </h3>
              </div>
              <span className="bg-white text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                {asignaturasDelGrado.length}
              </span>
            </div>

            <div className="p-4">
              {asignaturasDelGrado.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <FaBook className="text-3xl mx-auto mb-2" />
                  <p className="text-sm">Aún no has asignado materias en este grado</p>
                  <p className="text-xs mt-1">Selecciona materias desde la lista de abajo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {asignaturasDelGrado.map(asignatura => {
                    const destreza = destrezas.find(d => d.id === asignatura.destrezaId);
                    if (!destreza) return null;
                    const ambitoNombre = getAmbitoNombre(destreza.ambitoId);
                    return (
                      <div
                        key={asignatura.id}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg group hover:border-green-400 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {destreza.nombre}
                          </p>
                          <p className="text-xs text-green-700 font-medium truncate">
                            {ambitoNombre}
                          </p>
                        </div>
                        <button
                          onClick={() => removerMateria(asignatura.id || '')}
                          disabled={saving}
                          className="ml-2 p-1.5 text-red-600 hover:bg-red-100 rounded transition-all opacity-60 group-hover:opacity-100 disabled:opacity-30"
                          title="Quitar materia"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista de materias disponibles */}
        {selectedGradoId && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-800 mb-1">
              Materias Disponibles
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Haz clic en "Asignar" para agregar una materia a tu horario de {gradoActual?.nombre} - {gradoActual?.paralelo}
            </p>
            
            {destrezasDisponibles.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FaCheck className="text-3xl mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">¡Ya tienes todas las materias asignadas!</p>
                <p className="text-xs mt-1">No hay más materias disponibles en este grado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {destrezasDisponibles.map(destreza => {
                  const ambitoNombre = getAmbitoNombre(destreza.ambitoId);
                  return (
                    <div
                      key={destreza.id}
                      className="flex items-center justify-between p-3 rounded-lg border-2 border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {destreza.nombre}
                        </p>
                        <p className="text-xs text-slate-600 font-medium truncate flex items-center gap-1 mt-0.5">
                          <FaBook className="text-xs text-purple-600" />
                          {ambitoNombre}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => asignarMateria(destreza.id)}
                        disabled={saving}
                        className="ml-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {saving ? (
                          <FaSpinner className="animate-spin text-xs" />
                        ) : (
                          <>
                            <FaCheck className="text-xs" />
                            Asignar
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mensaje si no hay grados */}
        {grados.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <FaExclamationTriangle className="text-yellow-600 text-4xl mx-auto mb-3" />
            <p className="text-yellow-800 font-medium mb-2">No tienes grados asignados</p>
            <p className="text-sm text-yellow-700">
              Contacta al administrador para que te asigne grados antes de configurar tu horario.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}