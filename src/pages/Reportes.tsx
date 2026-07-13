import { useState, useEffect, startTransition, useCallback } from "react";
import React from "react";
import {
  collection,
  query,
  orderBy,
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
  FaPrint,
  FaUserGraduate,
  FaUsers,
  FaExclamationTriangle,
  FaSearch,
  FaUserTie,
  FaCalendarAlt,
  FaClock,
  FaGraduationCap,
  FaCogs,
} from "react-icons/fa";
import { Link } from "react-router-dom";

// ✅ Interfaz para configuración institucional
interface InstitutionData {
  nombreInstitucion?: string;
  codigoAmie?: string;
  nombreRector?: string;
  tituloRector?: string;
  direccion?: string;
  telefono?: string;
  logo?: string;
}

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
  const { userData } = useAuth();
  const [aniosLectivosData, setAniosLectivosData] = useState<AnioLectivo[]>([]);
  const [grados, setGrados] = useState<Grado[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoEvaluacion[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [calificaciones, setCalificaciones] = useState<CalificacionDoc[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaDoc[]>([]);
  const [institutionData, setInstitutionData] = useState<InstitutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInstitution, setLoadingInstitution] = useState(true);

  const [selectedGradoId, setSelectedGradoId] = useState("");
  const [selectedPeriodoId, setSelectedPeriodoId] = useState("");
  const [selectedEstudianteId, setSelectedEstudianteId] = useState("");
  const [activeReport, setActiveReport] = useState<
    "individualGeneral" | "masivo"
  >("individualGeneral");

  // ✅ Verificar si es docente sin grados tutor
  const docenteSinTutoria = userData?.role === 'docente' && (!userData?.tutorDe || userData.tutorDe.length === 0);

  // ✅ Obtener año lectivo activo
  const anioActivo = aniosLectivosData.find(a => a.activo);

  // ✅ Nombre del docente tutor (desde configuración personal)
  const nombreDocenteTutor = userData?.nombreDocumento || '';

  // ✅ Cargar configuración institucional
  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        const configSnap = await getDocs(collection(db, "configuracionInstitucional"));
        if (!configSnap.empty) {
          const data = configSnap.docs[0].data() as InstitutionData;
          setInstitutionData(data);
        }
      } catch (error) {
        console.error("Error cargando configuración institucional:", error);
      } finally {
        setLoadingInstitution(false);
      }
    };
    
    cargarConfiguracion();
  }, []);

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
      if (userData?.role === 'docente' && userData?.tutorDe && userData.tutorDe.length > 0) {
        gradosQuery = query(
          collection(db, "grados"),
          where("__name__", "in", userData.tutorDe),
          where("activo", "==", true),
          orderBy("orden", "asc")
        );
      } else if (userData?.role === 'docente') {
        startTransition(() => {
          setAniosLectivosData(aniosData);
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
        setAniosLectivosData(aniosData);
        setPeriodos(periodosData);
        setGrados(gradosData);
        if (gradosData.length > 0 && !selectedGradoId) {
          setSelectedGradoId(gradosData[0].id);
        }
        if (periodosData.length > 0 && !selectedPeriodoId) {
          setSelectedPeriodoId(periodosData[periodosData.length - 1].id);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando datos:", error);
      startTransition(() => setLoading(false));
    }
  }, [selectedGradoId, selectedPeriodoId, userData]);

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

  const obtenerDescripcion = (letra: string): string => {
    return ESCALA_CUALITATIVA[letra]?.descripcion || "-";
  };

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

  const obtenerTrimestresAMostrar = () => {
    const periodoSeleccionado = periodos.find((p) => p.id === selectedPeriodoId);
    if (!periodoSeleccionado) return [];

    const ordenSeleccionado = periodoSeleccionado.orden;
    
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

  const renderBoletin = (estudiante: Estudiante) => {
    const asistencia = calcularAsistenciaEstudiante(estudiante.id);
    
    // ✅ Datos dinámicos para el boletín
    const institucionTexto = institutionData?.nombreInstitucion 
      ? `INSTITUCIÓN: ${institutionData.nombreInstitucion.toUpperCase()}`
      : 'INSTITUCIÓN: [Configurar nombre]';
    
    const amieTexto = institutionData?.codigoAmie 
      ? `CÓDIGO AMIE: ${institutionData.codigoAmie}`
      : 'CÓDIGO AMIE: [Configurar código]';
    
    const nombreRector = institutionData?.nombreRector || '';
    const tituloRector = institutionData?.tituloRector || '';

    return (
      <div className="bg-white border-2 border-slate-800 p-6 mb-8 page-break">
        <div className="text-center mb-4 border-b-2 border-slate-800 pb-3">
          <h1 className="text-lg font-bold text-slate-900 mb-1">
            REPORTE DE DESARROLLO INTEGRAL
          </h1>
          <p className="text-xs text-slate-700">
            {institucionTexto} {amieTexto}
          </p>
          <p className="text-xs text-slate-700">
            CURSO/GRADO: {gradoActual?.nombre} - {gradoActual?.paralelo} | FECHA: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        <div className="mb-4 bg-slate-50 p-3 rounded border border-slate-300">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-semibold">Nombres y Apellidos:</p>
              <p className="font-bold text-slate-900 text-sm">
                {estudiante.apellidos} {estudiante.nombres}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold">TUTOR/A:</p>
              <p className="font-bold text-slate-900 text-sm">
                {nombreDocenteTutor || '[Configura tu perfil]'}
              </p>
            </div>
          </div>
        </div>

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

        <div className="mb-4 border border-slate-800 p-2">
          <p className="text-xs font-bold mb-1">RECOMENDACIONES:</p>
          <p className="text-xs">Reforzar lo aprendido como vocales, sonidos m,p y n, así como sumas y restas</p>
        </div>

        {/* ✅ Firmas con datos dinámicos */}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 mt-12">
              <p className="text-xs font-bold">{tituloRector} {nombreRector.toUpperCase()}</p>
              <p className="text-xs">{institutionData?.nombreInstitucion ? 'DIRECTOR/A' : 'DIRECTOR/A'}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 mt-12">
              <p className="text-xs font-bold">
                {nombreDocenteTutor ? nombreDocenteTutor.toUpperCase() : '[CONFIGURA TU PERFIL]'}
              </p>
              <p className="text-xs">DOCENTE TUTOR</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout title="Reportes" subtitle="Genera reportes y boletines" showBack>
      {/* ✅ ALERTA: Si es super_admin y no hay configuración institucional */}
      {userData?.role === 'super_admin' && loadingInstitution === false && !institutionData && (
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <FaCogs className="text-amber-600 text-xl mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">
                Configuración institucional pendiente
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Los reportes se generarán sin los datos de la institución. Configura los datos para que aparezcan correctamente.
              </p>
              <Link 
                to="/configuracion-institucional"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Configurar ahora
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ✅ ALERTA: Si el docente no tiene nombreDocumento configurado */}
      {!nombreDocenteTutor && (
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <FaUserTie className="text-blue-600 text-xl mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">
                Configura tu nombre para documentos
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Tu nombre no aparecerá en las firmas de los boletines hasta que configures tu perfil.
              </p>
              <Link 
                to="/configuracion"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Configurar mi perfil
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Mensaje para docentes sin tutoría */}
      {docenteSinTutoria && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl px-8 py-12 mb-6">
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="bg-yellow-100 p-3 rounded-full">
              <FaExclamationTriangle className="text-yellow-600 text-2xl" />
            </div>
            <div className="flex-1">
              <h3 className="text-yellow-800 font-bold text-xl mb-3">
                No eres tutor de ningún grado
              </h3>
              <p className="text-yellow-700 mb-2">
                Solo los tutores pueden generar reportes de estudiantes.
              </p>
              <p className="text-yellow-600 text-sm">
                Contacta al administrador para que te asigne como tutor de algún grado.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Mostrar contenido solo si NO es docente sin tutoría */}
      {!docenteSinTutoria && (
        <>
          {/* ✅ Banner de Año Lectivo Activo */}
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
                <FaExclamationTriangle className="text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-yellow-800 font-semibold text-sm mb-1">
                    No hay año lectivo activo
                  </h4>
                  <p className="text-yellow-700 text-sm">
                    Debes crear y activar un año lectivo primero en el módulo de Años Lectivos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Selector de Grado - Tarjetas Compactas */}
          {grados.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
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
                        setSelectedEstudianteId("");
                      }}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-left text-sm ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${
                          isSelected
                            ? 'bg-linear-to-br from-blue-500 to-purple-600'
                            : 'bg-linear-to-br from-slate-400 to-slate-500'
                        }`}>
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
                          <FaUserGraduate className="text-blue-600 text-xs shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ✅ Selector de Período - Tarjetas Compactas */}
          {selectedGradoId && periodos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FaClock className="text-green-600" />
                Período del Reporte
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {periodos.map((periodo) => {
                  const isSelected = selectedPeriodoId === periodo.id;
                  return (
                    <button
                      key={periodo.id}
                      onClick={() => setSelectedPeriodoId(periodo.id)}
                      className={`p-3 rounded-lg border-2 transition-all duration-200 text-left text-sm ${
                        isSelected
                          ? 'border-green-500 bg-green-50 shadow-sm'
                          : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${
                          isSelected
                            ? 'bg-linear-to-br from-green-500 to-teal-600'
                            : 'bg-linear-to-br from-slate-400 to-slate-500'
                        }`}>
                          {periodo.orden}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {periodo.nombre}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {periodo.tipo}
                          </div>
                        </div>
                        {isSelected && (
                          <FaClock className="text-green-600 text-xs shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                💡 Se mostrarán todos los períodos hasta el seleccionado
              </p>
            </div>
          )}

          {/* Tabs de Reportes + Selector Estudiante + Imprimir */}
          {selectedGradoId && selectedPeriodoId && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  {/* Tabs */}
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button
                      onClick={() => setActiveReport("individualGeneral")}
                      className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        activeReport === "individualGeneral"
                          ? "bg-blue-600 text-white shadow"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <FaUserGraduate className="text-sm" />
                      Individual
                    </button>
                    <button
                      onClick={() => setActiveReport("masivo")}
                      className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        activeReport === "masivo"
                          ? "bg-blue-600 text-white shadow"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <FaUsers className="text-sm" />
                      Masivo
                    </button>
                  </div>

                  {/* Selector Estudiante (solo Individual) */}
                  {activeReport === "individualGeneral" && (
                    <select
                      value={selectedEstudianteId}
                      onChange={(e) => setSelectedEstudianteId(e.target.value)}
                      className="flex-1 lg:w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar estudiante...</option>
                      {estudiantes.map((est) => (
                        <option key={est.id} value={est.id}>
                          {est.apellidos} {est.nombres}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Botón Imprimir */}
                  <button
                    onClick={imprimirReporte}
                    className="w-full lg:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <FaPrint />
                    Imprimir
                  </button>
                </div>
              </div>

              <div className="p-6">
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
          )}

          {/* ✅ Info sobre permisos */}
          {userData?.role === 'docente' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <FaUserTie className="text-purple-600 mt-0.5" />
                <div className="text-sm text-purple-900">
                  <p className="font-semibold mb-1">
                    Eres tutor de {userData?.tutorDe?.length || 0} grado(s)
                  </p>
                  <p className="text-xs">
                    Solo puedes generar reportes de los grados donde eres tutor.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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