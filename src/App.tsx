import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./lib/firebase";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import type { ReactNode } from "react";

// Componentes de páginas
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Calificaciones from "./pages/Calificaciones";
import RefuerzoPedagogico from "./pages/RefuerzoPedagogico";
import PPE from "./pages/PPE";
import AniosLectivos from "./pages/AniosLectivos";
import Grados from "./pages/Grados";
import Estudiantes from "./pages/Estudiantes";
import AmbitosDestrezas from "./pages/AmbitosDestrezas";
import Reportes from "./pages/Reportes";
import ConfiguracionInstitucional from "./pages/ConfiguracionInstitucional";
import GestionUsuarios from "./pages/GestionUsuarios";
import Configuracion from "./pages/Configuracion";
import PendingApproval from "./pages/PendingApproval";
import MiHorario from "./pages/MiHorario";
import ReporteAsistencias from "./pages/ReporteAsistencias";
import ReporteNotas from "./pages/ReporteNotas";
import ArchivedAccount from "./pages/ArchivedAccount";
import MigracionAsistencia from "./pages/MigracionAsistencia";
import EnMantenimiento from "./pages/EnMantenimiento";
import GestionMateriasDocentes from "./pages/GestionMateriasDocentes";

// Formulario público y panel de administración
import Matricula from "./pages/Matricula";
import Matriculas from "./pages/Matriculas";

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, userData, loading } = useAuth();

  // Configuración de mantenimiento, sincronizada en tiempo real desde Firestore.
  const [mantenimiento, setMantenimiento] = useState(false);
  const [datosMantenimiento, setDatosMantenimiento] = useState<{
    titulo?: string;
    mensaje?: string;
  }>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "configuracion", "sistema"),
      (snapshot) => {
        const data = snapshot.data();
        setMantenimiento(data?.mantenimiento === true);
        setDatosMantenimiento({
          titulo: data?.tituloMantenimiento || "",
          mensaje: data?.mensajeMantenimiento || "",
        });
      },
      (error) => {
        console.warn(
          "No se pudo leer configuración de sistema:",
          error.message,
        );
        setMantenimiento(false);
      },
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
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
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            Verificando usuario...
          </p>
        </div>
      </div>
    );
  }

  if (userData.status === "pending") {
    return <PendingApproval />;
  }

  if (userData.status === "rejected" || userData.status === "blocked") {
    alert(
      "Tu cuenta ha sido rechazada o bloqueada. Contacta al administrador.",
    );
    return <Navigate to="/login" replace />;
  }

  if (userData.status === "deleted") {
    return <ArchivedAccount />;
  }

  // El superadministrador puede acceder durante el mantenimiento.
  if (mantenimiento && userData.role !== "super_admin") {
    return (
      <EnMantenimiento
        titulo={datosMantenimiento.titulo || undefined}
        mensaje={datosMantenimiento.mensaje || undefined}
      />
    );
  }

  if (userData.status === "active") {
    // Los usuarios activos cargan los datos maestros mediante DataProvider.
    return <DataProvider>{children}</DataProvider>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
        <p className="text-slate-600 font-medium">Procesando...</p>
      </div>
    </div>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { userData } = useAuth();

  if (!userData || userData.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Ruta de login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Ruta pública: formulario de matrícula */}
      <Route path="/matricula" element={<Matricula />} />

      {/* Rutas protegidas */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/anios-lectivos"
        element={
          <PrivateRoute>
            <AniosLectivos />
          </PrivateRoute>
        }
      />
      <Route
        path="/grados"
        element={
          <PrivateRoute>
            <Grados />
          </PrivateRoute>
        }
      />
      <Route
        path="/estudiantes"
        element={
          <PrivateRoute>
            <Estudiantes />
          </PrivateRoute>
        }
      />
      <Route
        path="/ambitos-destrezas"
        element={
          <PrivateRoute>
            <AmbitosDestrezas />
          </PrivateRoute>
        }
      />
      <Route
        path="/mi-horario"
        element={
          <PrivateRoute>
            <MiHorario />
          </PrivateRoute>
        }
      />
      <Route
        path="/calificaciones"
        element={
          <PrivateRoute>
            <Calificaciones />
          </PrivateRoute>
        }
      />
      <Route
        path="/refuerzo-pedagogico"
        element={
          <PrivateRoute>
            <RefuerzoPedagogico />
          </PrivateRoute>
        }
      />

      {/* Nueva ruta: Programa de Participación Estudiantil */}
      <Route
        path="/ppe"
        element={
          <PrivateRoute>
            <PPE />
          </PrivateRoute>
        }
      />

      <Route
        path="/reporte-asistencias"
        element={
          <PrivateRoute>
            <ReporteAsistencias />
          </PrivateRoute>
        }
      />
      <Route
        path="/reporte-notas"
        element={
          <PrivateRoute>
            <ReporteNotas />
          </PrivateRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <PrivateRoute>
            <Reportes />
          </PrivateRoute>
        }
      />

      {/* Perfil personal */}
      <Route
        path="/configuracion"
        element={
          <PrivateRoute>
            <Configuracion />
          </PrivateRoute>
        }
      />

      {/* Panel de gestión de matrículas: solo super_admin */}
      <Route
        path="/matriculas"
        element={
          <PrivateRoute>
            <AdminRoute>
              <Matriculas />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      {/* Rutas administrativas: solo super_admin */}
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
      <Route
        path="/gestion-materias"
        element={
          <PrivateRoute>
            <AdminRoute>
              <GestionMateriasDocentes />
            </AdminRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/migracion-asistencia"
        element={
          <PrivateRoute>
            <AdminRoute>
              <MigracionAsistencia />
            </AdminRoute>
          </PrivateRoute>
        }
      />

      {/* Pantalla para usuarios pendientes */}
      <Route path="/pending-approval" element={<PendingApproval />} />

      {/* Ruta comodín */}
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
