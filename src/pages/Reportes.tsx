import { useState, useEffect, startTransition, useCallback } from "react";
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
  FaChartBar,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaSearch,
} from "react-icons/fa";

// ✅ Interfaces locales para los datos de Firestore
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

export default function Reportes() {
  const [, setAniosLectivos] = useState<AnioLectivo[]>([]);
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
    "boletin" | "grado" | "asistencia"
  >("boletin");

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
        setAniosLectivos(aniosData);
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
    async (gradoId: string, periodoId: string) => {
      try {
        const q = query(
          collection(db, "calificaciones"),
          where("gradoId", "==", gradoId),
          where("periodoId", "==", periodoId)
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
    }
  }, [
    selectedGradoId,
    cargarEstudiantes,
    cargarAmbitosYDestrezas,
    cargarAsistencias,
  ]);

  useEffect(() => {
    if (selectedGradoId && selectedPeriodoId) {
      cargarCalificaciones(selectedGradoId, selectedPeriodoId);
    }
  }, [selectedGradoId, selectedPeriodoId, cargarCalificaciones]);

  const calcularPromedioAmbito = (
    estudianteId: string,
    ambitoId: string
  ): number => {
    const destrezasDelAmbito = destrezas.filter((d) => d.ambitoId === ambitoId);
    const califsEstudiante = calificaciones.filter(
      (c) =>
        c.estudianteId === estudianteId &&
        destrezasDelAmbito.some((d) => d.id === c.destrezaId)
    );

    if (califsEstudiante.length === 0) return 0;

    const suma = califsEstudiante.reduce((acc, c) => acc + c.nota, 0);
    return parseFloat((suma / califsEstudiante.length).toFixed(1));
  };

  const calcularPromedioGeneral = (estudianteId: string): number => {
    const califsEstudiante = calificaciones.filter(
      (c) => c.estudianteId === estudianteId
    );

    if (califsEstudiante.length === 0) return 0;

    const suma = califsEstudiante.reduce((acc, c) => acc + c.nota, 0);
    return parseFloat((suma / califsEstudiante.length).toFixed(1));
  };

  const calcularAsistenciaEstudiante = (estudianteId: string) => {
    const asistenciasEstudiante = asistencias.filter(
      (a) => a.estudianteId === estudianteId
    );

    const presentes = asistenciasEstudiante.filter((a) => a.estado === "P")
      .length;
    const tardanzas = asistenciasEstudiante.filter((a) => a.estado === "T")
      .length;
    const ausentes = asistenciasEstudiante.filter((a) => a.estado === "A")
      .length;
    const justificados = asistenciasEstudiante.filter(
      (a) => a.estado === "J"
    ).length;

    const total = presentes + tardanzas + ausentes + justificados;
    const porcentaje =
      total > 0 ? ((presentes + tardanzas) / total) * 100 : 0;

    return {
      presentes,
      tardanzas,
      ausentes,
      justificados,
      total,
      porcentaje: parseFloat(porcentaje.toFixed(1)),
    };
  };

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

  const periodoActual = periodos.find((p) => p.id === selectedPeriodoId);
  const gradoActual = grados.find((g) => g.id === selectedGradoId);
  const estudianteActual = estudiantes.find((e) => e.id === selectedEstudianteId);

  return (
    <Layout title="Reportes" subtitle="Genera reportes y boletines" showBack>
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

          {activeReport === "boletin" && (
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveReport("boletin")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeReport === "boletin"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaUserGraduate className="inline mr-2" />
            Boletín Individual
          </button>
          <button
            onClick={() => setActiveReport("grado")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeReport === "grado"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaChartBar className="inline mr-2" />
            Reporte de Grado
          </button>
          <button
            onClick={() => setActiveReport("asistencia")}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
              activeReport === "asistencia"
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FaCalendarAlt className="inline mr-2" />
            Reporte de Asistencia
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

          {activeReport === "boletin" && (
            <div>
              {!selectedEstudianteId ? (
                <div className="text-center py-12 text-slate-500">
                  <FaSearch className="text-4xl mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">Selecciona un estudiante</p>
                  <p className="text-sm">para ver su boletín de calificaciones</p>
                </div>
              ) : estudianteActual ? (
                <div className="bg-white border border-slate-300 rounded-lg p-8 print:shadow-none">
                  <div className="text-center mb-6 border-b-2 border-blue-600 pb-4">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                      BOLETÍN DE CALIFICACIONES
                    </h1>
                    <p className="text-slate-600">
                      Año Lectivo: {periodoActual?.anioLectivoId}
                    </p>
                    <p className="text-slate-600">
                      {periodoActual?.nombre} - {gradoActual?.nombre}{" "}
                      {gradoActual?.paralelo}
                    </p>
                  </div>

                  <div className="mb-6 bg-slate-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Estudiante:</p>
                        <p className="font-semibold text-slate-900">
                          {estudianteActual.apellidos} {estudianteActual.nombres}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Cédula:</p>
                        <p className="font-semibold text-slate-900">
                          {estudianteActual.cedula || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {ambitos.map((ambito) => {
                    const promedio = calcularPromedioAmbito(
                      estudianteActual.id,
                      ambito.id
                    );
                    const destrezasAmbito = destrezas.filter(
                      (d) => d.ambitoId === ambito.id
                    );

                    return (
                      <div key={ambito.id} className="mb-6">
                        <h3 className="font-bold text-lg text-blue-900 mb-3 border-b border-blue-300 pb-2">
                          {ambito.nombre}
                        </h3>
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                                Destreza
                              </th>
                              <th className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold w-20">
                                Nota
                              </th>
                              <th className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold w-20">
                                Equivalencia
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {destrezasAmbito.map((destreza) => {
                              const calif = calificaciones.find(
                                (c) =>
                                  c.estudianteId === estudianteActual.id &&
                                  c.destrezaId === destreza.id
                              );
                              const nota = calif?.nota || 0;

                              return (
                                <tr key={destreza.id}>
                                  <td className="border border-slate-300 px-3 py-2 text-sm">
                                    {destreza.nombre}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2 text-center font-semibold">
                                    {nota > 0 ? nota : "-"}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2 text-center font-bold">
                                    {nota > 0 ? notaALetra(nota) : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-blue-50 font-bold">
                              <td className="border border-slate-300 px-3 py-2 text-sm">
                                PROMEDIO DEL ÁMBITO
                              </td>
                              <td className="border border-slate-300 px-3 py-2 text-center">
                                {promedio > 0 ? promedio : "-"}
                              </td>
                              <td className="border border-slate-300 px-3 py-2 text-center">
                                {promedio > 0 ? notaALetra(promedio) : "-"}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}

                  <div className="mt-6 bg-green-50 border-2 border-green-600 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-900">
                        PROMEDIO GENERAL:
                      </span>
                      <span className="text-2xl font-bold text-green-900">
                        {calcularPromedioGeneral(estudianteActual.id)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-bold text-lg text-blue-900 mb-3">
                      ASISTENCIA
                    </h3>
                    {(() => {
                      const asistencia =
                        calcularAsistenciaEstudiante(estudianteActual.id);
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-700">
                              {asistencia.presentes}
                            </p>
                            <p className="text-xs text-green-600">Presentes</p>
                          </div>
                          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-yellow-700">
                              {asistencia.tardanzas}
                            </p>
                            <p className="text-xs text-yellow-600">Tardanzas</p>
                          </div>
                          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-red-700">
                              {asistencia.ausentes}
                            </p>
                            <p className="text-xs text-red-600">Ausentes</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-blue-700">
                              {asistencia.porcentaje}%
                            </p>
                            <p className="text-xs text-blue-600">Asistencia</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-12 grid grid-cols-2 gap-8">
                    <div className="text-center">
                      <div className="border-t border-slate-400 pt-2 mt-12">
                        <p className="text-sm font-semibold">Docente</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-slate-400 pt-2 mt-12">
                        <p className="text-sm font-semibold">Representante</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeReport === "grado" && (
            <div>
              {ambitos.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FaExclamationTriangle className="text-4xl mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">No hay ámbitos configurados</p>
                  <p className="text-sm">
                    Configura ámbitos y destrezas para este grado
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {ambitos.map((ambito) => {
                    const destrezasAmbito = destrezas.filter(
                      (d) => d.ambitoId === ambito.id
                    );

                    return (
                      <div key={ambito.id}>
                        <h3 className="font-bold text-xl text-blue-900 mb-4 border-b-2 border-blue-600 pb-2">
                          {ambito.nombre}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-slate-300">
                            <thead>
                              <tr className="bg-blue-100">
                                <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">
                                  Estudiante
                                </th>
                                {destrezasAmbito.map((destreza) => (
                                  <th
                                    key={destreza.id}
                                    className="border border-slate-300 px-3 py-2 text-center text-xs font-semibold"
                                  >
                                    {destreza.nombre.substring(0, 30)}...
                                  </th>
                                ))}
                                <th className="border border-slate-300 px-3 py-2 text-center text-sm font-semibold bg-blue-50">
                                  Promedio
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {estudiantes.map((estudiante) => {
                                const promedio = calcularPromedioAmbito(
                                  estudiante.id,
                                  ambito.id
                                );

                                return (
                                  <tr key={estudiante.id}>
                                    <td className="border border-slate-300 px-3 py-2 text-sm">
                                      {estudiante.apellidos} {estudiante.nombres}
                                    </td>
                                    {destrezasAmbito.map((destreza) => {
                                      const calif = calificaciones.find(
                                        (c) =>
                                          c.estudianteId === estudiante.id &&
                                          c.destrezaId === destreza.id
                                      );
                                      const nota = calif?.nota || 0;

                                      return (
                                        <td
                                          key={destreza.id}
                                          className="border border-slate-300 px-3 py-2 text-center text-sm"
                                        >
                                          {nota > 0 ? nota : "-"}
                                        </td>
                                      );
                                    })}
                                    <td className="border border-slate-300 px-3 py-2 text-center font-bold bg-blue-50">
                                      {promedio > 0 ? promedio : "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeReport === "asistencia" && (
            <div>
              {estudiantes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FaExclamationTriangle className="text-4xl mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">No hay estudiantes</p>
                  <p className="text-sm">
                    No hay estudiantes registrados en este grado
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="border border-slate-300 px-3 py-3 text-left text-sm font-semibold">
                          Estudiante
                        </th>
                        <th className="border border-slate-300 px-3 py-3 text-center text-sm font-semibold w-20">
                          Presentes
                        </th>
                        <th className="border border-slate-300 px-3 py-3 text-center text-sm font-semibold w-20">
                          Tardanzas
                        </th>
                        <th className="border border-slate-300 px-3 py-3 text-center text-sm font-semibold w-20">
                          Ausentes
                        </th>
                        <th className="border border-slate-300 px-3 py-3 text-center text-sm font-semibold w-20">
                          Justificados
                        </th>
                        <th className="border border-slate-300 px-3 py-3 text-center text-sm font-semibold w-24">
                          % Asistencia
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {estudiantes.map((estudiante) => {
                        const asistencia = calcularAsistenciaEstudiante(
                          estudiante.id
                        );

                        return (
                          <tr key={estudiante.id}>
                            <td className="border border-slate-300 px-3 py-2 text-sm">
                              {estudiante.apellidos} {estudiante.nombres}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-green-700 font-semibold">
                              {asistencia.presentes}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-yellow-700 font-semibold">
                              {asistencia.tardanzas}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-red-700 font-semibold">
                              {asistencia.ausentes}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-center text-blue-700 font-semibold">
                              {asistencia.justificados}
                            </td>
                            <td
                              className={`border border-slate-300 px-3 py-2 text-center font-bold ${
                                asistencia.porcentaje >= 90
                                  ? "text-green-700"
                                  : asistencia.porcentaje >= 75
                                  ? "text-yellow-700"
                                  : "text-red-700"
                              }`}
                            >
                              {asistencia.porcentaje}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </Layout>
  );
}