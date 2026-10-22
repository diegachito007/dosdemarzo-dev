import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import {
  construirRefuerzoConHistorial,
  recalcularInsumos,
  type EntradaRefuerzo,
  type RefuerzoConHistorial,
} from "../utils/refuerzo";
import type { Estudiante, Grado } from "../types";
import Layout from "../components/Layout";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import {
  FaExclamationTriangle,
  FaGraduationCap,
  FaBook,
  FaUserGraduate,
  FaInfoCircle,
  FaSpinner,
  FaCheckCircle,
  FaUserTie,
  FaChalkboardTeacher,
  FaSyncAlt,
  FaTimes,
  FaFileExcel,
  FaEye,
  FaClipboardList,
} from "react-icons/fa";

// ==================== INTERFACES ====================

interface ActividadData {
  id: string;
  tipo: string;
  detalle: string;
  fecha: string;
  destrezaId: string;
  ambitoId: string;
  gradoId: string;
  periodoId?: string;
  estrategiaNota?: string;
  esConsolidado?: boolean;
  actividadesAgrupadas?: string[];
}

interface CalificacionData {
  id: string;
  estudianteId: string;
  actividadId: string;
  nota: number;
  observacion?: string;
  refuerzo?: {
    nota: number;
    detalle: string;
    fecha: string;
    estrategiaElegida?: string;
    aplicadoPor?: string;
    origen?: "formal" | "informal";
    historial?: EntradaRefuerzo[];
  } | null;
  docenteId?: string;
}

interface AsignaturaDocente {
  id: string;
  docenteId: string;
  gradoId: string;
  destrezaId: string;
  anioLectivoId: string;
  activo: boolean;
}

interface RegistroRiesgo {
  calificacionId: string;
  estudianteId: string;
  actividadId: string;
  estudianteNombre: string;
  gradoId: string;
  gradoNombre: string;
  gradoParalelo: string;
  destrezaId: string;
  materiaNombre: string;
  ambitoNombre: string;
  actividadDetalle: string;
  actividadTipo: string;
  actividadFecha: string;
  estrategiaActividad: string;
  notaOriginal: number;
  notaFinal: number;
  tieneRefuerzo: boolean;
  esConsolidado: boolean;
  observacion?: string;
}

interface UnidadSeccion {
  id: string;
  nombre: string;
  ambitoNombre: string;
  actividades: ActividadData[];
}

interface GrupoMateriaRiesgo {
  destrezaId: string;
  materiaNombre: string;
  ambitoNombre: string;
  registros: RegistroRiesgo[];
  estudiantesUnicos: number;
  conRefuerzo: number;
  notaPromedio: number;
}

type ModoVista = "tutor" | "docente";

// ==================== HELPERS ====================

