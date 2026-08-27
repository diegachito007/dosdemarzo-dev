import { useState, useEffect, startTransition, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type {
  Estudiante,
  Grado,
  AnioLectivo,
  Ambito,
  Destreza,
  PeriodoEvaluacion,
} from "../types";
import Layout from "../components/Layout";
import {
  FaUserCheck,
  FaExclamationTriangle,
  FaTasks,
  FaCalendarAlt,
  FaClock,
  FaSave,
  FaSpinner,
  FaLock,
  FaGraduationCap,
  FaCheck,
  FaTimes,
  FaUndo,
} from "react-icons/fa";

interface AsistenciaData {
  estudianteId: string;
  gradoId: string;
  anioLectivoId: string;
  periodoId: string;
  fecha: string;
  estado: "P" | "T" | "A" | "J";
  observacion?: string;
  registradoPor?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

interface CalificacionData {
  estudianteId: string;
  destrezaId: string;
  ambitoId: string;
  gradoId: string;
  anioLectivoId: string;
  periodoId: string;
  nota: number;
  observacion?: string;
  docenteId?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// ✅ Función para convertir nota numérica a letra
const notaALetra = (nota: number): string => {
  if (nota >= 10) return "A+";
  if (nota === 9) return "A";
  if (nota === 8) return "B+";
  if (nota === 7) return "B";
  if (nota === 6) return "C+";
  if (nota === 5) return "C";
  if (nota === 4) return "D+";
  if (nota === 3) return "D";
  if (nota === 2) return "E+";
  if (nota === 1) return "E";
  return "-";
};

export default function Calificaciones() {
  const { user, userData } = useAuth();
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoEvaluacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<"asistencia" | "calificaciones">(
    "asistencia"
  );
  const [selectedGradoId, setSelectedGradoId] = useState("");
  const [selectedAmbitoId, setSelectedAmbitoId] = useState("");
  const [selectedDestrezaId, setSelectedDestrezaId] = useState("");

  const [fechaAsistencia, setFechaAsistencia] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [asistencias, setAsistencias] = useState<
    Record<string, { estado: "P" | "T" | "A" | "J"; observacion: string }>
  >({});
  const [calificaciones, setCalificaciones] = useState<
    Record<string, { nota: number; observacion: string }>
  >({});

  const periodoActual = periodos.find((p) => {
    const hoy = new Date();
    const inicio = new Date(p.fechaInicio);
    const fin = new Date(p.fechaFin);
    return hoy >= inicio && hoy <= fin;
  });

  const todosConAsistencia =
    estudiantes.length > 0 &&
    estudiantes.every((est) => asistencias[est.id]?.estado);

  // ✅ Verificar si es docente sin grados asignados
  const docenteSinGrados =
    userData?.role === "docente" &&
    (!userData?.gradosAsignados || userData.gradosAsignados.length === 0);

  // ✅ Obtener año lectivo activo
  const anioActivo = aniosLectivos.find((a) => a.activo);

  const cargarDatos = useCallback(async () => {
    try {
      const aniosQuery = query(
        collection(db, "aniosLectivos"),
        where("activo", "==", true)
      );
      const aniosSnap = await getDocs(aniosQuery);
      const aniosData = aniosSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as AnioLectivo
      );

      let periodosData: PeriodoEvaluacion[] = [];
      if (aniosData.length > 0) {
        const periodosQuery = query(
          collection(db, "periodosEvaluacion"),
          where("anioLectivoId", "==", aniosData[0].id),
          orderBy("orden", "asc")
        );
        const periodosSnap = await getDocs(periodosQuery);
        periodosData = periodosSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as PeriodoEvaluacion
        );
      }

      // ✅ FILTRAR GRADOS SEGÚN ROL
      let gradosQuery;
      if (
        userData?.role === "docente" &&
        userData?.gradosAsignados &&
        userData.gradosAsignados.length > 0
      ) {
        gradosQuery = query(
          collection(db, "grados"),
          where("__name__", "in", userData.gradosAsignados),
          where("activo", "==", true),
          orderBy("orden", "asc")
        );
      } else if (userData?.role === "docente") {
        startTransition(() => {
          setAniosLectivos(aniosData);
          setPeriodos(periodosData);
          setGrados([]);
          setLoading(false);
        });
        return;
      } else {
        gradosQuery = query(
          collection(db, "grados"),
          where("activo", "==", true),
          orderBy("orden", "asc")
        );
      }

      const gradosSnap = await getDocs(gradosQuery);
      const gradosData = gradosSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Grado
      );

      startTransition(() => {
        setAniosLectivos(aniosData);
        setPeriodos(periodosData);
        setGrados(gradosData);
        if (gradosData.length > 0 && !selectedGradoId) {
          setSelectedGradoId(gradosData[0].id);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando datos:", error);
      startTransition(() => setLoading(false));
    }
  }, [selectedGradoId, userData]);

  const cargarEstudiantes = useCallback(async (gradoId: string) => {
    try {
      const q = query(
        collection(db, "estudiantes"),
        where("gradoId", "==", gradoId),
        where("activo", "==", true),
        orderBy("apellidos", "asc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Estudiante
      );

      startTransition(() => {
        setEstudiantes(data);
        setAsistencias({});
        setActiveTab("asistencia");
      });
    } catch (error) {
      console.error("Error cargando estudiantes:", error);
    }
  }, []);

  const cargarAmbitos = useCallback(async (gradoId: string) => {
    try {
      const q = query(
        collection(db, "ambitos"),
        where("gradoId", "==", gradoId),
        where("activo", "==", true),
        orderBy("orden", "asc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Ambito
      );

      startTransition(() => setAmbitos(data));
    } catch (error) {
      console.error("Error cargando ámbitos:", error);
    }
  }, []);

  const cargarDestrezas = useCallback(async (ambitoId: string) => {
    try {
      const q = query(
        collection(db, "destrezas"),
        where("ambitoId", "==", ambitoId),
        where("activo", "==", true),
        orderBy("orden", "asc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Destreza
      );

      startTransition(() => setDestrezas(data));
    } catch (error) {
      console.error("Error cargando destrezas:", error);
    }
  }, []);

  const cargarAsistencias = useCallback(
    async (gradoId: string, fecha: string) => {
      try {
        const estudiantesDelGrado = estudiantes.filter(
          (e) => e.gradoId === gradoId
        );
        const estudianteIds = estudiantesDelGrado.map((e) => e.id);

        if (estudianteIds.length === 0) return;

        const q = query(
          collection(db, "asistencias"),
          where("gradoId", "==", gradoId),
          where("fecha", "==", fecha)
        );
        const snap = await getDocs(q);

        const data = snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as unknown as AsistenciaData
        );

        const asistenciasMap: Record<
          string,
          { estado: "P" | "T" | "A" | "J"; observacion: string }
        > = {};
        data.forEach((asistencia) => {
          asistenciasMap[asistencia.estudianteId] = {
            estado: asistencia.estado,
            observacion: asistencia.observacion || "",
          };
        });

        startTransition(() => setAsistencias(asistenciasMap));
      } catch (error) {
        console.error("Error cargando asistencias:", error);
      }
    },
    [estudiantes]
  );

  const cargarCalificaciones = useCallback(
    async (destrezaId: string, gradoId: string) => {
      try {
        const periodoId = periodoActual?.id || "";
        if (!periodoId) return;

        const q = query(
          collection(db, "calificaciones"),
          where("destrezaId", "==", destrezaId),
          where("gradoId", "==", gradoId),
          where("periodoId", "==", periodoId)
        );
        const snap = await getDocs(q);

        const data = snap.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as unknown as CalificacionData
        );

        const calificacionesMap: Record<
          string,
          { nota: number; observacion: string }
        > = {};
        data.forEach((calificacion) => {
          calificacionesMap[calificacion.estudianteId] = {
            nota: calificacion.nota,
            observacion: calificacion.observacion || "",
          };
        });

        startTransition(() => setCalificaciones(calificacionesMap));
      } catch (error) {
        console.error("Error cargando calificaciones:", error);
      }
    },
    [periodoActual]
  );

  const guardarAsistencia = async () => {
    setIsSaving(true);
    try {
      const anioLectivoId = aniosLectivos[0]?.id || "";
      const periodoId = periodoActual?.id || "";

      const batch = estudiantes.map(async (est) => {
        const asistencia = asistencias[est.id];
        if (!asistencia || !asistencia.estado) return;

        const q = query(
          collection(db, "asistencias"),
          where("estudianteId", "==", est.id),
          where("fecha", "==", fechaAsistencia)
        );
        const snap = await getDocs(q);

        const datos = {
          estudianteId: est.id,
          gradoId: selectedGradoId,
          anioLectivoId,
          periodoId,
          fecha: fechaAsistencia,
          estado: asistencia.estado,
          observacion: asistencia.observacion || "",
          registradoPor: user?.uid || "",
          updatedAt: serverTimestamp(),
        };

        if (snap.empty) {
          await addDoc(collection(db, "asistencias"), {
            ...datos,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, "asistencias", snap.docs[0].id), datos);
        }
      });

      await Promise.all(batch);
      alert("✅ Asistencia guardada correctamente");
      setActiveTab("calificaciones");
    } catch (error) {
      console.error("Error guardando asistencia:", error);
      alert("Error al guardar asistencia");
    } finally {
      setIsSaving(false);
    }
  };

  const guardarCalificaciones = async () => {
    setIsSaving(true);
    try {
      const anioLectivoId = aniosLectivos[0]?.id || "";
      const periodoId = periodoActual?.id || "";

      const batch = estudiantes.map(async (est) => {
        const calificacion = calificaciones[est.id];
        if (!calificacion || calificacion.nota === undefined) return;

        const q = query(
          collection(db, "calificaciones"),
          where("estudianteId", "==", est.id),
          where("destrezaId", "==", selectedDestrezaId),
          where("periodoId", "==", periodoId)
        );
        const snap = await getDocs(q);

        const datos = {
          estudianteId: est.id,
          destrezaId: selectedDestrezaId,
          ambitoId: selectedAmbitoId,
          gradoId: selectedGradoId,
          anioLectivoId,
          periodoId,
          nota: Math.round(calificacion.nota),
          observacion: calificacion.observacion || "",
          docenteId: user?.uid || "",
          updatedAt: serverTimestamp(),
        };

        if (snap.empty) {
          await addDoc(collection(db, "calificaciones"), {
            ...datos,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, "calificaciones", snap.docs[0].id), datos);
        }
      });

      await Promise.all(batch);
      alert("✅ Calificaciones guardadas correctamente");
    } catch (error) {
      console.error("Error guardando calificaciones:", error);
      alert("Error al guardar calificaciones");
    } finally {
      setIsSaving(false);
    }
  };

  const actualizarAsistencia = (
    estudianteId: string,
    estado: "P" | "T" | "A" | "J"
  ) => {
    setAsistencias((prev) => ({
      ...prev,
      [estudianteId]: {
        estado,
        observacion: prev[estudianteId]?.observacion || "",
      },
    }));
  };

  // ✅ NUEVA FUNCIÓN: Marcar a todos los estudiantes con un estado específico
  const marcarTodosAsistencia = (estado: "P" | "T" | "A" | "J") => {
    const nuevasAsistencias: Record<
      string,
      { estado: "P" | "T" | "A" | "J"; observacion: string }
    > = {};
    estudiantes.forEach((est) => {
      nuevasAsistencias[est.id] = {
        estado,
        observacion: asistencias[est.id]?.observacion || "", // Preservar observación si ya tenía
      };
    });
    setAsistencias(nuevasAsistencias);
  };

  // ✅ NUEVA FUNCIÓN: Limpiar todas las asistencias
  const limpiarAsistencias = () => {
    setAsistencias({});
  };

  const actualizarObservacionAsistencia = (
    estudianteId: string,
    observacion: string
  ) => {
    setAsistencias((prev) => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        observacion,
      },
    }));
  };

  const actualizarCalificacion = (estudianteId: string, nota: number) => {
    setCalificaciones((prev) => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        nota: Math.round(nota),
      },
    }));
  };

  const actualizarObservacionCalificacion = (
    estudianteId: string,
    observacion: string
  ) => {
    setCalificaciones((prev) => ({
      ...prev,
      [estudianteId]: {
        ...prev[estudianteId],
        observacion,
      },
    }));
  };

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (selectedGradoId) {
      cargarEstudiantes(selectedGradoId);
      cargarAmbitos(selectedGradoId);
    }
  }, [selectedGradoId, cargarEstudiantes, cargarAmbitos]);

  useEffect(() => {
    if (selectedAmbitoId) {
      cargarDestrezas(selectedAmbitoId);
    }
  }, [selectedAmbitoId, cargarDestrezas]);

  useEffect(() => {
    if (selectedDestrezaId && selectedGradoId) {
      cargarCalificaciones(selectedDestrezaId, selectedGradoId);
    }
  }, [selectedDestrezaId, selectedGradoId, cargarCalificaciones]);

  useEffect(() => {
    if (selectedGradoId && fechaAsistencia) {
      cargarAsistencias(selectedGradoId, fechaAsistencia);
    }
  }, [selectedGradoId, fechaAsistencia, cargarAsistencias]);

  if (loading) {
    return (
      <Layout
        title="Calificaciones"
        subtitle="Registro de notas y asistencia"
        showBack
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Calificaciones"
      subtitle="Registro de notas y asistencia"
      showBack
    >
      {/* ✅ Mensaje para docentes sin grados asignados */}
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
                Contacta al administrador del sistema para que te asigne los
                grados que podrás gestionar.
              </p>
              <p className="text-yellow-600 text-sm">
                Una vez que te asignen grados, podrás registrar asistencia y
                calificaciones en esta sección.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Mostrar contenido solo si NO es docente sin grados */}
      {!docenteSinGrados && (
        <>
          {/* ✅ Banner de Año Lectivo + Período Actual (Compacto) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {anioActivo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-blue-800">
                  <FaCalendarAlt className="text-sm shrink-0" />
                  <span className="text-xs font-medium">Año lectivo:</span>
                  <span className="text-sm font-bold text-blue-900 truncate">
                    {anioActivo.nombre}
                  </span>
                </div>
              </div>
            )}
            {periodoActual ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-green-800">
                  <FaClock className="text-sm shrink-0" />
                  <span className="text-xs font-medium">Período actual:</span>
                  <span className="text-sm font-bold text-green-900 truncate">
                    {periodoActual.nombre}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-yellow-800">
                  <FaExclamationTriangle className="text-sm shrink-0" />
                  <span className="text-xs font-medium">
                    No hay período activo en esta fecha
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ✅ Selector de Grados - Tarjetas Compactas */}
          {grados.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-4">
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FaGraduationCap className="text-blue-600" />
                Selecciona un Grado
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {grados.map((grado) => {
                  const isSelected = selectedGradoId === grado.id;
                  return (
                    <button
                      key={grado.id}
                      onClick={() => {
                        setSelectedGradoId(grado.id);
                        setSelectedAmbitoId("");
                        setSelectedDestrezaId("");
                        setCalificaciones({});
                      }}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-left text-sm ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-sm"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${
                            isSelected
                              ? "bg-linear-to-br from-blue-500 to-purple-600"
                              : "bg-linear-to-br from-slate-400 to-slate-500"
                          }`}
                        >
                          {grado.paralelo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {grado.nombre}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {grado.paralelo}
                          </div>
                        </div>
                        {isSelected && (
                          <FaUserCheck className="text-blue-600 text-xs shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-12 text-center">
              <div className="bg-slate-100 rounded-full p-4 mb-4 inline-block">
                <FaGraduationCap className="text-4xl text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                No hay grados disponibles
              </h3>
              <p className="text-slate-600">
                Contacta al administrador para que te asigne grados
              </p>
            </div>
          )}

          {/* ✅ Contenido Principal (Tabs + Contenido) */}
          {selectedGradoId && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Barra superior compacta: Tabs + Fecha/Selectores + Botón Guardar */}
              <div className="border-b border-slate-200 p-3">
                <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                  {/* Tabs */}
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button
                      onClick={() => setActiveTab("asistencia")}
                      className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        activeTab === "asistencia"
                          ? "bg-blue-600 text-white shadow"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <FaUserCheck className="text-sm" />
                      Asistencia
                    </button>
                    <button
                      onClick={() =>
                        todosConAsistencia && setActiveTab("calificaciones")
                      }
                      disabled={!todosConAsistencia}
                      className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        activeTab === "calificaciones"
                          ? "bg-blue-600 text-white shadow"
                          : todosConAsistencia
                          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          : "bg-slate-50 text-slate-400 cursor-not-allowed"
                      }`}
                      title={
                        !todosConAsistencia
                          ? "Primero registra la asistencia de todos los estudiantes"
                          : ""
                      }
                    >
                      <FaTasks className="text-sm" />
                      Calificaciones
                      {!todosConAsistencia && <FaLock className="text-xs" />}
                    </button>
                  </div>

                  {/* Controles específicos por tab */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:justify-end items-stretch sm:items-center">
                    {activeTab === "asistencia" ? (
                      <>
                        <input
                          type="date"
                          value={fechaAsistencia}
                          onChange={(e) => setFechaAsistencia(e.target.value)}
                          className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={guardarAsistencia}
                          disabled={isSaving || !todosConAsistencia}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
                        >
                          {isSaving ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FaSave />
                          )}
                          Guardar
                        </button>
                      </>
                    ) : (
                      <>
                        {/* ✅ SELECTS CON ANCHO FIJO PARA EVITAR QUE SE ESTIREN */}
                        <select
                          value={selectedAmbitoId}
                          onChange={(e) => {
                            setSelectedAmbitoId(e.target.value);
                            setSelectedDestrezaId("");
                            setCalificaciones({});
                          }}
                          className="w-full sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 truncate"
                        >
                          <option value="">Ámbito...</option>
                          {ambitos.map((ambito) => (
                            <option key={ambito.id} value={ambito.id}>
                              {ambito.nombre}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedDestrezaId}
                          onChange={(e) => setSelectedDestrezaId(e.target.value)}
                          disabled={!selectedAmbitoId}
                          className="w-full sm:w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 truncate"
                        >
                          <option value="">Destreza...</option>
                          {destrezas.map((destreza) => (
                            <option key={destreza.id} value={destreza.id}>
                              {destreza.nombre}
                            </option>
                          ))}
                        </select>

                        {/* ✅ BOTÓN CON shrink-0 PARA QUE NO SE ENCOJA */}
                        <button
                          onClick={guardarCalificaciones}
                          disabled={isSaving || !selectedDestrezaId}
                          title={
                            !selectedDestrezaId
                              ? "⚠️ Primero debes seleccionar un ámbito y una destreza"
                              : "Guardar calificaciones"
                          }
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 shrink-0 ${
                            !selectedDestrezaId
                              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
                          }`}
                        >
                          {isSaving ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            <FaSave />
                          )}
                          Guardar Notas
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-4">
                {/* Alerta de asistencia incompleta */}
                {activeTab === "asistencia" &&
                  !todosConAsistencia &&
                  estudiantes.length > 0 && (
                    <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <FaExclamationTriangle className="text-sm shrink-0" />
                        <span className="text-xs font-medium">
                          Debes registrar la asistencia de todos los estudiantes
                          antes de guardar
                        </span>
                      </div>
                    </div>
                  )}

                {/* Destreza seleccionada */}
                {activeTab === "calificaciones" && selectedDestrezaId && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <FaTasks className="text-purple-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-purple-900 text-xs mb-0.5">
                          Destreza seleccionada:
                        </h4>
                        <p className="text-purple-800 text-xs line-clamp-2">
                          {destrezas.find((d) => d.id === selectedDestrezaId)
                            ?.descripcion ||
                            destrezas.find((d) => d.id === selectedDestrezaId)
                              ?.nombre}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de Estudiantes */}
                {estudiantes.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <FaUserCheck className="text-4xl mx-auto mb-3 text-slate-300" />
                    <p className="font-medium mb-1">
                      No hay estudiantes en este grado
                    </p>
                    <p className="text-sm">Agrega estudiantes primero</p>
                  </div>
                ) : activeTab === "calificaciones" && !selectedDestrezaId ? (
                  <div className="text-center py-12 text-slate-500">
                    <FaTasks className="text-4xl mx-auto mb-3 text-slate-300" />
                    <p className="font-medium mb-1">
                      Selecciona un ámbito y destreza
                    </p>
                    <p className="text-sm">para comenzar a calificar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* ✅ BARRA DE ACCIONES RÁPIDAS PARA ASISTENCIA */}
                    {activeTab === "asistencia" && (
                      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-700 mr-1">
                          Acción rápida:
                        </span>
                        <button
                          onClick={() => marcarTodosAsistencia("P")}
                          className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5"
                          title="Marcar a todos los estudiantes como Presentes"
                        >
                          <FaCheck /> Todos Presentes
                        </button>
                        <button
                          onClick={() => marcarTodosAsistencia("A")}
                          className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5"
                          title="Marcar a todos los estudiantes como Ausentes"
                        >
                          <FaTimes /> Todos Ausentes
                        </button>
                        <button
                          onClick={limpiarAsistencias}
                          className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 ml-auto"
                          title="Limpiar todas las asistencias registradas"
                        >
                          <FaUndo /> Limpiar
                        </button>
                      </div>
                    )}

                    {estudiantes.map((est) => {
                      if (activeTab === "asistencia") {
                        const asistencia = asistencias[est.id];
                        const estado = asistencia?.estado || "";
                        return (
                          <div
                            key={est.id}
                            className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 text-sm truncate">
                                  {est.apellidos} {est.nombres}
                                </div>
                                {est.cedula && (
                                  <div className="text-slate-500 text-xs mt-0.5">
                                    CI: {est.cedula}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {(["P", "T", "A", "J"] as const).map(
                                  (estadoBtn) => (
                                    <button
                                      key={estadoBtn}
                                      onClick={() =>
                                        actualizarAsistencia(est.id, estadoBtn)
                                      }
                                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                                        estado === estadoBtn
                                          ? estadoBtn === "P"
                                            ? "bg-green-600 text-white shadow-md"
                                            : estadoBtn === "T"
                                            ? "bg-yellow-600 text-white shadow-md"
                                            : estadoBtn === "A"
                                            ? "bg-red-600 text-white shadow-md"
                                            : "bg-blue-600 text-white shadow-md"
                                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      }`}
                                      title={
                                        estadoBtn === "P"
                                          ? "Presente"
                                          : estadoBtn === "T"
                                          ? "Tardanza"
                                          : estadoBtn === "A"
                                          ? "Ausente"
                                          : "Justificado"
                                      }
                                    >
                                      {estadoBtn}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                            {estado && (
                              <div className="mt-2">
                                <input
                                  type="text"
                                  value={asistencia?.observacion || ""}
                                  onChange={(e) =>
                                    actualizarObservacionAsistencia(
                                      est.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Observación (opcional)..."
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        const calificacion = calificaciones[est.id];
                        const nota = calificacion?.nota;
                        const letra =
                          nota !== undefined ? notaALetra(nota) : "";
                        return (
                          <div
                            key={est.id}
                            className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 text-sm truncate">
                                  {est.apellidos} {est.nombres}
                                </div>
                                {est.cedula && (
                                  <div className="text-slate-500 text-xs mt-0.5">
                                    CI: {est.cedula}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {letra && (
                                  <div className="bg-blue-100 border border-blue-300 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                                    {letra}
                                  </div>
                                )}
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  step="1"
                                  value={nota !== undefined ? nota : ""}
                                  onChange={(e) => {
                                    const valor = parseInt(e.target.value);
                                    if (
                                      !isNaN(valor) &&
                                      valor >= 1 &&
                                      valor <= 10
                                    ) {
                                      actualizarCalificacion(est.id, valor);
                                    }
                                  }}
                                  placeholder="1-10"
                                  className={`w-16 border-2 rounded px-2 py-1 text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 ${
                                    nota !== undefined
                                      ? nota >= 7
                                        ? "border-green-500 text-green-700"
                                        : nota >= 5
                                        ? "border-yellow-500 text-yellow-700"
                                        : "border-red-500 text-red-700"
                                      : "border-slate-300"
                                  }`}
                                />
                              </div>
                            </div>
                            <div className="mt-2">
                              <input
                                type="text"
                                value={calificacion?.observacion || ""}
                                onChange={(e) =>
                                  actualizarObservacionCalificacion(
                                    est.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Observación (opcional)..."
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}

                {/* Contador de asistencia */}
                {activeTab === "asistencia" && estudiantes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-xs text-slate-600">
                      {
                        Object.keys(asistencias).filter(
                          (key) => asistencias[key].estado
                        ).length
                      }{" "}
                      de {estudiantes.length} estudiantes con asistencia
                      registrada
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}