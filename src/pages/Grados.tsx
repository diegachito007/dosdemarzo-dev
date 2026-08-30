import { useState, useEffect, startTransition, useCallback, useMemo } from 'react';
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
import { 
  FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaGraduationCap, 
  FaInfoCircle, FaCalendarAlt, FaExclamationTriangle, FaLock, FaUnlock,
  FaLayerGroup, FaCheckCircle, FaTimesCircle, FaQuestionCircle
} from 'react-icons/fa';

// ✅ NIVELES ACTUALIZADOS: Se agregaron 1ro, 2do y 3ro de BGU
const NIVELES = [
  'Inicial 1', 'Inicial 2', 'Preparatoria',
  '2do EGB', '3ro EGB', '4to EGB', '5to EGB', '6to EGB', 
  '7mo EGB', '8vo EGB', '9no EGB', '10mo EGB',
  '1ro BGU', '2do BGU', '3ro BGU'
];

const PARALELOS = ['A', 'B', 'C', 'D', 'E'];

// ==================== TIPOS PARA MODALES ====================

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Grados() {
  const { user, userData } = useAuth();
  const [grados, setGrados] = useState<Grado[]>([]);
  const [gradosFiltrados, setGradosFiltrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // ✅ Selección múltiple
  const [selectedNiveles, setSelectedNiveles] = useState<string[]>([]);
  const [selectedParalelos, setSelectedParalelos] = useState<string[]>([]);
  const [activo, setActivo] = useState(true);
  const [abiertoMatricula, setAbiertoMatricula] = useState(false);

  // ✅ NUEVO: Sistema de toasts (reemplaza alert)
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ✅ NUEVO: Modal de confirmación personalizado (reemplaza confirm)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  });
  
  // ✅ CORRECCIÓN: Usar useMemo para estado derivado (elimina el error de ESLint)
  const combinaciones = useMemo(() => {
    const nuevasCombinaciones: {nombre: string, paralelo: string}[] = [];
    selectedNiveles.forEach(nivel => {
      selectedParalelos.forEach(paralelo => {
        nuevasCombinaciones.push({ nombre: nivel, paralelo });
      });
    });
    return nuevasCombinaciones;
  }, [selectedNiveles, selectedParalelos]);

  const puedeGestionar = userData?.role === 'super_admin';
  const docenteSinGrados = userData?.role === 'docente' && (!userData?.gradosAsignados || userData.gradosAsignados.length === 0);
  const anioActivo = aniosLectivos.find(a => a.activo);

  // ==================== HELPERS DE NOTIFICACIÓN ====================

  const mostrarToast = useCallback((
    type: Toast['type'],
    title: string,
    message?: string,
    duration = 4000
  ) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const cerrarToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmar = useCallback((
    title: string,
    message: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      confirmColor?: string;
      icon?: React.ComponentType<{ className?: string }>;
    }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        confirmText: options?.confirmText || "Confirmar",
        cancelText: options?.cancelText || "Cancelar",
        confirmColor: options?.confirmColor || "bg-red-600 hover:bg-red-700",
        icon: options?.icon || FaQuestionCircle,
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  // ==================== CARGA DE DATOS ====================

  const resetForm = useCallback(() => {
    setSelectedNiveles([]);
    setSelectedParalelos([]);
    setActivo(true);
    setAbiertoMatricula(false);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const cargarAniosLectivos = useCallback(async () => {
    try {
      const q = query(collection(db, 'aniosLectivos'), where('activo', '==', true));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnioLectivo));
      startTransition(() => setAniosLectivos(data));
    } catch (error) {
      console.error('Error cargando años lectivos:', error);
    }
  }, []);

  // ✅ CORRECCIÓN: Filtrar grados SOLO del año lectivo activo
  const cargarGrados = useCallback(async () => {
    // Si no hay año activo, limpiamos la lista y detenemos el loading
    if (!anioActivo) {
      startTransition(() => {
        setGrados([]);
        setGradosFiltrados([]);
        setLoading(false);
      });
      return;
    }

    try {
      let q;
      if (userData?.role === 'docente' && userData?.gradosAsignados && userData.gradosAsignados.length > 0) {
        q = query(
          collection(db, 'grados'),
          where('anioLectivoId', '==', anioActivo.id),
          where('__name__', 'in', userData.gradosAsignados),
          orderBy('orden', 'asc')
        );
      } else {
        q = query(
          collection(db, 'grados'),
          where('anioLectivoId', '==', anioActivo.id),
          orderBy('orden', 'asc')
        );
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grado));
      
      startTransition(() => {
        setGrados(data);
        setGradosFiltrados(data);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error cargando grados:', error);
      startTransition(() => setLoading(false));
    }
  }, [userData, anioActivo]);

  // ✅ MODIFICADO: Usa toasts en lugar de alert
  const guardarGrados = useCallback(async () => {
    if (!anioActivo) {
      mostrarToast('warning', 'Sin año lectivo activo', 'Crea uno primero en el módulo de Años Lectivos.');
      return;
    }

    if (selectedNiveles.length === 0 || selectedParalelos.length === 0) {
      mostrarToast('warning', 'Selección incompleta', 'Debes seleccionar al menos un nivel y un paralelo.');
      return;
    }

    try {
      // Verificar duplicados antes de crear
      const combinacionesExistentes = combinaciones.filter(comb => {
        return grados.some(g => 
          g.nombre === comb.nombre && 
          g.paralelo === comb.paralelo &&
          g.anioLectivoId === anioActivo.id
        );
      });

      if (combinacionesExistentes.length > 0) {
        const mensajes = combinacionesExistentes.map(c => `${c.nombre} - ${c.paralelo}`).join('\n');
        mostrarToast('warning', 'Grados ya existentes', `Los siguientes grados ya existen:\n${mensajes}`, 6000);
        return;
      }

      // Crear todas las combinaciones en batch
      const promesas = combinaciones.map(async (comb) => {
        const ordenNivel = NIVELES.indexOf(comb.nombre) + 1;
        const ordenParalelo = PARALELOS.indexOf(comb.paralelo) + 1;
        const orden = (ordenNivel * 100) + ordenParalelo;

        await addDoc(collection(db, 'grados'), {
          nombre: comb.nombre,
          paralelo: comb.paralelo,
          anioLectivoId: anioActivo.id,
          activo,
          abiertoMatricula,
          orden,
          createdAt: serverTimestamp(),
          createdBy: user?.uid
        });
      });

      await Promise.all(promesas);
      
      mostrarToast('success', 'Grados creados', `Se crearon ${combinaciones.length} grado(s) correctamente.`);
      resetForm();
      await cargarGrados();
    } catch (error) {
      console.error('Error guardando grados:', error);
      mostrarToast('error', 'Error al guardar', 'No se pudieron crear los grados.');
    }
  }, [combinaciones, activo, abiertoMatricula, grados, anioActivo, user, selectedNiveles, selectedParalelos, resetForm, cargarGrados, mostrarToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await guardarGrados();
  };

  const handleEdit = useCallback((grado: Grado) => {
    setSelectedNiveles([grado.nombre]);
    setSelectedParalelos([grado.paralelo]);
    setActivo(grado.activo);
    setAbiertoMatricula(grado.abiertoMatricula || false);
    setEditingId(grado.id);
    setShowForm(true);
  }, []);

  // ✅ MODIFICADO: Usa modal de confirmación personalizado
  const handleDelete = useCallback(async (id: string) => {
    const grado = grados.find(g => g.id === id);
    const confirmado = await confirmar(
      `Eliminar ${grado?.nombre || ''} - ${grado?.paralelo || ''}`,
      '¿Estás seguro de eliminar este grado? Esta acción no se puede deshacer.',
      {
        confirmText: "Sí, eliminar",
        cancelText: "Cancelar",
        confirmColor: "bg-red-600 hover:bg-red-700",
        icon: FaTrash,
      }
    );
    if (!confirmado) return;

    try {
      await deleteDoc(doc(db, 'grados', id));
      mostrarToast('success', 'Grado eliminado', `${grado?.nombre} - ${grado?.paralelo} fue eliminado correctamente.`);
      await cargarGrados();
    } catch (error) {
      console.error('Error eliminando:', error);
      mostrarToast('error', 'Error al eliminar', 'No se pudo eliminar el grado.');
    }
  }, [cargarGrados, grados, confirmar, mostrarToast]);

  const handleToggleActivo = useCallback(async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, 'grados', id), { activo: !estadoActual });
      await cargarGrados();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      mostrarToast('error', 'Error al actualizar', 'No se pudo cambiar el estado del grado.');
    }
  }, [cargarGrados, mostrarToast]);

  const handleToggleMatricula = useCallback(async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, 'grados', id), { abiertoMatricula: !estadoActual });
      await cargarGrados();
    } catch (error) {
      console.error('Error actualizando matrícula:', error);
      mostrarToast('error', 'Error al actualizar', 'No se pudo cambiar el estado de matrícula.');
    }
  }, [cargarGrados, mostrarToast]);

  // ✅ NUEVO: Toggle selección de nivel
  const toggleNivel = (nivel: string) => {
    setSelectedNiveles(prev => 
      prev.includes(nivel) 
        ? prev.filter(n => n !== nivel)
        : [...prev, nivel]
    );
  };

  // ✅ NUEVO: Toggle selección de paralelo
  const toggleParalelo = (paralelo: string) => {
    setSelectedParalelos(prev => 
      prev.includes(paralelo)
        ? prev.filter(p => p !== paralelo)
        : [...prev, paralelo]
    );
  };

  useEffect(() => {
    cargarAniosLectivos();
    // cargarGrados se ejecutará automáticamente cuando anioActivo cambie
  }, [cargarAniosLectivos]);

  useEffect(() => {
    cargarGrados();
  }, [cargarGrados]);

  // ==================== CONFIG DE TOASTS ====================

  const toastConfig = {
    success: {
      bg: 'bg-green-50 border-green-400',
      iconBg: 'bg-green-500',
      titleColor: 'text-green-900',
      msgColor: 'text-green-700',
      icon: FaCheckCircle,
    },
    error: {
      bg: 'bg-red-50 border-red-400',
      iconBg: 'bg-red-500',
      titleColor: 'text-red-900',
      msgColor: 'text-red-700',
      icon: FaTimesCircle,
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-400',
      iconBg: 'bg-yellow-500',
      titleColor: 'text-yellow-900',
      msgColor: 'text-yellow-700',
      icon: FaExclamationTriangle,
    },
    info: {
      bg: 'bg-blue-50 border-blue-400',
      iconBg: 'bg-blue-500',
      titleColor: 'text-blue-900',
      msgColor: 'text-blue-700',
      icon: FaInfoCircle,
    },
  };

  const ConfirmIcon = confirmModal.icon || FaQuestionCircle;

  if (loading) {
    return (
      <Layout title="Grados" subtitle="Gestiona los niveles educativos y paralelos" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm font-medium">Cargando grados...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Grados" 
      subtitle="Gestiona los niveles educativos y paralelos"
      showBack
      action={puedeGestionar ? (
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
        >
          <FaPlus className="text-sm" />
          {showForm ? 'Cancelar' : 'Crear Grados'}
        </button>
      ) : null}
    >
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
              <h4 className="text-yellow-800 font-semibold text-sm mb-1">No hay año lectivo activo</h4>
              <p className="text-yellow-700 text-sm">Debes crear y activar un año lectivo primero en el módulo de Años Lectivos.</p>
            </div>
          </div>
        </div>
      )}

      {docenteSinGrados && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl px-8 py-12 mb-6">
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="bg-yellow-100 p-3 rounded-full">
              <FaExclamationTriangle className="text-yellow-600 text-2xl" />
            </div>
            <div className="flex-1">
              <h3 className="text-yellow-800 font-bold text-xl mb-3">No tienes grados asignados</h3>
              <p className="text-yellow-700 mb-2">Contacta al administrador del sistema para que te asigne los grados que podrás gestionar.</p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ FORMULARIO CON SELECCIÓN MÚLTIPLE */}
      {showForm && puedeGestionar && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <FaLayerGroup />
              {editingId ? 'Editar Grado' : 'Creación Múltiple de Grados'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5">
            {/* Selector de Niveles Múltiples */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                1. Selecciona los Niveles Educativos *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {NIVELES.map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => toggleNivel(nivel)}
                    className={`px-3 py-3 rounded-lg text-sm font-semibold transition-all border-2 ${
                      selectedNiveles.includes(nivel)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {selectedNiveles.includes(nivel) && <FaCheck className="inline mr-1 text-xs" />}
                    {nivel}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Seleccionados: <strong>{selectedNiveles.length}</strong> nivel(es)
              </p>
            </div>

            {/* Selector de Paralelos Múltiples */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                2. Selecciona los Paralelos *
              </label>
              <div className="flex flex-wrap gap-3">
                {PARALELOS.map((par) => (
                  <button
                    key={par}
                    type="button"
                    onClick={() => toggleParalelo(par)}
                    className={`w-14 h-14 rounded-xl text-xl font-bold transition-all border-2 flex items-center justify-center relative ${
                      selectedParalelos.includes(par)
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-[1.05]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    {selectedParalelos.includes(par) && (
                      <FaCheck className="absolute -top-1 -right-1 text-xs bg-white text-purple-600 rounded-full w-5 h-5 flex items-center justify-center border border-purple-200" />
                    )}
                    {par}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Seleccionados: <strong>{selectedParalelos.length}</strong> paralelo(s)
              </p>
            </div>

            {/* Opciones Adicionales */}
            <div className="flex flex-wrap items-center gap-6 mb-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="activo" className="text-sm text-slate-700 font-medium">
                  Grados activos (visible en el sistema)
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="abiertoMatricula"
                  checked={abiertoMatricula}
                  onChange={(e) => setAbiertoMatricula(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                />
                <label htmlFor="abiertoMatricula" className="text-sm text-slate-700 font-medium flex items-center gap-1">
                  🔓 Abiertos a Matrícula Pública
                </label>
              </div>
            </div>

            {/* Vista Previa de Combinaciones */}
            {combinaciones.length > 0 && (
              <div className="bg-linear-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg px-4 py-4 mb-5">
                <div className="flex items-center gap-2 text-blue-800 mb-3">
                  <FaInfoCircle className="text-sm" />
                  <span className="text-sm font-bold">Vista Previa - Se crearán {combinaciones.length} grado(s):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {combinaciones.map((comb, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-semibold text-blue-900 shadow-sm"
                    >
                      {comb.nombre} - {comb.paralelo}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex gap-2 pt-3 border-t border-slate-200">
              <button
                type="submit"
                disabled={selectedNiveles.length === 0 || selectedParalelos.length === 0}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg transition-all text-sm font-semibold"
              >
                <FaCheck className="text-xs" />
                {editingId ? 'Actualizar Grado' : `Crear ${combinaciones.length} Grado(s)`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
              >
                <FaTimes className="text-xs" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de Grados */}
      {!docenteSinGrados && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Grado</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">Estado</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-40">Matrícula</th>
                  {puedeGestionar && (
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider w-32">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gradosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={puedeGestionar ? 4 : 3} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="bg-slate-100 rounded-full p-4 mb-3">
                          <FaGraduationCap className="text-3xl text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium mb-1">
                          {userData?.role === 'docente' ? 'No tienes grados asignados' : 'No hay grados registrados para este año lectivo'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  gradosFiltrados.map((grado) => (
                    <tr key={grado.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-linear-to-br from-blue-500 to-purple-600 text-white rounded-lg w-10 h-10 flex items-center justify-center font-bold text-sm shadow-sm">
                            {grado.paralelo}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-base">{grado.nombre}</div>
                            <div className="text-slate-500 text-xs">Paralelo {grado.paralelo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => puedeGestionar && handleToggleActivo(grado.id, grado.activo)}
                          disabled={!puedeGestionar}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            grado.activo
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          } ${!puedeGestionar ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                        >
                          {grado.activo ? <><FaCheck className="mr-1 text-[10px]" /> Activo</> : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => puedeGestionar && handleToggleMatricula(grado.id, grado.abiertoMatricula || false)}
                          disabled={!puedeGestionar}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            grado.abiertoMatricula
                              ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          } ${!puedeGestionar ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                        >
                          {grado.abiertoMatricula ? <FaUnlock className="text-xs" /> : <FaLock className="text-xs" />}
                          {grado.abiertoMatricula ? 'Abierto' : 'Cerrado'}
                        </button>
                      </td>
                      {puedeGestionar && (
                        <td className="px-5 py-3">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => handleEdit(grado)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all" title="Editar">
                              <FaEdit className="text-sm" />
                            </button>
                            <button onClick={() => handleDelete(grado.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all" title="Eliminar">
                              <FaTrash className="text-sm" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {gradosFiltrados.length > 0 && (
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Total: <strong>{gradosFiltrados.length}</strong> grado{gradosFiltrados.length !== 1 ? 's' : ''}</span>
                <span>{gradosFiltrados.filter(g => g.activo).length} activo{gradosFiltrados.filter(g => g.activo).length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ CONTENEDOR DE TOASTS (esquina superior derecha) */}
      <div className="fixed top-4 right-4 z-100 space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          const Icon = config.icon;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto bg-white border-l-4 ${config.bg} rounded-lg shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-right duration-300`}
            >
              <div className={`${config.iconBg} w-8 h-8 rounded-full flex items-center justify-center shrink-0`}>
                <Icon className="text-white text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${config.titleColor}`}>{toast.title}</p>
                {toast.message && (
                  <p className={`text-xs ${config.msgColor} mt-0.5 whitespace-pre-line`}>{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => cerrarToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ✅ MODAL DE CONFIRMACIÓN PERSONALIZADO */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-linear-to-r from-slate-50 to-slate-100 px-6 pt-6 pb-4 border-b border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <ConfirmIcon className="text-slate-700 text-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {confirmModal.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {confirmModal.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={confirmModal.onCancel}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold transition-all"
              >
                {confirmModal.cancelText || "Cancelar"}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 ${confirmModal.confirmColor || "bg-red-600 hover:bg-red-700"} text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2`}
              >
                <ConfirmIcon className="text-xs" />
                {confirmModal.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}