const esGradoInicial = (nombre: string): boolean => {
  const n = (nombre || "").toLowerCase();
  return (
    n.includes("inicial 1") ||
    n.includes("inicial 2") ||
    n.includes("preparatoria")
  );
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const ESTRATEGIAS_NOTA = [
  { value: "promediar", label: "Promediar (Original + Refuerzo) / 2" },
  { value: "reemplazar", label: "Reemplazar (Refuerzo reemplaza Original)" },
  { value: "maxima", label: "Máxima (Mayor entre Original y Refuerzo)" },
];

const calcularNotaFinalRefuerzo = (
  notaOriginal: number,
  notaRefuerzo: number,
  estrategia: string,
): number => {
  switch (estrategia) {
    case "reemplazar":
      return round2(notaRefuerzo);
    case "maxima":
      return round2(Math.max(notaOriginal, notaRefuerzo));
    case "promediar":
    default:
      return round2((notaOriginal + notaRefuerzo) / 2);
  }
};

// ==================== COMPONENTE ====================

export default function ReporteNotas() {
  const { user, userData } = useAuth();
  const { grados, ambitos, destrezas, anioActivo, periodoActual, ready } =
    useData();
  const navigate = useNavigate();

  const [asignaturasDocente, setAsignaturasDocente] = useState<
    AsignaturaDocente[]
  >([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [actividades, setActividades] = useState<ActividadData[]>([]);
  const [calificaciones, setCalificaciones] = useState<CalificacionData[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [modoVista, setModoVista] = useState<ModoVista>("tutor");
  const [gradoTutorSel, setGradoTutorSel] = useState<string>("");
  const [gradoDocenteSel, setGradoDocenteSel] = useState<string>("");
  const [estudianteDetalleId, setEstudianteDetalleId] = useState<string | null>(null);

  const [showRefuerzoModal, setShowRefuerzoModal] = useState(false);
  const [refuerzoRegistro, setRefuerzoRegistro] = useState<{
    calificacionId: string;
    actividadId: string;
    estudianteNombre: string;
    materiaNombre: string;
    actividadDetalle: string;
    notaOriginal: number;
    estrategiaActividad: string;
  } | null>(null);
  const [refuerzoForm, setRefuerzoForm] = useState({
    nota: 7,
    detalle: "",
    fecha: new Date().toISOString().split("T")[0],
    estrategia: "promediar",
  });
  const [isGuardandoRefuerzo, setIsGuardandoRefuerzo] = useState(false);

  // Aviso flotante simple (éxito/error) para acciones como aplicar refuerzo.
  const [aviso, setAviso] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);
  const mostrarAviso = (
    type: "success" | "error" | "info" | "warning",
    message: string,
  ) => {
    setAviso({ type, message });
    setTimeout(() => setAviso(null), 6000);
  };

  const esAdmin = userData?.role === "super_admin";
  const esTutor = (userData?.tutorDe || []).length > 0;
  const tieneMaterias = asignaturasDocente.length > 0;

  const modoEfectivo = useMemo<ModoVista>(() => {
    if (modoVista === "tutor" && !esTutor) return "docente";
    if (modoVista === "docente" && !tieneMaterias && esTutor) return "tutor";
    return modoVista;
  }, [modoVista, esTutor, tieneMaterias]);

  const gradosDisponibles = useMemo(() => {
    if (!anioActivo) return [] as Grado[];
    const anioGrados = grados.filter(
      (g) => g.anioLectivoId === anioActivo.id && g.activo,
    );
    if (esAdmin) return anioGrados;
    const idsSet = new Set<string>();
    asignaturasDocente.forEach((a) => idsSet.add(a.gradoId));
    (userData?.tutorDe || []).forEach((id) => idsSet.add(id));
    return anioGrados.filter((g) => idsSet.has(g.id));
  }, [grados, anioActivo, asignaturasDocente, userData, esAdmin]);

  const gradosTutorizados = useMemo(() => {
    const tutorIds = new Set(userData?.tutorDe || []);
    return gradosDisponibles.filter((g) => tutorIds.has(g.id));
  }, [gradosDisponibles, userData]);

  const gradosDocenteMios = useMemo(() => {
    const misGradoIds = new Set(asignaturasDocente.map((a) => a.gradoId));
    return gradosDisponibles.filter((g) => misGradoIds.has(g.id));
  }, [gradosDisponibles, asignaturasDocente]);

  const gradoTutorEfectivo = useMemo(() => {
    if (gradoTutorSel && gradosTutorizados.some((g) => g.id === gradoTutorSel))
      return gradoTutorSel;
    return gradosTutorizados[0]?.id || "";
  }, [gradoTutorSel, gradosTutorizados]);

  const gradoDocenteEfectivo = useMemo(() => {
    if (
      gradoDocenteSel &&
      gradosDocenteMios.some((g) => g.id === gradoDocenteSel)
    )
      return gradoDocenteSel;
    return gradosDocenteMios[0]?.id || "";
  }, [gradoDocenteSel, gradosDocenteMios]);

  const gradoTutorActual = grados.find((g) => g.id === gradoTutorEfectivo);
  const gradoDocenteActual = grados.find((g) => g.id === gradoDocenteEfectivo);
  const esInicialDocente = esGradoInicial(gradoDocenteActual?.nombre || "");

  const misDestrezasDelGrado = useMemo(() => {
    return new Set(
      asignaturasDocente
        .filter((a) => a.gradoId === gradoDocenteEfectivo)
        .map((a) => a.destrezaId),
    );
  }, [asignaturasDocente, gradoDocenteEfectivo]);

  const misDestrezasTodas = useMemo(
    () => new Set(asignaturasDocente.map((a) => a.destrezaId)),
    [asignaturasDocente],
  );

  const misUnidadesDelGrado = useMemo(() => {
    return esInicialDocente
      ? new Set(
          destrezas
            .filter((d) => misDestrezasDelGrado.has(d.id))
            .map((d) => d.ambitoId),
        )
      : misDestrezasDelGrado;
  }, [esInicialDocente, destrezas, misDestrezasDelGrado]);

  const misUnidadesNombres = esInicialDocente
    ? ambitos
        .filter((a) => misUnidadesDelGrado.has(a.id))
        .map((a) => a.nombre)
    : destrezas
        .filter((d) => misUnidadesDelGrado.has(d.id))
        .map((d) => d.nombre);

  const shouldLoadData = ready && gradosDisponibles.length > 0;

  const loadKey = useMemo(
    () =>
      JSON.stringify({
        admin: esAdmin,
        grados: gradosDisponibles.map((g) => g.id),
        materias: asignaturasDocente.map((a) => a.destrezaId),
        periodo: periodoActual?.id || "",
      }),
    [esAdmin, gradosDisponibles, asignaturasDocente, periodoActual?.id],
  );

  const loading = shouldLoadData && loadedKey !== loadKey;

  useEffect(() => {
    if (!user?.uid || esAdmin || !anioActivo?.id) return;
    const q = query(
      collection(db, "asignaturasDocente"),
      where("docenteId", "==", user.uid),
      where("anioLectivoId", "==", anioActivo.id),
      where("activo", "==", true),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setAsignaturasDocente(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as AsignaturaDocente,
          ),
        );
      },
      (error) => {
        console.error("Error escuchando asignaturas:", error);
      },
    );
    return () => unsubscribe();
  }, [user?.uid, anioActivo?.id, esAdmin]);

  useEffect(() => {
    if (!shouldLoadData) return;
    const gradoIds = gradosDisponibles.map((g) => g.id);
    if (gradoIds.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    const estudiantesMap = new Map<string, Estudiante>();

    for (let i = 0; i < gradoIds.length; i += 10) {
      const lote = gradoIds.slice(i, i + 10);
      const q = query(
        collection(db, "estudiantes"),
        where("activo", "==", true),
        where("gradoId", "in", lote),
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              estudiantesMap.delete(change.doc.id);
            } else {
              estudiantesMap.set(change.doc.id, {
                id: change.doc.id,
                ...change.doc.data(),
              } as Estudiante);
            }
          });
          const todos = Array.from(estudiantesMap.values()).sort((a, b) =>
            a.apellidos.localeCompare(b.apellidos),
          );
          setEstudiantes(todos);
        },
        (error) => {
          console.error("Error escuchando estudiantes:", error);
        },
      );
      unsubscribers.push(unsubscribe);
    }
    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [shouldLoadData, gradosDisponibles]);

  const estudiantesFiltrados = useMemo(() => {
    const gradoIds = new Set(gradosDisponibles.map((g) => g.id));
    return estudiantes.filter((e) => gradoIds.has(e.gradoId));
  }, [estudiantes, gradosDisponibles]);

  useEffect(() => {
    if (!shouldLoadData || loadedKey === loadKey) return;

    const cargarReporte = async () => {
      try {
        const gradoIds = gradosDisponibles.map((g) => g.id);
        const tutorIds = new Set(userData?.tutorDe || []);
        const gradosTutorIds = gradoIds.filter((id) => tutorIds.has(id));
        const myDestrezaIds = Array.from(
          new Set(asignaturasDocente.map((a) => a.destrezaId)),
        );
        const periodoIdActivo = periodoActual?.id;

        const actividadesMap = new Map<string, ActividadData>();
        const agregarActividad = (act: ActividadData) => {
          if (!gradoIds.includes(act.gradoId)) return;
          actividadesMap.set(act.id, act);
        };

        if (esAdmin) {
          for (let i = 0; i < gradoIds.length; i += 10) {
            const lote = gradoIds.slice(i, i + 10);
            const q = periodoIdActivo
              ? query(
                  collection(db, "actividades"),
                  where("gradoId", "in", lote),
                  where("periodoId", "==", periodoIdActivo),
                )
              : query(
                  collection(db, "actividades"),
                  where("gradoId", "in", lote),
                );
            const snap = await getDocs(q);
            snap.docs.forEach((d) =>
              agregarActividad({ id: d.id, ...d.data() } as ActividadData),
            );
          }
        } else {
          for (let i = 0; i < gradosTutorIds.length; i += 10) {
            const lote = gradosTutorIds.slice(i, i + 10);
            const q = periodoIdActivo
              ? query(
                  collection(db, "actividades"),
                  where("gradoId", "in", lote),
                  where("periodoId", "==", periodoIdActivo),
                )
              : query(
                  collection(db, "actividades"),
                  where("gradoId", "in", lote),
                );
            const snap = await getDocs(q);
            snap.docs.forEach((d) =>
              agregarActividad({ id: d.id, ...d.data() } as ActividadData),
            );
          }
          for (let i = 0; i < myDestrezaIds.length; i += 30) {
            const lote = myDestrezaIds.slice(i, i + 30);
            const q = periodoIdActivo
              ? query(
                  collection(db, "actividades"),
                  where("destrezaId", "in", lote),
                  where("periodoId", "==", periodoIdActivo),
                )
              : query(
                  collection(db, "actividades"),
                  where("destrezaId", "in", lote),
                );
            const snap = await getDocs(q);
            snap.docs.forEach((d) =>
              agregarActividad({ id: d.id, ...d.data() } as ActividadData),
            );
          }
        }

        const actividadesBatch = Array.from(actividadesMap.values());
        setActividades(actividadesBatch);
        // Las calificaciones se cargan con un listener en vivo (ver efecto
        // dedicado) para que los refuerzos aplicados en otras páginas se
        // reflejen aquí sin recargar.
      } catch (error) {
        console.error("Error cargando reporte:", error);
      } finally {
        setLoadedKey(loadKey);
      }
    };
    cargarReporte();
  }, [
    shouldLoadData,
    loadKey,
    loadedKey,
    gradosDisponibles,
    asignaturasDocente,
    esAdmin,
    userData,
    periodoActual,
  ]);

  // ==================== CALIFICACIONES EN VIVO ====================
  // Listener por lotes de actividades: cualquier refuerzo aplicado en
  // Calificaciones o Refuerzo Pedagógico se refleja aquí sin recargar.
  useEffect(() => {
    if (!shouldLoadData || loadedKey !== loadKey) return;
    const actividadIds = actividades.map((a) => a.id).filter(Boolean);
    // Sin actividades no hace falta abrir suscripciones. Los datos antiguos
    // no se muestran porque las vistas se construyen a partir de actividades
    // vigentes; evitar setState aquí previene renders en cascada desde el efecto.
    if (actividadIds.length === 0) return;
    const calsMap = new Map<string, CalificacionData>();
    const unsubscribers: (() => void)[] = [];
    for (let i = 0; i < actividadIds.length; i += 30) {
      const lote = actividadIds.slice(i, i + 30);
      const unsubscribe = onSnapshot(
        query(
          collection(db, "calificaciones"),
          where("actividadId", "in", lote),
        ),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              calsMap.delete(change.doc.id);
            } else {
              calsMap.set(change.doc.id, {
                id: change.doc.id,
                ...change.doc.data(),
              } as CalificacionData);
            }
          });
          setCalificaciones(Array.from(calsMap.values()));
        },
        (error) => {
          console.error("Error escuchando calificaciones:", error);
        },
      );
      unsubscribers.push(unsubscribe);
    }
    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [shouldLoadData, loadKey, loadedKey, actividades]);

  // ==================== FILTRO DE INSUMOS (CONSOLIDADOS) ====================

  const idsAgrupados = useMemo(() => {
    const s = new Set<string>();
    actividades.forEach((a) => {
      if (a.esConsolidado && a.actividadesAgrupadas) {
        a.actividadesAgrupadas.forEach((id) => s.add(id));
      }
    });
    return s;
  }, [actividades]);

  const actividadesVisibles = useMemo(
    () => actividades.filter((a) => a.id && !idsAgrupados.has(a.id)),
    [actividades, idsAgrupados],
  );

  const calificacionesVisibles = useMemo(
    () => calificaciones.filter((c) => !idsAgrupados.has(c.actividadId)),
    [calificaciones, idsAgrupados],
  );

  // ==================== MAPA DE CALIFICACIONES ====================

  const calMap = useMemo(() => {
    const map = new Map<string, CalificacionData>();
    calificacionesVisibles.forEach((c) => {
      map.set(`${c.estudianteId}|${c.actividadId}`, c);
    });
    return map;
  }, [calificacionesVisibles]);

  const notaFinalDe = (c: CalificacionData): number => {
  const refuerzo = c.refuerzo as
    | (typeof c.refuerzo & {
        notaFinalAplicada?: number;
        historial?: Array<Record<string, unknown>>;
      })
    | undefined;

  if (typeof refuerzo?.notaFinalAplicada === "number") {
    return refuerzo.notaFinalAplicada;
  }

  if (refuerzo && typeof refuerzo.nota === "number") {
    return calcularNotaFinalRefuerzo(
      c.nota,
      refuerzo.nota,
      refuerzo.estrategiaElegida || "promediar",
    );
  }

  return c.nota;
};

  // ==================== VISTA TUTOR: REGISTROS DE RIESGO (< 7) ====================

  const registrosRiesgo = useMemo((): RegistroRiesgo[] => {
    if (!gradoTutorEfectivo) return [];
    const estudiantesMap = new Map(estudiantesFiltrados.map((e) => [e.id, e]));
    const actividadesMap = new Map(actividadesVisibles.map((a) => [a.id, a]));
    const gradosMap = new Map(grados.map((g) => [g.id, g]));
    const destrezasMap = new Map(destrezas.map((d) => [d.id, d]));
    const ambitosMap = new Map(ambitos.map((a) => [a.id, a]));

    const registros: RegistroRiesgo[] = [];
    calificacionesVisibles.forEach((cal) => {
      const nf = notaFinalDe(cal);
      if (nf >= 7) return;
      const estudiante = estudiantesMap.get(cal.estudianteId);
      const actividad = actividadesMap.get(cal.actividadId);
      if (!estudiante || !actividad) return;
      if (estudiante.gradoId !== gradoTutorEfectivo) return;
      const grado = gradosMap.get(estudiante.gradoId);
      const destreza = destrezasMap.get(actividad.destrezaId);
      const ambito = ambitosMap.get(
        actividad.ambitoId || destreza?.ambitoId || "",
      );

      registros.push({
        calificacionId: cal.id,
        estudianteId: estudiante.id,
        actividadId: actividad.id,
        estudianteNombre: `${estudiante.apellidos} ${estudiante.nombres}`,
        gradoId: estudiante.gradoId,
        gradoNombre: grado?.nombre || "—",
        gradoParalelo: grado?.paralelo || "",
        destrezaId: actividad.destrezaId,
        materiaNombre: destreza?.nombre || "—",
        ambitoNombre: ambito?.nombre || "—",
        actividadDetalle: actividad.detalle,
        actividadTipo: actividad.tipo,
        actividadFecha: actividad.fecha,
        estrategiaActividad: actividad.estrategiaNota || "promediar",
        notaOriginal: cal.nota,
        notaFinal: nf,
        tieneRefuerzo: !!cal.refuerzo,
        esConsolidado: !!actividad.esConsolidado,
        observacion: cal.observacion,
      });
    });
    registros.sort((a, b) => {
      if (a.notaFinal !== b.notaFinal) return a.notaFinal - b.notaFinal;
      return a.estudianteNombre.localeCompare(b.estudianteNombre);
    });
    return registros;
  }, [
    gradoTutorEfectivo,
    estudiantesFiltrados,
    actividadesVisibles,
    calificacionesVisibles,
    grados,
    destrezas,
    ambitos,
  ]);

  const gruposPorMateria = useMemo((): GrupoMateriaRiesgo[] => {
    const map = new Map<
      string,
      {
        destrezaId: string;
        materiaNombre: string;
        ambitoNombre: string;
        registros: RegistroRiesgo[];
        estudiantesSet: Set<string>;
        conRefuerzo: number;
        sumaNotas: number;
      }
    >();
    registrosRiesgo.forEach((r) => {
      const key = r.destrezaId;
      if (!map.has(key)) {
        map.set(key, {
          destrezaId: r.destrezaId,
          materiaNombre: r.materiaNombre,
          ambitoNombre: r.ambitoNombre,
          registros: [],
          estudiantesSet: new Set(),
          conRefuerzo: 0,
          sumaNotas: 0,
        });
      }
      const g = map.get(key)!;
      g.registros.push(r);
      g.estudiantesSet.add(r.estudianteId);
      if (r.tieneRefuerzo) g.conRefuerzo++;
      g.sumaNotas += r.notaFinal;
    });
    return Array.from(map.values())
      .map((g) => ({
        destrezaId: g.destrezaId,
        materiaNombre: g.materiaNombre,
        ambitoNombre: g.ambitoNombre,
        registros: g.registros,
        estudiantesUnicos: g.estudiantesSet.size,
        conRefuerzo: g.conRefuerzo,
        notaPromedio:
          g.registros.length > 0
            ? round2(g.sumaNotas / g.registros.length)
            : 0,
      }))
      .sort((a, b) => b.registros.length - a.registros.length);
  }, [registrosRiesgo]);

  const estudiantesUnicosEnRiesgo = useMemo(() => {
    const map = new Map<
      string,
      { estudiante: RegistroRiesgo; conteo: number; materias: Set<string> }
    >();
    registrosRiesgo.forEach((r) => {
      if (!map.has(r.estudianteId)) {
        map.set(r.estudianteId, {
          estudiante: r,
          conteo: 0,
          materias: new Set(),
        });
      }
      const entry = map.get(r.estudianteId)!;
      entry.conteo++;
      entry.materias.add(r.materiaNombre);
    });
    return Array.from(map.values()).sort((a, b) => b.conteo - a.conteo);
  }, [registrosRiesgo]);

  // ==================== VISTA DOCENTE: SECCIONES (MATRIZ) ====================

  const seccionesDocente = ((): UnidadSeccion[] => {
    if (!gradoDocenteEfectivo) return [];
    const esInicial = esInicialDocente;

    const unidades: { id: string; nombre: string; ambitoNombre: string }[] =
      Array.from(misUnidadesDelGrado).map((id) => {
        if (esInicial) {
          const a = ambitos.find((x) => x.id === id);
          return {
            id,
            nombre: a?.nombre || "—",
            ambitoNombre: a?.nombre || "—",
          };
        }
        const d = destrezas.find((x) => x.id === id);
        const a = ambitos.find((x) => x.id === (d?.ambitoId || ""));
        return {
          id,
          nombre: d?.nombre || "—",
          ambitoNombre: a?.nombre || "—",
        };
      });
    unidades.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return unidades
      .map((u) => {
        const acts = actividadesVisibles
          .filter(
            (a) =>
              a.gradoId === gradoDocenteEfectivo &&
              (esInicial ? (a.ambitoId || "") === u.id : a.destrezaId === u.id),
          )
          .sort(
            (a, b) =>
              a.fecha.localeCompare(b.fecha) ||
              a.detalle.localeCompare(b.detalle),
          );
        return { ...u, actividades: acts };
      })
      .filter((s) => s.actividades.length > 0);
  })();

  const estudiantesDelGradoDocente = useMemo(() => {
    return estudiantesFiltrados
      .filter((e) => e.gradoId === gradoDocenteEfectivo)
      .sort((a, b) => a.apellidos.localeCompare(b.apellidos));
  }, [estudiantesFiltrados, gradoDocenteEfectivo]);

  // Detalle académico del estudiante seleccionado en la vista docente.
  // Se construye con las actividades y calificaciones ya cargadas para el grado.
  const estudianteDetalle = useMemo(
    () => estudiantesDelGradoDocente.find((e) => e.id === estudianteDetalleId) || null,
    [estudiantesDelGradoDocente, estudianteDetalleId],
  );

  const notasDetalleEstudiante = useMemo(() => {
    if (!estudianteDetalleId || !gradoDocenteEfectivo) return [];
    return actividadesVisibles
      .filter((a) => {
        if (a.gradoId !== gradoDocenteEfectivo) return false;
        if (esInicialDocente) {
          const destreza = destrezas.find((d) => d.id === a.destrezaId);
          return misUnidadesDelGrado.has(a.ambitoId || destreza?.ambitoId || "");
        }
        return misDestrezasDelGrado.has(a.destrezaId);
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.detalle.localeCompare(b.detalle))
      .map((actividad) => ({
        actividad,
        calificacion: calMap.get(`${estudianteDetalleId}|${actividad.id}`) || null,
        materiaNombre: esInicialDocente
          ? ambitos.find((x) => x.id === (actividad.ambitoId || destrezas.find((d) => d.id === actividad.destrezaId)?.ambitoId))?.nombre || "—"
          : destrezas.find((d) => d.id === actividad.destrezaId)?.nombre || "—",
      }));
  }, [
    estudianteDetalleId,
    gradoDocenteEfectivo,
    actividadesVisibles,
    esInicialDocente,
    destrezas,
    ambitos,
    misUnidadesDelGrado,
    misDestrezasDelGrado,
    calMap,
  ]);

  // ==================== REFUERZO (compartido) ====================

  const abrirRefuerzo = (r: {
    calificacionId: string;
    actividadId: string;
    estudianteNombre: string;
    materiaNombre: string;
    actividadDetalle: string;
    notaOriginal: number;
    destrezaId: string;
    estrategiaActividad: string;
  }) => {
    if (!misDestrezasTodas.has(r.destrezaId)) return;
    const calificacionActual = calificaciones.find((c) => c.id === r.calificacionId);
    if (!calificacionActual || notaFinalDe(calificacionActual) >= 7) {
      mostrarAviso("info", "La nota final es 7 o más; no se puede aplicar otro refuerzo ni modificar esta calificación.");
      return;
    }
    setRefuerzoRegistro({
      calificacionId: r.calificacionId,
      actividadId: r.actividadId,
      estudianteNombre: r.estudianteNombre,
      materiaNombre: r.materiaNombre,
      actividadDetalle: r.actividadDetalle,
      notaOriginal: r.notaOriginal,
      estrategiaActividad: r.estrategiaActividad,
    });
    setRefuerzoForm({
      nota: 7,
      detalle: "",
      fecha: new Date().toISOString().split("T")[0],
      estrategia: r.estrategiaActividad || "promediar",
    });
    setShowRefuerzoModal(true);
  };

  const aplicarRefuerzo = async () => {
    if (!refuerzoRegistro) return;
    if (!refuerzoForm.detalle.trim()) return;
    setIsGuardandoRefuerzo(true);
    try {
      const calificacionActual = calificaciones.find(
        (c) => c.id === refuerzoRegistro.calificacionId,
      );
      if (!calificacionActual || notaFinalDe(calificacionActual) >= 7) {
        mostrarAviso("warning", "La nota final ya es 7 o más. No se aplicó un nuevo refuerzo.");
        setShowRefuerzoModal(false);
        setRefuerzoRegistro(null);
        return;
      }
      const previo =
        (calificacionActual.refuerzo || null) as RefuerzoConHistorial | null;
      const refuerzoData: EntradaRefuerzo = {
        nota: round2(refuerzoForm.nota),
        detalle: refuerzoForm.detalle.trim(),
        fecha: refuerzoForm.fecha,
        aplicadoPor: user?.uid || "",
        estrategiaElegida: refuerzoForm.estrategia as EntradaRefuerzo["estrategiaElegida"],
        origen: "informal",
      };
      const refuerzoConstruido = construirRefuerzoConHistorial(previo, refuerzoData);
      // Guardar el número secuencial en cada evento del historial.
      const refuerzoFinal = {
        ...refuerzoConstruido,
        historial: (refuerzoConstruido.historial || []).map((entrada, index) => ({
          ...entrada,
          numero: index + 1,
        })),
      };
      const actividadAfectada = refuerzoRegistro.actividadId;
      await updateDoc(
        doc(db, "calificaciones", refuerzoRegistro.calificacionId),
        {
          refuerzo: refuerzoFinal,
          updatedAt: serverTimestamp(),
        },
      );
      setCalificaciones((prev) =>
        prev.map((c) =>
          c.id === refuerzoRegistro.calificacionId
            ? { ...c, refuerzo: refuerzoFinal }
            : c,
        ),
      );
      setShowRefuerzoModal(false);
      setRefuerzoRegistro(null);
      mostrarAviso(
        "success",
        "Refuerzo aplicado: la nota final de la actividad quedó actualizada.",
      );
      // Si la actividad pertenece a un insumo consolidado, su promedio se
      // recalcula con la nota final (con refuerzo) recién guardada.
      const recalc = await recalcularInsumos([actividadAfectada]);
      if (recalc.actualizados > 0)
        mostrarAviso(
          "info",
          `Se recalculó el promedio de ${recalc.actualizados} insumo(s) consolidado(s).`,
        );
      else if (!recalc.ok)
        mostrarAviso(
          "warning",
          `El refuerzo se aplicó, pero falló el recálculo del insumo: ${recalc.error}`,
        );
    } catch (error) {
      console.error("Error aplicando refuerzo:", error);
      mostrarAviso(
        "error",
        `No se pudo aplicar el refuerzo: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsGuardandoRefuerzo(false);
    }
  };

  const notaFinalEstimada = refuerzoRegistro
    ? calcularNotaFinalRefuerzo(
        refuerzoRegistro.notaOriginal,
        refuerzoForm.nota,
        refuerzoForm.estrategia,
      )
    : 0;

  // ==================== DESCARGA EXCEL POR SECCIÓN (VISTA DOCENTE) ====================

  const exportarSeccionExcel = (sec: UnidadSeccion) => {
    try {
      const data = estudiantesDelGradoDocente.map((est, idx) => {
        let suma = 0;
        let conteo = 0;
        const row: Record<string, string | number> = {
          "N°": idx + 1,
          Apellidos: est.apellidos,
          Nombres: est.nombres,
        };
        sec.actividades.forEach((a) => {
          const cal = calMap.get(`${est.id}|${a.id}`);
          const etiqueta = a.esConsolidado ? `[INSUMO] ` : "";
          const columna = `${etiqueta}${a.tipo}: ${a.detalle} (${a.fecha})`;
          if (!cal) {
            row[columna] = "—";
          } else {
            const nf = notaFinalDe(cal);
            row[columna] = nf;
            if (cal.refuerzo) {
              row[`${columna} (Original)`] = cal.nota;
              row[`${columna} (Refuerzo)`] = cal.refuerzo.nota;
            }
            suma += nf;
            conteo++;
          }
        });
        row["Promedio"] = conteo > 0 ? round2(suma / conteo) : "—";
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0] || {}).map((col) => {
        const maxWidth = data.reduce((max, row) => {
          const cellValue = String(row[col] ?? "");
          return Math.max(max, cellValue.length);
        }, col.length);
        return { wch: Math.min(maxWidth + 2, 40) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sec.nombre.substring(0, 31));

      const now = new Date();
      const fechaStr = now.toISOString().split("T")[0];
      const nombreGrado =
        gradoDocenteActual?.nombre.replace(/ /g, "_") || "Grado";
      const paralelo = gradoDocenteActual?.paralelo.replace(/ /g, "_") || "";
      const materiaLimpia = sec.nombre.replace(/[^a-zA-Z0-9]/g, "_");
      const nombreArchivo = `${nombreGrado}_${paralelo}_${materiaLimpia}_${fechaStr}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);
    } catch (error) {
      console.error("Error exportando Excel:", error);
    }
  };

  // ==================== RENDER ====================

  if (!ready) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="animate-spin text-3xl text-amber-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            {esTutor && (
              <button
                onClick={() => setModoVista("tutor")}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  modoEfectivo === "tutor"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FaUserTie />
                Vista Tutor
              </button>
            )}
            {tieneMaterias && (
              <button
                onClick={() => setModoVista("docente")}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  modoEfectivo === "docente"
                    ? "bg-cyan-600 text-white shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FaChalkboardTeacher />
                Vista Docente
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <label className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
          <FaGraduationCap className="text-blue-600" />
          {modoEfectivo === "tutor"
            ? "Grado que tutoras"
            : "Grado donde dictas"}
        </label>
        <div className="flex flex-wrap gap-2">
          {(modoEfectivo === "tutor"
            ? gradosTutorizados
            : gradosDocenteMios
          ).map((g) => {
            const sel =
              modoEfectivo === "tutor"
                ? gradoTutorEfectivo === g.id
                : gradoDocenteEfectivo === g.id;
            return (
              <button
                key={g.id}
                onClick={() =>
                  modoEfectivo === "tutor"
                    ? setGradoTutorSel(g.id)
                    : setGradoDocenteSel(g.id)
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  sel
                    ? modoEfectivo === "tutor"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-cyan-600 text-white border-cyan-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                }`}
              >
                {g.nombre} - {g.paralelo}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
          <FaInfoCircle className="inline mr-1 text-blue-600" />
          {modoEfectivo === "tutor" ? (
            <>
              <strong>Vista Tutor:</strong> solo calificaciones{" "}
              <strong className="text-red-600">menores a 7</strong> de{" "}
              <strong>
                {gradoTutorActual?.nombre} {gradoTutorActual?.paralelo}
              </strong>{" "}
              en todas las materias del grado.
            </>
          ) : (
            <>
              <strong>Vista Docente:</strong> tus materias en{" "}
              <strong>
                {gradoDocenteActual?.nombre} {gradoDocenteActual?.paralelo}
              </strong>
              : <strong>{misUnidadesNombres.join(", ") || "—"}</strong>.
            </>
          )}
          {periodoActual && (
            <>
              {" "}
              · Trimestre activo: <strong>{periodoActual.nombre}</strong>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <FaSpinner className="animate-spin text-4xl text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600 text-sm font-medium">
            Cargando consolidado...
          </p>
        </div>
      ) : modoEfectivo === "tutor" ? (
        registrosRiesgo.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="bg-green-100 rounded-full p-5 mb-4 inline-block">
              <FaCheckCircle className="text-4xl text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              ¡Excelente! No hay estudiantes en riesgo
            </h3>
            <p className="text-slate-600 text-sm">
              No se encontraron calificaciones menores a 7 en{" "}
              <strong>
                {gradoTutorActual?.nombre} {gradoTutorActual?.paralelo}
              </strong>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <FaExclamationTriangle className="text-red-600 text-xl" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Registros &lt; 7
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {registrosRiesgo.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-3 rounded-lg">
                    <FaUserGraduate className="text-amber-600 text-xl" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Estudiantes en riesgo
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {estudiantesUnicosEnRiesgo.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <FaCheckCircle className="text-green-600 text-xl" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">
                      Con refuerzo
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {registrosRiesgo.filter((r) => r.tieneRefuerzo).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-linear-to-r from-purple-600 to-purple-700 px-5 py-4 flex items-center gap-3">
                <FaUserGraduate className="text-white text-xl" />
                <div>
                  <h3 className="text-white font-semibold">
                    Resumen por Estudiante
                  </h3>
                  <p className="text-white/80 text-xs">
                    {estudiantesUnicosEnRiesgo.length} estudiante(s) con notas
                    menores a 7
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {estudiantesUnicosEnRiesgo.map(
                  ({ estudiante, conteo, materias }) => (
                    <div
                      key={estudiante.estudianteId}
                      className="p-4 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold text-slate-900 text-sm">
                              {estudiante.estudianteNombre}
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Array.from(materias)
                              .slice(0, 4)
                              .map((m) => (
                                <span
                                  key={m}
                                  className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
                                >
                                  {m}
                                </span>
                              ))}
                            {materias.size > 4 && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                +{materias.size - 4} más
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold shrink-0 ${
                            conteo >= 5
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : conteo >= 3
                                ? "bg-orange-100 text-orange-700 border border-orange-300"
                                : "bg-amber-100 text-amber-700 border border-amber-300"
                          }`}
                        >
                          {conteo} {conteo === 1 ? "nota" : "notas"} &lt; 7
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-linear-to-r from-red-500 to-red-600 px-5 py-4 flex items-center gap-3">
                  <FaExclamationTriangle className="text-white text-xl" />
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">
                      Detalle de Calificaciones Bajas
                    </h3>
                    <p className="text-white/80 text-xs">
                      {registrosRiesgo.length} registro(s) agrupado(s) en{" "}
                      {gruposPorMateria.length} materia(s)
                    </p>
                  </div>
                </div>
              </div>

              {gruposPorMateria.map((grupo) => (
                <div
                  key={grupo.destrezaId}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="bg-linear-to-r from-slate-50 to-slate-100 px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2 rounded-lg">
                        <FaBook className="text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {grupo.materiaNombre}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {grupo.ambitoNombre}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-300 text-red-700 rounded-full text-[11px] font-bold">
                        {grupo.registros.length}{" "}
                        {grupo.registros.length === 1 ? "nota" : "notas"} &lt; 7
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-700 rounded-full text-[11px] font-bold">
                        <FaUserGraduate className="text-[9px]" />{" "}
                        {grupo.estudiantesUnicos} estudiante
                        {grupo.estudiantesUnicos !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 border border-green-300 text-green-700 rounded-full text-[11px] font-bold">
                        <FaCheckCircle className="text-[9px]" />{" "}
                        {grupo.conRefuerzo} refuerzo
                        {grupo.conRefuerzo !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 border border-slate-300 text-slate-700 rounded-full text-[11px] font-bold">
                        Promedio: {grupo.notaPromedio}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-700 text-xs">
                            Estudiante
                          </th>
                          <th className="text-left px-3 py-2.5 font-semibold text-slate-700 text-xs">
                            Actividad
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold text-slate-700 text-xs">
                            Fecha
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold text-slate-700 text-xs">
                            Nota
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold text-slate-700 text-xs">
                            Acción
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {grupo.registros.map((r, idx) => (
                          <tr
                            key={`${r.estudianteId}-${r.calificacionId}-${idx}`}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-900 text-xs">
                                {r.estudianteNombre}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              {r.esConsolidado && (
                                <span className="inline-block text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mb-0.5">
                                  INSUMO
                                </span>
                              )}
                              <p className="text-xs font-medium text-slate-900">
                                {r.actividadDetalle}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {r.actividadTipo}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-center text-xs text-slate-600">
                              {r.actividadFecha}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.tieneRefuerzo ? (
                                <>
                                  <span
                                    className={`inline-block px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-300`}
                                    title={`Nota final tras refuerzo (estrategia aplicada)`}
                                  >
                                    {r.notaFinal}
                                  </span>
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    antes: {r.notaOriginal}
                                  </p>
                                </>
                              ) : (
                                <span
                                  className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                    r.notaFinal < 5
                                      ? "bg-red-100 text-red-700 border border-red-300"
                                      : "bg-amber-100 text-amber-700 border border-amber-300"
                                  }`}
                                >
                                  {r.notaOriginal}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {misDestrezasTodas.has(r.destrezaId) ? (
                                r.notaFinal < 7 && !r.esConsolidado ? (
                                  <button
                                    onClick={() =>
                                      abrirRefuerzo({
                                        calificacionId: r.calificacionId,
                                        actividadId: r.actividadId,
                                        estudianteNombre: r.estudianteNombre,
                                        materiaNombre: r.materiaNombre,
                                        actividadDetalle: r.actividadDetalle,
                                        notaOriginal: r.notaOriginal,
                                        destrezaId: r.destrezaId,
                                        estrategiaActividad:
                                          r.estrategiaActividad,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    title={r.tieneRefuerzo ? "Aplicar otro refuerzo mientras la nota siga bajo 7" : "Aplicar refuerzo"}
                                  >
                                    <FaSyncAlt className="text-[10px]" />
                                    {r.tieneRefuerzo ? "Otro refuerzo" : "Refuerzo"}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-green-600 font-semibold">
                                    {r.tieneRefuerzo ? "Nota aprobada · protegida" : "No disponible"}
                                  </span>
                                )
                              ) : (
                                <span
                                  className="text-[10px] text-slate-400"
                                  title="Materia de otro docente"
                                >
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : seccionesDocente.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="bg-slate-100 rounded-full p-5 mb-4 inline-block">
            <FaBook className="text-4xl text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Sin actividades registradas
          </h3>
          <p className="text-slate-600 text-sm">
            Aún no hay actividades con calificaciones en tus materias de este
            grado y trimestre.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {seccionesDocente.map((sec) => (
            <div
              key={sec.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="bg-linear-to-r from-cyan-600 to-cyan-700 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaBook className="text-white text-lg" />
                  <div>
                    <h3 className="text-white font-semibold">{sec.nombre}</h3>
                    <p className="text-white/80 text-xs">{sec.ambitoNombre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/90 text-xs bg-white/20 px-2 py-1 rounded-full">
                    {sec.actividades.length} actividad(es)
                  </span>
                  <button
                    onClick={() =>
                      navigate(
                        `/refuerzo-pedagogico?nuevo=1&gradoId=${gradoDocenteEfectivo}&destrezaId=${sec.id}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    title={`Generar proceso de refuerzo pedagógico para ${sec.nombre}`}
                  >
                    <FaSyncAlt className="text-sm" />
                    <span className="hidden sm:inline">Refuerzo</span>
                  </button>
                  <button
                    onClick={() => exportarSeccionExcel(sec)}
                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    title={`Descargar Excel de ${sec.nombre}`}
                  >
                    <FaFileExcel className="text-sm" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 text-xs w-10">
                        #
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700 text-xs min-w-45 sticky left-0 bg-slate-50">
                        Estudiante
                      </th>
                      {sec.actividades.map((a) => (
                        <th
                          key={a.id}
                          className="text-center px-2 py-2 font-semibold text-slate-700 text-xs min-w-28"
                        >
                          {a.esConsolidado && (
                            <div className="text-[8px] font-bold text-purple-600 uppercase tracking-wide">
                              Insumo
                            </div>
                          )}
                          <div className="text-[11px] font-bold text-slate-800">
                            {a.tipo}
                          </div>
                          <div
                            className="text-[10px] font-normal text-slate-600 truncate max-w-30"
                            title={a.detalle}
                          >
                            {a.detalle}
                          </div>
                          <div className="text-[10px] font-normal text-slate-500">
                            {a.fecha}
                          </div>
                        </th>
                      ))}
                      <th className="text-center px-2 py-2 font-semibold text-slate-700 text-xs w-16">
                        Prom
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {estudiantesDelGradoDocente.map((est, idx) => {
                      let suma = 0;
                      let conteo = 0;
                      return (
                        <tr key={est.id} className="hover:bg-slate-50">
                          <td className="px-2 py-2 text-center text-xs text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 sticky left-0 bg-white">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-900 text-xs truncate">
                                  {est.apellidos} {est.nombres}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEstudianteDetalleId(est.id)}
                                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                                  title={`Ver detalle de notas de ${est.apellidos} ${est.nombres}`}
                                >
                                  <FaEye className="text-[10px]" />
                                  Ver detalle
                                </button>
                              </div>
                            </div>
                          </td>
                          {sec.actividades.map((a) => {
                            const cal = calMap.get(`${est.id}|${a.id}`);
                            if (!cal) {
                              return (
                                <td
                                  key={a.id}
                                  className="px-2 py-2 text-center text-slate-300 text-xs"
                                >
                                  —
                                </td>
                              );
                            }
                            const nf = notaFinalDe(cal);
                            suma += nf;
                            conteo++;
                            const puedeRefuerzo =
                              !a.esConsolidado &&
                              nf < 7 &&
                              misDestrezasTodas.has(a.destrezaId);
                            const cls =
                              nf >= 9
                                ? "bg-green-100 text-green-800 border-green-300"
                                : nf >= 7
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : nf >= 5
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-red-100 text-red-800 border-red-300";
                            return (
                              <td key={a.id} className="px-2 py-2 text-center">
                                {puedeRefuerzo ? (
                                  <button
                                    onClick={() =>
                                      abrirRefuerzo({
                                        calificacionId: cal.id,
                                        actividadId: a.id,
                                        estudianteNombre: `${est.apellidos} ${est.nombres}`,
                                        materiaNombre: sec.nombre,
                                        actividadDetalle: a.detalle,
                                        notaOriginal: cal.nota,
                                        destrezaId: a.destrezaId,
                                        estrategiaActividad:
                                          a.estrategiaNota || "promediar",
                                      })
                                    }
                                    className={`inline-block px-2 py-1 rounded text-xs font-bold border ${cls} hover:ring-2 hover:ring-orange-400 cursor-pointer`}
                                    title={cal.refuerzo ? "Aplicar otro refuerzo mientras la nota final siga bajo 7" : "Aplicar refuerzo"}
                                  >
                                    {round2(nf)}
                                  </button>
                                ) : (
                                  <span
                                    className={`inline-block px-2 py-1 rounded text-xs font-bold border ${cls}`}
                                    title={
                                      cal.refuerzo
                                        ? `Refuerzo de ${cal.nota} → ${round2(nf)}`
                                        : a.esConsolidado
                                          ? "Insumo consolidado (promedio)"
                                          : undefined
                                    }
                                  >
                                    {round2(nf)}
                                    {cal.refuerzo && (
                                      <span className="block text-[9px] font-normal text-slate-500">
                                        de {cal.nota}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                conteo === 0
                                  ? "text-slate-400"
                                  : suma / conteo >= 7
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {conteo > 0 ? round2(suma / conteo) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {estudianteDetalle && (
        <div
          className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5"
          onClick={() => setEstudianteDetalleId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-notas-titulo"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-cyan-100 p-2.5 text-cyan-700">
                  <FaClipboardList className="text-lg" />
                </div>
                <div className="min-w-0">
                  <h3 id="detalle-notas-titulo" className="truncate text-base font-bold text-slate-900">
                    Detalle de calificaciones
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    {estudianteDetalle.apellidos} {estudianteDetalle.nombres}
                    {" · "}{gradoDocenteActual?.nombre} {gradoDocenteActual?.paralelo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEstudianteDetalleId(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="Cerrar detalle de calificaciones"
              >
                <FaTimes />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-3 sm:px-5">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Actividades</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{notasDetalleEstudiante.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Con nota registrada</p>
                <p className="mt-1 text-lg font-bold text-slate-800">
                  {notasDetalleEstudiante.filter((x) => x.calificacion).length}
                </p>
              </div>
              <div className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:col-span-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Refuerzos registrados</p>
                <p className="mt-1 text-lg font-bold text-emerald-800">
                  {notasDetalleEstudiante.reduce((total, x) => {
                    const r = x.calificacion?.refuerzo as
                      | (NonNullable<CalificacionData["refuerzo"]> & { historial?: Array<Record<string, unknown>> })
                      | null
                      | undefined;
                    return total + (Array.isArray(r?.historial) && r.historial.length > 0 ? r.historial.length : r ? 1 : 0);
                  }, 0)}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {notasDetalleEstudiante.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No hay actividades registradas para las materias de este grado.
                </div>
              ) : (
                <div className="space-y-3">
                  {notasDetalleEstudiante.map(({ actividad, calificacion, materiaNombre }) => {
                    const notaOriginal = calificacion?.nota;
                    const notaFinal = calificacion ? notaFinalDe(calificacion) : null;
                    const refuerzo = calificacion?.refuerzo as
                      | (NonNullable<CalificacionData["refuerzo"]> & {
                          historial?: Array<Record<string, unknown>>;
                          notaFinalAplicada?: number;
                        })
                      | null
                      | undefined;
                    const historial = Array.isArray(refuerzo?.historial) ? refuerzo.historial : [];
                    const entradasRefuerzo: Array<Record<string, unknown>> =
                      historial.length > 0
                        ? historial
                        : refuerzo
                          ? [{
                              numero: 1,
                              nota: refuerzo.nota,
                              detalle: refuerzo.detalle,
                              fecha: refuerzo.fecha,
                              estrategiaElegida: refuerzo.estrategiaElegida,
                              origen: refuerzo.origen || "informal",
                              aplicadoPor: refuerzo.aplicadoPor || "",
                            }]
                          : [];

                    return (
                      <article key={actividad.id} className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="flex flex-col gap-2 bg-slate-50 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800">{materiaNombre}</span>
                              <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{actividad.tipo}</span>
                              {actividad.esConsolidado && (
                                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">INSUMO</span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900">{actividad.detalle || "Actividad sin título"}</h4>
                            <p className="mt-0.5 text-[11px] text-slate-500">Fecha: {actividad.fecha || "—"}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                              <p className="text-[9px] font-semibold uppercase text-slate-500">Original</p>
                              <p className="text-sm font-bold text-slate-700">{typeof notaOriginal === "number" ? notaOriginal : "—"}</p>
                            </div>
                            <div className={`rounded-lg border px-3 py-2 text-center ${
                              notaFinal === null ? "border-slate-200 bg-white text-slate-400" :
                              notaFinal >= 7 ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
                              "border-rose-200 bg-rose-50 text-rose-800"
                            }`}>
                              <p className="text-[9px] font-semibold uppercase">Final</p>
                              <p className="text-sm font-bold">{notaFinal === null ? "—" : round2(notaFinal)}</p>
                            </div>
                          </div>
                        </div>

                        {calificacion?.observacion && (
                          <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600 sm:px-4">
                            <span className="font-semibold">Observación:</span> {calificacion.observacion}
                          </div>
                        )}

                        <div className="border-t border-slate-100 px-3 py-3 sm:px-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-800">Historial de refuerzos</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              entradasRefuerzo.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {entradasRefuerzo.length ? `${entradasRefuerzo.length} registrado(s)` : "Sin refuerzo"}
                            </span>
                          </div>
                          {entradasRefuerzo.length === 0 ? (
                            <p className="text-xs text-slate-400">No se ha aplicado refuerzo a esta actividad.</p>
                          ) : (
                            <div className="space-y-2">
                              {entradasRefuerzo.map((entrada, idx) => {
                                const origen = String(entrada.origen || "informal").toLowerCase();
                                const esFormal = origen === "formal";
                                const estrategia = String(entrada.estrategiaElegida || refuerzo?.estrategiaElegida || "promediar");
                                const estrategiaLabel = ESTRATEGIAS_NOTA.find((x) => x.value === estrategia)?.label || estrategia;
                                return (
                                  <div key={`${actividad.id}-refuerzo-${idx}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                          esFormal ? "bg-violet-100 text-violet-700" : "bg-orange-100 text-orange-700"
                                        }`}>
                                          {esFormal ? "Refuerzo formal" : "Refuerzo informal"}
                                        </span>
                                        <span className="text-[10px] text-slate-500">#{String(entrada.numero ?? idx + 1)} · {String(entrada.fecha || "Fecha no registrada")}</span>
                                      </div>
                                      <p className="text-xs text-slate-700">{String(entrada.detalle || "Sin detalle disponible")}</p>
                                      <p className="mt-1 text-[10px] text-slate-500">Estrategia: {estrategiaLabel}</p>
                                    </div>
                                    <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-center">
                                      <p className="text-[9px] font-semibold uppercase text-slate-500">Nota de refuerzo</p>
                                      <p className="text-base font-bold text-slate-800">{typeof entrada.nota === "number" ? entrada.nota : "—"}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setEstudianteDetalleId(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Cerrar detalle
              </button>
            </footer>
          </section>
        </div>
      )}

      {showRefuerzoModal && refuerzoRegistro && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <FaSyncAlt className="text-orange-600 text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Aplicar Refuerzo
                  </h3>
                  <p className="text-xs text-slate-500">
                    {refuerzoRegistro.materiaNombre} ·{" "}
                    {refuerzoRegistro.actividadDetalle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRefuerzoModal(false);
                  setRefuerzoRegistro(null);
                }}
                disabled={isGuardandoRefuerzo}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <FaTimes />
              </button>
            </div>
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 font-semibold">
                {refuerzoRegistro.estudianteNombre}
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Nota original: <strong>{refuerzoRegistro.notaOriginal}</strong>
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nota de Refuerzo *{" "}
                  <span className="text-xs text-slate-500 font-normal">
                    (0 - 10)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  maxLength={5}
                  value={String(refuerzoForm.nota)}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const regex = /^\d*(\.\d{0,2})?$/;
                    if (valor === "" || regex.test(valor)) {
                      if (valor === "") {
                        setRefuerzoForm({ ...refuerzoForm, nota: 0 });
                      } else if (/^\d+(\.\d+)?$/.test(valor)) {
                        const num = parseFloat(valor);
                        if (num <= 10) {
                          setRefuerzoForm({ ...refuerzoForm, nota: num });
                        }
                      }
                    }
                  }}
                  placeholder="Ej: 8.5"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Estrategia de cálculo *
                </label>
                <select
                  value={refuerzoForm.estrategia}
                  onChange={(e) =>
                    setRefuerzoForm({
                      ...refuerzoForm,
                      estrategia: e.target.value,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                >
                  {ESTRATEGIAS_NOTA.map((estrategia) => (
                    <option key={estrategia.value} value={estrategia.value}>
                      {estrategia.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Detalle del Refuerzo *
                </label>
                <input
                  type="text"
                  value={refuerzoForm.detalle}
                  onChange={(e) =>
                    setRefuerzoForm({
                      ...refuerzoForm,
                      detalle: e.target.value,
                    })
                  }
                  placeholder="Ej: Ejercicios adicionales de práctica"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Fecha del Refuerzo *
                </label>
                <input
                  type="date"
                  value={refuerzoForm.fecha}
                  onChange={(e) =>
                    setRefuerzoForm({ ...refuerzoForm, fecha: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <p className="font-semibold mb-1">Nota final estimada:</p>
                <p className="text-lg font-bold text-blue-900">
                  {notaFinalEstimada}
                </p>
                <p className="text-[10px] text-blue-700 mt-1">
                  Original {refuerzoRegistro.notaOriginal} + Refuerzo{" "}
                  {refuerzoForm.nota} · estrategia{" "}
                  {
                    ESTRATEGIAS_NOTA.find(
                      (e) => e.value === refuerzoForm.estrategia,
                    )?.label.split(" ")[0]
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={aplicarRefuerzo}
                disabled={
                  isGuardandoRefuerzo ||
                  refuerzoForm.nota <= 0 ||
                  refuerzoForm.nota > 10 ||
                  !refuerzoForm.detalle.trim()
                }
                className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGuardandoRefuerzo ? (
                  <>
                    <FaSpinner className="animate-spin text-xs" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FaSyncAlt className="text-xs" />
                    Aplicar Refuerzo
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowRefuerzoModal(false);
                  setRefuerzoRegistro(null);
                }}
                disabled={isGuardandoRefuerzo}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div className="fixed bottom-4 right-4 z-60 max-w-sm">
          <div
            className={`flex items-start gap-2 p-3 rounded-lg shadow-lg border text-sm ${
              aviso.type === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : aviso.type === "error"
                  ? "bg-red-50 border-red-300 text-red-800"
                  : aviso.type === "warning"
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "bg-blue-50 border-blue-300 text-blue-800"
            }`}
          >
            {aviso.type === "success" ? (
              <FaCheckCircle className="mt-0.5 shrink-0" />
            ) : aviso.type === "error" ? (
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
            ) : (
              <FaInfoCircle className="mt-0.5 shrink-0" />
            )}
            <span className="whitespace-pre-wrap">{aviso.message}</span>
            <button
              onClick={() => setAviso(null)}
              className="ml-1 text-current/60 hover:text-current shrink-0"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}