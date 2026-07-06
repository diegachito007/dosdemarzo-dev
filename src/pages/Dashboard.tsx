import { useState, useEffect, useCallback, startTransition } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  FaGraduationCap,
  FaUsers,
  FaBook,
  FaChartBar,
  FaCalendarAlt,
  FaSignOutAlt,
  FaTrophy,
  FaClipboardList,
} from "react-icons/fa";

export default function Dashboard() {
  const { user, logout } = useAuth();

  // ✅ Estados para stats dinámicos
  const [stats, setStats] = useState({
    aniosActivos: 0,
    gradosActivos: 0,
    estudiantesActivos: 0,
    ambitos: 0,
    calificaciones: 0,
  });

  // ✅ Cargar estadísticas reales
  const cargarStats = useCallback(async () => {
    try {
      // Años activos
      const aniosQuery = query(
        collection(db, "aniosLectivos"),
        where("activo", "==", true),
      );
      const aniosSnap = await getDocs(aniosQuery);

      // Grados activos
      const gradosQuery = query(
        collection(db, "grados"),
        where("activo", "==", true),
      );
      const gradosSnap = await getDocs(gradosQuery);

      // Estudiantes activos
      const estudiantesQuery = query(
        collection(db, "estudiantes"),
        where("activo", "==", true),
      );
      const estudiantesSnap = await getDocs(estudiantesQuery);

      // Ámbitos (todos)
      const ambitosSnap = await getDocs(collection(db, "ambitos"));

      // Calificaciones (todas)
      const calificacionesSnap = await getDocs(
        collection(db, "calificaciones"),
      );

      // ✅ Envolver setStats en startTransition
      startTransition(() => {
        setStats({
          aniosActivos: aniosSnap.size,
          gradosActivos: gradosSnap.size,
          estudiantesActivos: estudiantesSnap.size,
          ambitos: ambitosSnap.size,
          calificaciones: calificacionesSnap.size,
        });
      });
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  }, []);

  useEffect(() => {
    cargarStats();
  }, [cargarStats]);

  // ✅ Módulos ordenados por jerarquía lógica
  const modules = [
    {
      path: "/anios-lectivos",
      name: "Años Lectivos",
      icon: FaCalendarAlt,
      color: "from-pink-500 to-pink-600",
      desc: "Base del sistema: periodos académicos",
      stats: `${stats.aniosActivos} activo${stats.aniosActivos !== 1 ? "s" : ""}`,
      badge: "BASE",
    },
    {
      path: "/grados",
      name: "Grados",
      icon: FaGraduationCap,
      color: "from-blue-500 to-blue-600",
      desc: "Niveles educativos y paralelos",
      stats: `${stats.gradosActivos} activo${stats.gradosActivos !== 1 ? "s" : ""}`,
      badge: "NIVEL 2",
    },
    {
      path: "/estudiantes",
      name: "Estudiantes",
      icon: FaUsers,
      color: "from-green-500 to-green-600",
      desc: "Matrícula de alumnos",
      stats: `${stats.estudiantesActivos} activo${stats.estudiantesActivos !== 1 ? "s" : ""}`,
      badge: "NIVEL 3",
    },
    {
      path: "/ambitos-destrezas",
      name: "Ámbitos y Destrezas",
      icon: FaBook,
      color: "from-purple-500 to-purple-600",
      desc: "Competencias y destrezas",
      stats: `${stats.ambitos} ámbito${stats.ambitos !== 1 ? "s" : ""}`,
      badge: "NIVEL 3",
    },
    {
      path: "/calificaciones",
      name: "Calificaciones",
      icon: FaChartBar,
      color: "from-orange-500 to-orange-600",
      desc: "Registro de notas",
      stats: `${stats.calificaciones} registro${stats.calificaciones !== 1 ? "s" : ""}`,
      badge: "NIVEL 4",
    },
    {
      path: "/reportes",
      name: "Reportes",
      icon: FaClipboardList,
      color: "from-teal-500 to-teal-600",
      desc: "Informes y estadísticas",
      stats: "Próximamente",
      badge: "NIVEL 5",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-linear-to-br from-blue-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <FaTrophy className="text-white text-3xl" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Sistema de Calificaciones
                </h1>
                <p className="text-slate-600 text-sm">
                  Gestión educativa integral
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-xl border border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user?.displayName}
                </p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <img
                src={user?.photoURL || "https://via.placeholder.com/150"}
                alt="avatar"
                className="w-12 h-12 rounded-full border-2 border-blue-500 shadow-md"
              />
              <button
                onClick={logout}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Cerrar sesión"
              >
                <FaSignOutAlt className="text-xl" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Bienvenida */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            ¡Bienvenido, {user?.displayName?.split(" ")[0] || "Usuario"}! 👋
          </h2>
          <p className="text-slate-600">
            Selecciona un módulo para comenzar a gestionar
          </p>
        </div>

        {/* Grid de Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <Link
              key={mod.path}
              to={mod.path}
              className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-slate-200 hover:border-transparent transform hover:-translate-y-1"
            >
              {/* Gradiente superior */}
              <div className={`h-2 bg-linear-to-r ${mod.color}`} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-xl bg-linear-to-br ${mod.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                  >
                    <mod.icon className="text-white text-2xl" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {mod.badge}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                      {mod.stats}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                  {mod.name}
                </h3>
                <p className="text-slate-600 text-sm mb-4">{mod.desc}</p>

                <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-2 transition-transform">
                  Acceder
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {/* Efecto hover */}
              <div
                className={`absolute inset-0 bg-linear-to-br ${mod.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
              />
            </Link>
          ))}
        </div>

        {/* Stats Rápidas */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-100 rounded-lg">
                <FaCalendarAlt className="text-pink-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.aniosActivos}
                </p>
                <p className="text-sm text-slate-600">Años Activos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaGraduationCap className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.gradosActivos}
                </p>
                <p className="text-sm text-slate-600">Grados Activos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaUsers className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.estudiantesActivos}
                </p>
                <p className="text-sm text-slate-600">Estudiantes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaBook className="text-purple-600 text-xl" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.ambitos}
                </p>
                <p className="text-sm text-slate-600">Ámbitos</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-600 text-sm">
          <p>
            © 2026 Sistema de Calificaciones - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}
