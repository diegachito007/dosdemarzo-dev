import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { ReactNode } from 'react';

// Componentes de páginas
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
import MiHorario from './pages/MiHorario'; // ✅ NUEVO: Mi Horario

// ✅ NUEVOS: Formulario público y Panel de administración
import Matricula from './pages/Matricula';       // Formulario público (sin login)
import Matriculas from './pages/Matriculas';     // Panel de administración (solo super_admin)

// ✅ RUTA PRIVADA CORREGIDA (Fail-Closed)
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, userData, loading } = useAuth();

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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

  if (userData.status === 'pending') {
    return <PendingApproval />;
  }

  if (userData.status === 'rejected' || userData.status === 'blocked') {
    alert('Tu cuenta ha sido rechazada o bloqueada. Contacta al administrador.');
    return <Navigate to="/login" replace />;
  }

  if (userData.status === 'active') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3"></div>
        <p className="text-slate-600 font-medium">Procesando...</p>
      </div>
    </div>
  );
}

// ✅ Componente para rutas protegidas exclusivamente por rol (Super Admin)
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
      {/* Ruta de Login */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      {/* ✅ 1. RUTA PÚBLICA: Formulario de Matrícula (NO requiere PrivateRoute) */}
      <Route path="/matricula" element={<Matricula />} />
      
      {/* Rutas protegidas (requieren login + estado 'active') */}
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/anios-lectivos" element={<PrivateRoute><AniosLectivos /></PrivateRoute>} />
      <Route path="/grados" element={<PrivateRoute><Grados /></PrivateRoute>} />
      <Route path="/estudiantes" element={<PrivateRoute><Estudiantes /></PrivateRoute>} />
      <Route path="/ambitos-destrezas" element={<PrivateRoute><AmbitosDestrezas /></PrivateRoute>} />
      <Route path="/mi-horario" element={<PrivateRoute><MiHorario /></PrivateRoute>} /> {/* ✅ NUEVA RUTA */}
      <Route path="/calificaciones" element={<PrivateRoute><Calificaciones /></PrivateRoute>} />
      <Route path="/reportes" element={<PrivateRoute><Reportes /></PrivateRoute>} />
      
      {/* Perfil personal */}
      <Route path="/configuracion" element={<PrivateRoute><Configuracion /></PrivateRoute>} />
      
      {/* ✅ 2. RUTA ADMIN: Panel de Gestión de Matrículas (Solo super_admin) */}
      <Route 
        path="/matriculas" 
        element={
          <PrivateRoute>
            <AdminRoute><Matriculas /></AdminRoute>
          </PrivateRoute>
        } 
      />
      
      {/* Otras rutas solo para super_admin */}
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
      
      {/* Ruta de espera para pendientes/rechazados */}
      <Route path="/pending-approval" element={<PendingApproval />} />
      
      {/* Catch-all */}
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