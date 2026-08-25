import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { SolicitudMatricula, Grado, AnioLectivo } from "../types";
import Layout from "../components/Layout";
import {
  FaCheck,
  FaTimes,
  FaSearch,
  FaCalendarAlt,
  FaUserGraduate,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaPlus,
} from "react-icons/fa";

export default function Matriculas() {
  useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudMatricula[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    "todas" | "pendiente" | "aprobada" | "rechazada"
  >("pendiente");

  const anioActivo = aniosLectivos.find((a) => a.activo);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const qAnios = query(
          collection(db, "aniosLectivos"),
          where("activo", "==", true),
        );
        const snapAnios = await getDocs(qAnios);
        setAniosLectivos(
          snapAnios.docs.map((d) => ({ id: d.id, ...d.data() }) as AnioLectivo),
        );

        const qGrados = query(
          collection(db, "grados"),
          where("activo", "==", true),
        );
        const snapGrados = await getDocs(qGrados);
        setGrados(
          snapGrados.docs.map((d) => ({ id: d.id, ...d.data() }) as Grado),
        );

        let qSolicitudes;
        if (filtroEstado === "todas") {
          qSolicitudes = query(
            collection(db, "solicitudesMatriculas"),
            orderBy("fechaSolicitud", "desc"),
          );
        } else {
          qSolicitudes = query(
            collection(db, "solicitudesMatriculas"),
            where("estado", "==", filtroEstado),
            orderBy("fechaSolicitud", "desc"),
          );
        }

        const snapSolicitudes = await getDocs(qSolicitudes);
        setSolicitudes(
          snapSolicitudes.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as SolicitudMatricula,
          ),
        );
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filtroEstado]);

  const handleAprobar = async (solicitud: SolicitudMatricula) => {
    if (
      !confirm(
        `¿Aprobar la matrícula de ${solicitud.estudiante.nombres} ${solicitud.estudiante.apellidos}?`,
      )
    )
      return;

    try {
      // ✅ Crear objeto del estudiante evitando 'any' y 'undefined'
      const estudianteData = {
        cedula: solicitud.estudiante.cedula,
        apellidos: solicitud.estudiante.apellidos,
        nombres: solicitud.estudiante.nombres,
        fechaNacimiento: solicitud.estudiante.fechaNacimiento || "",
        nacionalidad: solicitud.estudiante.nacionalidad || "",
        etnia: solicitud.estudiante.etnia || "",
        direccion: solicitud.estudiante.direccion || "",
        celular: solicitud.estudiante.celular || "",
        representantePrincipalId: solicitud.representantePrincipalId,
        fichaMatricula: solicitud.fichaMatricula,
        gradoId: solicitud.gradoSolicitado,
        anioLectivoId: anioActivo?.id || "",
        activo: true,
        createdAt: serverTimestamp(),
        // ✅ Solo incluir representanteSecundarioId si existe (evita undefined)
        ...(solicitud.representanteSecundarioId
          ? { representanteSecundarioId: solicitud.representanteSecundarioId }
          : {}),
      };

      // 1. Crear el estudiante en la colección principal
      await addDoc(collection(db, "estudiantes"), estudianteData);

      // 2. Actualizar el estado de la solicitud
      await updateDoc(doc(db, "solicitudesMatriculas", solicitud.id), {
        estado: "aprobada",
      });

      alert("✅ Matrícula aprobada y estudiante registrado correctamente.");

      // Recargar solo las solicitudes para actualizar la tabla
      const qSolicitudes = query(
        collection(db, "solicitudesMatriculas"),
        where("estado", "==", filtroEstado),
        orderBy("fechaSolicitud", "desc"),
      );
      const snapSolicitudes = await getDocs(qSolicitudes);
      setSolicitudes(
        snapSolicitudes.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SolicitudMatricula,
        ),
      );
    } catch (error) {
      console.error("Error aprobando matrícula:", error);
      alert("❌ Error al aprobar la matrícula.");
    }
  };

  const handleRechazar = async (solicitud: SolicitudMatricula) => {
    if (
      !confirm(
        `¿Rechazar la matrícula de ${solicitud.estudiante.nombres} ${solicitud.estudiante.apellidos}?`,
      )
    )
      return;

    try {
      await updateDoc(doc(db, "solicitudesMatriculas", solicitud.id), {
        estado: "rechazada",
      });
      alert("Solicitud rechazada.");

      const qSolicitudes = query(
        collection(db, "solicitudesMatriculas"),
        where("estado", "==", filtroEstado),
        orderBy("fechaSolicitud", "desc"),
      );
      const snapSolicitudes = await getDocs(qSolicitudes);
      setSolicitudes(
        snapSolicitudes.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SolicitudMatricula,
        ),
      );
    } catch (error) {
      console.error("Error rechazando matrícula:", error);
      alert("❌ Error al rechazar la solicitud.");
    }
  };

  const getNombreGrado = (gradoId: string) => {
    const grado = grados.find((g) => g.id === gradoId);
    return grado
      ? `${grado.nombre} - ${grado.paralelo}`
      : "Grado no encontrado";
  };

  const solicitudesFiltradas = solicitudes.filter((sol) => {
    const search = searchTerm.toLowerCase();
    return (
      sol.estudiante.nombres.toLowerCase().includes(search) ||
      sol.estudiante.apellidos.toLowerCase().includes(search) ||
      sol.estudiante.cedula.includes(search) ||
      sol.codigoSeguimiento.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <Layout
        title="Matrículas"
        subtitle="Gestiona las solicitudes de matrícula"
        showBack
      >
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Matrículas"
      subtitle="Gestiona las solicitudes de matrícula"
      showBack
      action={
        <button
          onClick={() => window.open("/matricula", "_blank")}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
          title="Abrir formulario de matrícula en nueva pestaña"
        >
          <FaPlus className="text-sm" />
          Nueva Matrícula
        </button>
      }
    >
      {anioActivo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <FaCalendarAlt className="text-sm" />
            <span className="text-sm font-medium">Año lectivo activo:</span>
            <span className="text-base font-bold text-blue-900">
              {anioActivo.nombre}
            </span>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cédula o código..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={(e) =>
              setFiltroEstado(
                e.target.value as
                  | "todas"
                  | "pendiente"
                  | "aprobada"
                  | "rechazada",
              )
            }
            className="border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Solicitudes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Código
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Estudiante
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Grado Solicitado
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                  Tipo
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                  Estado
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {solicitudesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <FaUserGraduate className="text-4xl text-slate-300 mb-3" />
                      <p className="text-slate-600 font-medium">
                        No hay solicitudes de matrícula
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                solicitudesFiltradas.map((sol) => (
                  <tr
                    key={sol.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {sol.codigoSeguimiento}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900 text-sm">
                        {sol.estudiante.apellidos} {sol.estudiante.nombres}
                      </div>
                      <div className="text-slate-500 text-xs">
                        CI: {sol.estudiante.cedula}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-slate-700">
                        {getNombreGrado(sol.gradoSolicitado)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sol.tipo === "renovacion"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {sol.tipo === "renovacion" ? "Renovación" : "Nuevo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          sol.estado === "pendiente"
                            ? "bg-yellow-100 text-yellow-800"
                            : sol.estado === "aprobada"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {sol.estado === "pendiente" && (
                          <FaClock className="w-3 h-3" />
                        )}
                        {sol.estado === "aprobada" && (
                          <FaCheckCircle className="w-3 h-3" />
                        )}
                        {sol.estado === "rechazada" && (
                          <FaTimesCircle className="w-3 h-3" />
                        )}
                        {sol.estado.charAt(0).toUpperCase() +
                          sol.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {sol.estado === "pendiente" && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleAprobar(sol)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all"
                            title="Aprobar Matrícula"
                          >
                            <FaCheck className="text-sm" />
                          </button>
                          <button
                            onClick={() => handleRechazar(sol)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                            title="Rechazar Matrícula"
                          >
                            <FaTimes className="text-sm" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
