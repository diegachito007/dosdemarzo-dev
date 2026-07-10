import { useState, useEffect, startTransition, useCallback } from "react";
import React from "react"; // ✅ Agregar esto
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
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
  FaPrint,
  FaUserGraduate,
  FaUsers,
  FaExclamationTriangle,
  FaSearch,
} from "react-icons/fa";

interface CalificacionDoc {
  id: string;
  estudianteId: string;
  destrezaId: string;
  ambitoId: string;
  gradoId: string;
  anioLectivoId: string;
  periodoId: string;
  nota: number;
  observacion?: string;
  docenteId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface AsistenciaDoc {
  id: string;
  estudianteId: string;
  gradoId: string;
  anioLectivoId: string;
  periodoId: string;
  fecha: string;
  estado: "P" | "T" | "A" | "J";
  observacion?: string;
  registradoPor?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ✅ Escala cualitativa según el PDF
const ESCALA_CUALITATIVA: Record<string, { descripcion: string; valor: number }> = {
  "A+": { descripcion: "Superado(S)", valor: 10 },
  "A-": { descripcion: "Logrado(L)", valor: 9 },
  "B+": { descripcion: "Medianamente Logrado(ML)", valor: 8 },
  "B-": { descripcion: "Básicamente Logrado(BL)", valor: 7 },
  "C+": { descripcion: "En Proceso(EP)", valor: 6 },
  "C-": { descripcion: "En Proceso(EP)", valor: 5 },
  "D+": { descripcion: "En Proceso(EP)", valor: 4 },
  "D-": { descripcion: "En Proceso(EP)", valor: 3 },
  "E+": { descripcion: "En Proceso(EP)", valor: 2 },
  "E-": { descripcion: "En Proceso(EP)", valor: 1 },
};

export default function Reportes() {
  const [, setAniosLectivosData] = useState<AnioLectivo[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoEvaluacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [calificaciones, setCalificaciones] = useState<CalificacionDoc[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGradoId, setSelectedGradoId] = useState("");
  const [selectedPeriodoId, setSelectedPeriodoId] = useState("");
  const [selectedEstudianteId, setSelectedEstudianteId] = useState("");
  const [activeReport, setActiveReport] = useState<
    "individualGeneral" | "masivo"
  >("individualGeneral");

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

      const gradosQuery = query(
        collection(db, "grados"),
        where("activo", "==", true),
        orderBy("orden", "asc")
      );
      const gradosSnap = await getDocs(gradosQuery);
      const gradosData = gradosSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Grado
      );

      startTransition(() => {
        setAniosLectivosData(aniosData);
        setPeriodos(periodosData);
        setGrados(gradosData);
        if (gradosData.length > 0 && !selectedGradoId) {
          setSelectedGradoId(gradosData[0].id);
        }
        if (periodosData.length > 0 && !selectedPeriodoId) {
          setSelectedPeriodoId(periodosData[0].id);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando datos:", error);
      startTransition(() => setLoading(false));
    }
  }, [selectedGradoId, selectedPeriodoId]);

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
      startTransition(() => setEstudiantes(data));
    } catch (error) {
      console.error("Error cargando estudiantes:", error);
    }
  }, []);

  const cargarAmbitosYDestrezas = useCallback(async (gradoId: string) => {
    try {
      const ambitosQuery = query(
        collection(db, "ambitos"),
        where("gradoId", "==", gradoId),
        where("activo", "==", true),
        orderBy("orden", "asc")
      );
      const ambitosSnap = await getDocs(ambitosQuery);
      const ambitosData = ambitosSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Ambito
      );

      const destrezasQuery = query(
        collection(db, "destrezas"),
        where("gradoId", "==", gradoId),
        where("activo", "==", true),
        orderBy("orden", "asc")
      );
      const destrezasSnap = await getDocs(destrezasQuery);
      const destrezasData = destrezasSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Destreza
      );

      startTransition(() => {
        setAmbitos(ambitosData);
        setDestrezas(destrezasData);
      });
    } catch (error) {
      console.error("Error cargando ámbitos y destrezas:", error);
    }
  }, []);

  const cargarCalificaciones = useCallback(
    async (gradoId: string) => {
      try {
        const q = query(
          collection(db, "calificaciones"),
          where("gradoId", "==", gradoId)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as CalificacionDoc
        );
        startTransition(() => setCalificaciones(data));
      } catch (error) {
        console.error("Error cargando calificaciones:", error);
      }
    },
    []
  );

  const cargarAsistencias = useCallback(
    async (gradoId: string) => {
      try {
        const q = query(
          collection(db, "asistencias"),
          where("gradoId", "==", gradoId)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as AsistenciaDoc
        );
        startTransition(() => setAsistencias(data));
      } catch (error) {
        console.error("Error cargando asistencias:", error);
      }
    },
    []
  );

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (selectedGradoId) {
      cargarEstudiantes(selectedGradoId);
      cargarAmbitosYDestrezas(selectedGradoId);
      cargarAsistencias(selectedGradoId);
      cargarCalificaciones(selectedGradoId);
    }
  }, [
    selectedGradoId,
    cargarEstudiantes,
    cargarAmbitosYDestrezas,
    cargarAsistencias,
    cargarCalificaciones,
  ]);

  // ✅ Convertir nota numérica a letra
  const notaALetra = (nota: number): string => {
    if (nota >= 10) return "A+";
    if (nota >= 9) return "A-";
    if (nota >= 8) return "B+";
    if (nota >= 7) return "B-";
    if (nota >= 6) return "C+";
    if (nota >= 5) return "C-";
    if (nota >= 4) return "D+";
    if (nota >= 3) return "D-";
    if (nota >= 2) return "E+";
    if (nota >= 1) return "E-";
    return "-";
  };

  // ✅ Obtener descripción de la letra
  const obtenerDescripcion = (letra: string): string => {
    return ESCALA_CUALITATIVA[letra]?.descripcion || "-";
  };

  // ✅ Calcular promedio del ámbito para un período específico
  const calcularPromedioAmbito = (
    estudianteId: string,
    ambitoId: string,
    periodoId: string
  ): number => {
    const destrezasDelAmbito = destrezas.filter((d) => d.ambitoId === ambitoId);
    const califsEstudiante = calificaciones.filter(
      (c) =>
        c.estudianteId === estudianteId &&
        c.periodoId === periodoId &&
        destrezasDelAmbito.some((d) => d.id === c.destrezaId)
    );

    if (califsEstudiante.length === 0) return 0;

    const suma = califsEstudiante.reduce((acc, c) => acc + c.nota, 0);
    return parseFloat((suma / califsEstudiante.length).toFixed(1));
  };

  // ✅ Calcular promedio general (promedio de los 10 ámbitos) para un período
  const calcularPromedioGeneral = (
    estudianteId: string,
    periodoId: string
  ): number => {
    const promediosAmbitos = ambitos.map((ambito) =>
      calcularPromedioAmbito(estudianteId, ambito.id, periodoId)
    ).filter((p) => p > 0);

    if (promediosAmbitos.length === 0) return 0;

    const suma = promediosAmbitos.reduce((acc, p) => acc + p, 0);
    return parseFloat((suma / promediosAmbitos.length).toFixed(1));
  };

  const calcularAsistenciaEstudiante = (estudianteId: string) => {
    const asistenciasEstudiante = asistencias.filter(
      (a) => a.estudianteId === estudianteId
    );

    const presentes = asistenciasEstudiante.filter((a) => a.estado === "P").length;
    const tardanzas = asistenciasEstudiante.filter((a) => a.estado === "T").length;
    const ausentes = asistenciasEstudiante.filter((a) => a.estado === "A").length;
    const justificados = asistenciasEstudiante.filter((a) => a.estado === "J").length;

    const total = presentes + tardanzas + ausentes + justificados;
    const porcentaje = total > 0 ? ((presentes + tardanzas) / total) * 100 : 0;

    return {
      presentes,
      tardanzas,
      ausentes,
      justificados,
      total,
      porcentaje: parseFloat(porcentaje.toFixed(1)),
    };
  };

  // ✅ Determinar qué trimestres mostrar según el seleccionado
  const obtenerTrimestresAMostrar = () => {
    const periodoSeleccionado = periodos.find((p) => p.id === selectedPeriodoId);
    if (!periodoSeleccionado) return [];

    const ordenSeleccionado = periodoSeleccionado.orden;
    
    // Mostrar todos los trimestres hasta el seleccionado
    return periodos
      .filter((p) => p.orden <= ordenSeleccionado)
      .sort((a, b) => a.orden - b.orden);
  };

  const imprimirReporte = () => {
    window.print();
  };

  if (loading) {
    return (
      <Layout title="Reportes" subtitle="Genera reportes y boletines" showBack>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm font-medium">Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const gradoActual = grados.find((g) => g.id === selectedGradoId);
  const estudianteActual = estudiantes.find((e) => e.id === selectedEstudianteId);
  const trimestresAMostrar = obtenerTrimestresAMostrar();

  // ✅ Componente para renderizar un boletín
  const renderBoletin = (estudiante: Estudiante) => {
    const asistencia = calcularAsistenciaEstudiante(estudiante.id);

    return (
      <div className="bg-white border-2 border-slate-800 p-6 mb-8 page-break">
        {/* Header */}
        <div className="text-center mb-4 border-b-2 border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-slate-900 mb-1">
            REPORTE DE DESARROLLO INTEGRAL
          </h1>
          <p className="text-xs text-slate-700">
            INSTITUCIÓN: CECIBEB "Leonardo Pérez Muñoz" CÓDIGO AMIE: 10B00020
          </p>
          <p className="text-xs text-slate-700">
            CURSO/GRADO: {gradoActual?.nombre} - {gradoActual?.paralelo} | FECHA: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        {/* Datos del estudiante */}
        <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-300">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-semibold">Nombres y Apellidos:</p>
              <p className="font-bold text-slate-900 text-sm">
                {estudiante.apellidos} {estudiante.nombres}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold">TUTORA:</p>
              <p className="font-bold text-slate-900 text-sm">Lic. Alexandra Perugachi</p>
            </div>
          </div>
        </div>

        {/* Tabla de calificaciones con 3 trimestres */}
        <div className="mb-4">
          <h3 className="font-bold text-sm text-slate-900 mb-2 text-center">
            ÁMBITOS DE DESARROLLO Y APRENDIZAJE
          </h3>
          
          <table className="w-full border-collapse border border-slate-800">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-800 px-2 py-1 text-left text-xs font-bold" rowSpan={2}>
                  ÁMBITOS DE DESARROLLO Y APRENDIZAJE
                </th>
                {trimestresAMostrar.map((periodo) => (
                  <th key={periodo.id} className="border border-slate-800 px-2 py-1 text-center text-xs font-bold" colSpan={2}>
                    {periodo.nombre.toUpperCase()}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-100">
                {trimestresAMostrar.map((periodo) => (
                  <React.Fragment key={periodo.id}>
                    <th className="border border-slate-800 px-2 py-1 text-center text-xs font-bold w-16">
                      NOTA
                    </th>
                    <th className="border border-slate-800 px-2 py-1 text-center text-xs font-bold w-32">
                      EQUIVALENCIA
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {ambitos.map((ambito) => (
                <tr key={ambito.id}>
                  <td className="border border-slate-800 px-2 py-1 text-xs font-semibold">
                    {ambito.nombre.toUpperCase()}
                  </td>
                  {trimestresAMostrar.map((periodo) => {
                    const promedio = calcularPromedioAmbito(estudiante.id, ambito.id, periodo.id);
                    const letra = promedio > 0 ? notaALetra(promedio) : "";
                    const descripcion = promedio > 0 ? obtenerDescripcion(letra) : "";

                    return (
                      <React.Fragment key={periodo.id}>
                        <td className="border border-slate-800 px-2 py-1 text-center text-xs font-bold">
                          {letra}
                        </td>
                        <td className="border border-slate-800 px-2 py-1 text-center text-xs">
                          {descripcion}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              {/* Fila de promedios */}
              <tr className="bg-blue-50 font-bold">
                <td className="border border-slate-800 px-2 py-1 text-xs">
                  PROMEDIO
                </td>
                {trimestresAMostrar.map((periodo) => {
                  const prom = calcularPromedioGeneral(estudiante.id, periodo.id);
                  const letra = prom > 0 ? notaALetra(prom) : "";
                  const descripcion = prom > 0 ? obtenerDescripcion(letra) : "";

                  return (
                    <React.Fragment key={periodo.id}>
                      <td className="border border-slate-800 px-2 py-1 text-center text-xs">
                        {letra}
                      </td>
                      <td className="border border-slate-800 px-2 py-1 text-center text-xs">
                        {descripcion}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Comportamiento y Asistencia */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="border border-slate-800 p-2">
            <p className="text-xs font-bold mb-1">COMPORTAMIENTO</p>
            <p className="text-xs">A - Cumple con los compromisos establecidos para la sana convivencia social.</p>
          </div>
          <div className="border border-slate-800 p-2">
            <p className="text-xs font-bold mb-1">ASISTENCIA</p>
            <div className="text-xs space-y-0.5">
              <p>Faltas Justificadas: {asistencia.justificados}</p>
              <p>Faltas Injustificadas: {asistencia.ausentes}</p>
              <p>Días Asistidos: {asistencia.presentes + asistencia.tardanzas}</p>
            </div>
          </div>
        </div>

        {/* Escala de estimación */}
        <div className="mb-4 border border-slate-800 p-2">
          <p className="text-xs font-bold mb-2">ESCALA DE ESTIMACIÓN CUALITATIVA DE DESTREZAS:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="font-bold">A+</span> - Superado(S): El estudiante supera el dominio</div>
            <div><span className="font-bold">A-</span> - Logrado(L): El estudiante alcanza el dominio</div>
            <div><span className="font-bold">B+</span> - Medianamente Logrado(ML): El estudiante básicamente logra el dominio, con refuerzo constante</div>
            <div><span className="font-bold">B-</span> - Básicamente Logrado(BL): El estudiante básicamente logra el dominio, con refuerzo constante y acompañamiento permanente del docente y de la familia</div>
            <div className="col-span-2"><span className="font-bold">C+ a E-</span> - En Proceso(EP): En Proceso para alcanzar el dominio; requiere de mayor tiempo de dedicación y refuerzo constante</div>
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="mb-4 border border-slate-800 p-2">
          <p className="text-xs font-bold mb-1">RECOMENDACIONES:</p>
          <p className="text-xs">Reforzar lo aprendido como vocales, sonidos m,p y n, así como sumas y restas</p>
        </div>

        {/* Firmas */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 mt-12">
              <p className="text-xs font-bold">LIC. XIMENA VALENCIA</p>
              <p className="text-xs">DIRECTORA DEL CECIBEB</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 mt-12">
              <p className="text-xs font-bold">LIC. ALEXANDRA PERUGACHI</p>
              <p className="text-xs">DOCENTE TUTOR</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout title="Reportes" subtitle="Genera reportes y boletines" showBack>
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Grado y Paralelo *
            </label>
            <select
              value={selectedGradoId}
              onChange={(e) => setSelectedGradoId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {grados.map((grado) => (
                <option key={grado.id} value={grado.id}>
                  {grado.nombre} - {grado.paralelo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Período *
            </label>
            <select
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.nombre}
                </option>
              ))}
            </select>
          </div>

          {activeReport === "individualGeneral" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Estudiante *
              </label>
              <select
                value={selectedEstudianteId}
                onChange={(e) => setSelectedEstudianteId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.apellidos} {est.nombres}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs de Reportes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveReport("individualGeneral")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeReport === "individualGeneral"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaUserGraduate className="inline mr-2" />
            Individual General
          </button>
          <button
            onClick={() => setActiveReport("masivo")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeReport === "masivo"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaUsers className="inline mr-2" />
            Masivo
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-end mb-6 no-print">
            <button
              onClick={imprimirReporte}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            >
              <FaPrint />
              Imprimir Reporte
            </button>
          </div>

          {/* REPORTE 1: Individual General */}
          {activeReport === "individualGeneral" && (
            <div>
              {!selectedEstudianteId ? (
                <div className="text-center py-12 text-slate-500">
                  <FaSearch className="text-4xl mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">Selecciona un estudiante</p>
                  <p className="text-sm">para ver su boletín general</p>
                </div>
              ) : estudianteActual ? (
                renderBoletin(estudianteActual)
              ) : null}
            </div>
          )}

          {/* REPORTE 2: Masivo */}
          {activeReport === "masivo" && (
            <div>
              {estudiantes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FaExclamationTriangle className="text-4xl mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">No hay estudiantes</p>
                  <p className="text-sm">No hay estudiantes registrados en este grado</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    Se generarán {estudiantes.length} boletines
                  </p>
                  {estudiantes.map((estudiante) => (
                    <div key={estudiante.id}>
                      {renderBoletin(estudiante)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </Layout>
  );
}