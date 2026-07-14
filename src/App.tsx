import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { ReactNode } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Calificaciones from './pages/Calificaciones';
import AniosLectivos from './pages/AniosLectivos';
import Grados from './pages/Grados';
import Estudiantes from './pages/Estudiantes';
import AmbitosDestrezas from './pages/AmbitosDestrezas';
import Reportes from './pages/Reportes';
import ConfiguracionInstitucional from './pages/ConfiguracionInstitucional';
import GestionUsuarios from './pages/GestionUsuarios';
import Configuracion from './pages/Configuracion';
import PendingApproval from './pages/PendingApproval';

// ✅ RUTA PRIVADA CORREGIDA
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, userData, loading } = useAuth();

  // 1. Muestra loader mientras carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // 2. Si no hay usuario, al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si userData es null, espera un poco más
  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
          <p className="text-slate-600 font-medium">Verificando usuario...</p>
        </div>
      </div>
    );
  }

  // 4. Si el usuario está pendiente, ir a pantalla de espera
  if (userData.status === 'pending') {
    return <PendingApproval />;
  }

  // 5. Si está rechazado o bloqueado
  if (userData.status === 'rejected' || userData.status === 'blocked') {
    alert('Tu cuenta ha sido rechazada o bloqueada. Contacta al administrador.');
    return <Navigate to="/login" replace />;
  }

  // 6. Si está activo, permite el acceso
  if (userData.status === 'active') {
    return <>{children}</>;
  }

  // 7. Por defecto, muestra loader
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
        <p className="text-slate-600 font-medium">Procesando...</p>
      </div>
    </div>
  );
}

// ✅ Componente para rutas protegidas por rol
function AdminRoute({ children }: { children: ReactNode }) {
  const { userData } = useAuth();
  
  if (!userData || userData.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      {/* Rutas públicas (requieren login) */}
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/anios-lectivos" element={<PrivateRoute><AniosLectivos /></PrivateRoute>} />
      <Route path="/grados" element={<PrivateRoute><Grados /></PrivateRoute>} />
      <Route path="/estudiantes" element={<PrivateRoute><Estudiantes /></PrivateRoute>} />
      <Route path="/ambitos-destrezas" element={<PrivateRoute><AmbitosDestrezas /></PrivateRoute>} />
      <Route path="/calificaciones" element={<PrivateRoute><Calificaciones /></PrivateRoute>} />
      <Route path="/reportes" element={<PrivateRoute><Reportes /></PrivateRoute>} />
      
      {/* ✅ Perfil personal (todos los usuarios) */}
      <Route 
        path="/configuracion" 
        element={<PrivateRoute><Configuracion /></PrivateRoute>} 
      />
      
      {/* ✅ Rutas solo para super_admin */}
      <Route 
        path="/configuracion-institucional" 
        element={
          <PrivateRoute>
            <AdminRoute><ConfiguracionInstitucional /></AdminRoute>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/gestion-usuarios" 
        element={
          <PrivateRoute>
            <AdminRoute><GestionUsuarios /></AdminRoute>
          </PrivateRoute>
        } 
      />
      
      <Route path="/pending-approval" element={<PendingApproval />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}