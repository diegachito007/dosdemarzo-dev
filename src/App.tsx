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
// ✅ Nuevos imports
import ConfiguracionInstitucional from './pages/ConfiguracionInstitucional';
import GestionUsuarios from './pages/GestionUsuarios';
import Configuracion from './pages/Configuracion';
import PendingApproval from './pages/PendingApproval';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, userData, loading } = useAuth();
  
  if (loading) return <div className="p-8 text-center">Cargando...</div>;
  
  // Si no hay usuario, ir al login
  if (!user) return <Navigate to="/login" />;
  
  // Si el usuario está pendiente, ir a pantalla de espera
  if (userData?.status === 'pending') return <PendingApproval />;
  
  // Si está rechazado o bloqueado
  if (userData?.status === 'rejected' || userData?.status === 'blocked') {
    alert('Tu cuenta ha sido rechazada o bloqueada. Contacta al administrador.');
    return <Navigate to="/login" />;
  }

  return children;
}

// ✅ Componente para rutas protegidas por rol
function AdminRoute({ children }: { children: ReactNode }) {
  const { userData } = useAuth();
  
  if (userData?.role !== 'super_admin') {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      
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
        element={
          <PrivateRoute>
            <Configuracion />
          </PrivateRoute>
        } 
      />
      
      {/* ✅ Rutas solo para super_admin */}
      <Route 
        path="/configuracion-institucional" 
        element={
          <PrivateRoute>
            <AdminRoute>
              <ConfiguracionInstitucional />
            </AdminRoute>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/gestion-usuarios" 
        element={
          <PrivateRoute>
            <AdminRoute>
              <GestionUsuarios />
            </AdminRoute>
          </PrivateRoute>
        } 
      />
      
      <Route path="*" element={<Navigate to="/" />} />
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