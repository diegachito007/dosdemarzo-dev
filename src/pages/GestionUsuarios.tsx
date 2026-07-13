import { useEffect, useState, useCallback, startTransition } from 'react';
import { collection, doc, updateDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { AppUser, Grado } from '../types';
import Layout from '../components/Layout';
import { 
  FaUserCheck, FaUserTimes, FaShieldAlt, 
  FaUsers, FaClock, FaCheckCircle, FaTimesCircle, FaTrash, FaGraduationCap, FaPlus, FaUserTie
} from 'react-icons/fa';

export default function GestionUsuarios() {
  const { canDeleteUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [filter, setFilter] = useState<'pending' | 'active' | 'rejected' | 'blocked'>('pending');
  const [loading, setLoading] = useState(true);
  const [showGradosModal, setShowGradosModal] = useState(false);
  const [selectedUserForGrados, setSelectedUserForGrados] = useState<AppUser | null>(null);
  const [gradosSeleccionados, setGradosSeleccionados] = useState<string[]>([]);
  const [tutorDe, setTutorDe] = useState<string[]>([]);  // ✅ Nuevo estado

  // ✅ Cargar grados disponibles
  const cargarGrados = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'grados'),
        where('activo', '==', true),
        orderBy('orden', 'asc')
      );
      const snap = await getDocs(q);
      const gradosData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Grado));
      
      startTransition(() => {
        setGrados(gradosData);
      });
    } catch (error) {
      console.error('Error cargando grados:', error);
    }
  }, []);

  // ✅ Cargar usuarios
  const cargarUsuarios = useCallback(async () => {
    try {
      const q = query(collection(db, 'usuarios'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const usersData = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as unknown as AppUser));
      
      startTransition(() => {
        setUsers(usersData);
        setLoading(false);
      });
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    cargarGrados();
    cargarUsuarios();
  }, [cargarGrados, cargarUsuarios]);

  // ✅ Actualizar estado del usuario
  const updateStatus = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', userId), { status: newStatus });
      
      if (newStatus === 'active') {
        const user = users.find(u => u.uid === userId);
        if (user) {
          setSelectedUserForGrados(user);
          setGradosSeleccionados(user.gradosAsignados || []);
          setTutorDe(user.tutorDe || []);  // ✅ Cargar tutorDe existente
          setShowGradosModal(true);
        }
      }
      
      alert(`✅ Usuario ${newStatus === 'active' ? 'aprobado' : newStatus === 'rejected' ? 'rechazado' : 'bloqueado'}`);
      await cargarUsuarios();
    } catch (error) {
      console.error('Error actualizando:', error);
      alert('Error al actualizar');
    }
  };

  // ✅ Guardar grados asignados Y tutorDe
  const guardarAsignacion = async () => {
    if (!selectedUserForGrados) return;
    
    try {
      await updateDoc(doc(db, 'usuarios', selectedUserForGrados.uid), {
        gradosAsignados: gradosSeleccionados,
        tutorDe: tutorDe,  // ✅ Guardar tutorDe
      });
      alert('✅ Asignación guardada correctamente');
      setShowGradosModal(false);
      setSelectedUserForGrados(null);
      setGradosSeleccionados([]);
      setTutorDe([]);
      await cargarUsuarios();
    } catch (error) {
      console.error('Error guardando asignación:', error);
      alert('Error al guardar asignación');
    }
  };

  // ✅ Cambiar rol del usuario
  const toggleRole = async (user: AppUser) => {
    const newRole = user.role === 'super_admin' ? 'docente' : 'super_admin';
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { role: newRole });
      alert(`✅ Rol cambiado a ${newRole}`);
      await cargarUsuarios();
    } catch (error) {
      console.error('Error cambiando rol:', error);
      alert('Error al cambiar rol');
    }
  };

  // ✅ Eliminar usuario
  const deleteUser = async (user: AppUser) => {
    if (!canDeleteUser(user)) {
      alert('❌ No tienes permisos para eliminar este usuario');
      return;
    }
    if (!confirm(`¿Eliminar a ${user.displayName}?`)) return;
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { status: 'deleted' });
      alert('✅ Usuario eliminado');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar');
    }
  };

  const filteredUsers = users.filter(u => u.status === filter);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      active: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      blocked: 'bg-gray-200 text-gray-700'
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      active: 'Activo',
      rejected: 'Rechazado',
      blocked: 'Bloqueado'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    if (role === 'super_admin') {
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Super Admin</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Docente</span>;
  };

  const counts = {
    pending: users.filter(u => u.status === 'pending').length,
    active: users.filter(u => u.status === 'active').length,
    blocked: users.filter(u => u.status === 'blocked').length,
    rejected: users.filter(u => u.status === 'rejected').length
  };

  if (loading) {
    return (
      <Layout title="Gestión de Usuarios" subtitle="Administra usuarios del sistema" showBack>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Gestión de Usuarios" subtitle={`${users.length} usuarios registrados`} showBack>
      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: 'pending', label: 'Pendientes', icon: FaClock, count: counts.pending },
          { key: 'active', label: 'Activos', icon: FaCheckCircle, count: counts.active },
          { key: 'blocked', label: 'Bloqueados', icon: FaShieldAlt, count: counts.blocked },
          { key: 'rejected', label: 'Rechazados', icon: FaTimesCircle, count: counts.rejected }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filter === tab.key 
                ? 'bg-blue-600 text-white shadow' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === tab.key ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de usuarios */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <FaUsers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No hay usuarios {filter === 'pending' ? 'pendientes' : 'en esta categoría'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div key={user.uid} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName} 
                    className="w-12 h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {user.displayName?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{user.displayName}</h3>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.status)}
                  </div>
                  
                  {/* ✅ Mostrar grados asignados */}
                  {user.status === 'active' && user.gradosAsignados && user.gradosAsignados.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.gradosAsignados.map(gradoId => {
                        const grado = grados.find(g => g.id === gradoId);
                        const esTutor = user.tutorDe?.includes(gradoId);
                        return grado ? (
                          <span 
                            key={gradoId} 
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              esTutor 
                                ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {esTutor && <FaUserTie className="w-3 h-3" />}
                            <FaGraduationCap className="w-3 h-3" />
                            {grado.nombre} - {grado.paralelo}
                            {esTutor && <span className="font-semibold">(Tutor)</span>}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  
                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {user.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => updateStatus(user.uid, 'active')}
                          className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                        >
                          <FaUserCheck className="w-4 h-4" />Aprobar
                        </button>
                        <button 
                          onClick={() => updateStatus(user.uid, 'rejected')}
                          className="inline-flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                        >
                          <FaUserTimes className="w-4 h-4" />Rechazar
                        </button>
                      </>
                    )}
                    {user.status === 'active' && (
                      <>
                        <button 
                          onClick={() => {
                            setSelectedUserForGrados(user);
                            setGradosSeleccionados(user.gradosAsignados || []);
                            setTutorDe(user.tutorDe || []);
                            setShowGradosModal(true);
                          }}
                          className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                        >
                          <FaPlus className="w-4 h-4" />Editar Asignación
                        </button>
                        <button 
                          onClick={() => updateStatus(user.uid, 'blocked')}
                          className="inline-flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                        >
                          <FaShieldAlt className="w-4 h-4" />Bloquear
                        </button>
                        <button 
                          onClick={() => toggleRole(user)}
                          className="inline-flex items-center gap-1 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                        >
                          {user.role === 'super_admin' ? (
                            <><FaShieldAlt className="w-4 h-4" />Quitar super_admin</>
                          ) : (
                            <><FaShieldAlt className="w-4 h-4" />Hacer super_admin</>
                          )}
                        </button>
                      </>
                    )}
                    {user.status === 'blocked' && (
                      <button 
                        onClick={() => updateStatus(user.uid, 'active')}
                        className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        <FaUserCheck className="w-4 h-4" />Desbloquear
                      </button>
                    )}
                    {user.status === 'rejected' && (
                      <button 
                        onClick={() => updateStatus(user.uid, 'active')}
                        className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        <FaUserCheck className="w-4 h-4" />Aprobar
                      </button>
                    )}
                    {canDeleteUser(user) && (
                      <button 
                        onClick={() => deleteUser(user)}
                        className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                      >
                        <FaTrash className="w-4 h-4" />Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ Modal para asignar grados Y tutor */}
      {showGradosModal && selectedUserForGrados && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h3 className="text-white text-lg font-bold">
                Asignar Grados a {selectedUserForGrados.displayName}
              </h3>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* SECCIÓN 1: Grados donde da clases */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <FaGraduationCap className="text-blue-600" />
                  📚 Grados donde da clases
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  Selecciona los grados donde este docente impartirá clases
                </p>
                <div className="space-y-2">
                  {grados.map(grado => {
                    const isSelected = gradosSeleccionados.includes(grado.id);
                    return (
                      <label
                        key={grado.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGradosSeleccionados([...gradosSeleccionados, grado.id]);
                            } else {
                              setGradosSeleccionados(gradosSeleccionados.filter(id => id !== grado.id));
                              // Si quita el grado de clases, también quitarlo de tutor
                              setTutorDe(tutorDe.filter(id => id !== grado.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <FaGraduationCap className="text-blue-600" />
                        <span className="font-semibold text-gray-900">{grado.nombre} - {grado.paralelo}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 2: Grados donde es TUTOR */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <FaUserTie className="text-purple-600" />
                  👨‍🏫 Grados donde es TUTOR
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  El tutor puede crear, editar y gestionar estudiantes de estos grados
                </p>
                <div className="space-y-2">
                  {grados
                    .filter(g => gradosSeleccionados.includes(g.id))
                    .map(grado => {
                      const isTutor = tutorDe.includes(grado.id);
                      return (
                        <label
                          key={grado.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                            isTutor 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isTutor}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTutorDe([...tutorDe, grado.id]);
                              } else {
                                setTutorDe(tutorDe.filter(id => id !== grado.id));
                              }
                            }}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                          <FaUserTie className="text-purple-600" />
                          <span className="font-semibold text-gray-900">{grado.nombre} - {grado.paralelo}</span>
                          {isTutor && <span className="text-xs text-purple-700 font-medium ml-auto">← Tutor</span>}
                        </label>
                      );
                    })}
                  {gradosSeleccionados.length === 0 && (
                    <p className="text-sm text-slate-400 italic">
                      Primero selecciona grados donde da clases
                    </p>
                  )}
                </div>
              </div>

              {/* Advertencia */}
              {gradosSeleccionados.length === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Si no seleccionas ningún grado, el usuario no podrá ver nada en su panel.
                  </p>
                </div>
              )}
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={guardarAsignacion}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Guardar Asignación
              </button>
              <button
                onClick={() => {
                  setShowGradosModal(false);
                  setSelectedUserForGrados(null);
                  setGradosSeleccionados([]);
                  setTutorDe([]);
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Los usuarios nuevos aparecen en "Pendientes". 
          Al aprobarlos, podrás asignarles los grados donde darán clases y marcar cuáles serán tutor.
          Un docente puede ser tutor de uno o más grados.
        </p>
      </div>
    </Layout>
  );
}