import {
  useState,
  useEffect,
  startTransition,
  useCallback,
  useRef,
} from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { Ambito, Destreza, Grado, AnioLectivo } from "../types";
import Layout from "../components/Layout";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes,
  FaBook,
  FaTasks,
  FaArrowLeft,
  FaExclamationTriangle,
  FaInfoCircle,
  FaUpload,
  FaSpinner,
  FaPrint,
  FaCalendarAlt,
  FaUserCheck,
  FaCopy,
} from "react-icons/fa";

export default function AmbitosDestrezas() {
  const { user } = useAuth();
  const [grados, setGrados] = useState<Grado[]>([]);
  const [aniosLectivos, setAniosLectivos] = useState<AnioLectivo[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [todosLosAmbitos, setTodosLosAmbitos] = useState<Ambito[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGradoId, setSelectedGradoId] = useState("");
  const [currentView, setCurrentView] = useState<"ambitos" | "destrezas">(
    "ambitos",
  );
  const [selectedAmbitoId, setSelectedAmbitoId] = useState<string | null>(null);
  const [showAmbitoForm, setShowAmbitoForm] = useState(false);
  const [editingAmbitoId, setEditingAmbitoId] = useState<string | null>(null);
  const [ambitoFormData, setAmbitoFormData] = useState({
    nombre: "",
    orden: 0,
  });

  const [isAmbitoMassive, setIsAmbitoMassive] = useState(false);
  const [ambitoMassiveData, setAmbitoMassiveData] = useState("");
  const [parsedAmbitos, setParsedAmbitos] = useState<string[]>([]);
  const [showConfirmAmbitoModal, setShowConfirmAmbitoModal] = useState(false);

  const [showDestrezaForm, setShowDestrezaForm] = useState(false);
  const [editingDestrezaId, setEditingDestrezaId] = useState<string | null>(
    null,
  );
  const [destrezaMassiveData, setDestrezaMassiveData] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // ✅ NUEVO: Estados para copiar a otros grados
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedDestGrados, setSelectedDestGrados] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  const destrezaFormRef = useRef<HTMLDivElement>(null);

  const resetAmbitoForm = useCallback(() => {
    setAmbitoFormData({ nombre: "", orden: 0 });
    setEditingAmbitoId(null);
    setShowAmbitoForm(false);
    setIsAmbitoMassive(false);
    setAmbitoMassiveData("");
    setParsedAmbitos([]);
    setShowConfirmAmbitoModal(false);
    setValidationErrors([]);
  }, []);

  const resetDestrezaForm = useCallback(() => {
    setDestrezaMassiveData("");
    setEditingDestrezaId(null);
    setShowDestrezaForm(false);
    setValidationErrors([]);
  }, []);

  const cargarAniosLectivos = useCallback(async () => {
    try {
      const q = query(
        collection(db, "aniosLectivos"),
        where("activo", "==", true),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as AnioLectivo,
      );
      startTransition(() => {
        setAniosLectivos(data);
      });
    } catch (error) {
      console.error("Error cargando años lectivos:", error);
    }
  }, []);

  const cargarGrados = useCallback(async () => {
    try {
      const anioActivo = aniosLectivos.find((a) => a.activo);

      if (!anioActivo) {
        startTransition(() => {
          setGrados([]);
          setLoading(false);
        });
        return;
      }

      const q = query(
        collection(db, "grados"),
        where("anioLectivoId", "==", anioActivo.id),
        where("activo", "==", true),
        orderBy("orden", "asc"),
      );

      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Grado,
      );

      startTransition(() => {
        setGrados(data);
        if (data.length > 0 && !selectedGradoId) {
          setSelectedGradoId(data[0].id);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando grados:", error);
      startTransition(() => setLoading(false));
    }
  }, [selectedGradoId, aniosLectivos]);

  // ✅ SIN orderBy para evitar índices compuestos
  const cargarTodosLosAmbitos = useCallback(async () => {
    try {
      const q = query(collection(db, "ambitos"), where("activo", "==", true));
      const snap = await getDocs(q);
      const data = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Ambito)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      startTransition(() => setTodosLosAmbitos(data));
    } catch (error) {
      console.error("Error cargando todos los ámbitos:", error);
    }
  }, []);

  const cargarAmbitos = useCallback(async (gradoId: string) => {
    try {
      startTransition(() => {
        setLoading(true);
      });

      const q = query(
        collection(db, "ambitos"),
        where("gradoId", "==", gradoId),
        orderBy("nombre", "asc"),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Ambito,
      );

      startTransition(() => {
        setAmbitos(data);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando ámbitos:", error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  const cargarDestrezas = useCallback(async (gradoId: string) => {
    try {
      const q = query(
        collection(db, "destrezas"),
        where("gradoId", "==", gradoId),
        orderBy("orden", "asc"),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Destreza,
      );

      startTransition(() => {
        setDestrezas(data);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error cargando destrezas:", error);
      startTransition(() => {
        setLoading(false);
      });
    }
  }, []);

  const parseAmbitosMassiveData = useCallback(
    (data: string): { ambitos: string[]; parseErrors: string[] } => {
      const lines = data.trim().split("\n");
      const ambitosList: string[] = [];
      const parseErrors: string[] = [];

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        if (trimmedLine.length < 1) {
          parseErrors.push(
            `Línea ${index + 1}: El nombre del ámbito no puede estar vacío.`,
          );
          return;
        }

        ambitosList.push(trimmedLine);
      });

      return { ambitos: ambitosList, parseErrors };
    },
    [],
  );

  const validarAmbitosMasivos = useCallback(
    (ambitosList: string[]): string[] => {
      const allErrors: string[] = [];
      const nombresVistos = new Set<string>();

      ambitosList.forEach((nombre, index) => {
        const errors: string[] = [];

        if (nombresVistos.has(nombre.toLowerCase())) {
          errors.push(`Ámbito "${nombre}" duplicado en el lote`);
        }
        nombresVistos.add(nombre.toLowerCase());

        const existe = ambitos.some(
          (a) => a.nombre.toLowerCase() === nombre.toLowerCase(),
        );
        if (existe) {
          errors.push(`Ya existe un ámbito llamado "${nombre}" en este grado`);
        }

        if (errors.length > 0) {
          allErrors.push(`Línea ${index + 1}: ${errors.join(", ")}`);
        }
      });

      return allErrors;
    },
    [ambitos],
  );

  const guardarAmbitosMasivos = useCallback(async () => {
    if (!ambitoMassiveData.trim()) {
      setValidationErrors([
        "No hay datos para procesar. Ingrese al menos un ámbito.",
      ]);
      return;
    }

    if (!selectedGradoId) {
      setValidationErrors(["Debe seleccionar un grado antes de registrar."]);
      return;
    }

    const { ambitos: ambitosList, parseErrors } =
      parseAmbitosMassiveData(ambitoMassiveData);

    if (parseErrors.length > 0) {
      setValidationErrors(parseErrors);
      setParsedAmbitos([]);
      return;
    }

    if (ambitosList.length === 0) {
      setValidationErrors([
        "No se encontraron ámbitos válidos. Verifique el formato.",
      ]);
      return;
    }

    const errors = validarAmbitosMasivos(ambitosList);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setParsedAmbitos([]);
      return;
    }

    setParsedAmbitos(ambitosList);
    setValidationErrors([]);
    setShowConfirmAmbitoModal(true);
  }, [
    ambitoMassiveData,
    selectedGradoId,
    parseAmbitosMassiveData,
    validarAmbitosMasivos,
  ]);

  const confirmarGuardadoAmbitosMasivos = useCallback(async () => {
    setShowConfirmAmbitoModal(false);
    setIsSaving(true);

    try {
      const maxOrden =
        ambitos.length > 0 ? Math.max(...ambitos.map((a) => a.orden || 0)) : 0;

      const batch = parsedAmbitos.map(async (nombre, index) => {
        await addDoc(collection(db, "ambitos"), {
          nombre: nombre.trim(),
          gradoId: selectedGradoId,
          orden: maxOrden + index + 1,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
        });
      });

      await Promise.all(batch);
      await cargarAmbitos(selectedGradoId);
      await cargarTodosLosAmbitos();
      resetAmbitoForm();
      alert(
        `✅ Se registraron ${parsedAmbitos.length} ámbito(s) correctamente`,
      );
    } catch (error) {
      console.error("Error guardando ámbitos masivos:", error);
      alert("Error al guardar los ámbitos");
    } finally {
      setIsSaving(false);
    }
  }, [
    parsedAmbitos,
    selectedGradoId,
    ambitos,
    user,
    cargarAmbitos,
    cargarTodosLosAmbitos,
    resetAmbitoForm,
  ]);

  const guardarAmbito = useCallback(async () => {
    const errors: string[] = [];
    if (!ambitoFormData.nombre.trim()) {
      errors.push("El nombre del ámbito es obligatorio");
    }
    if (!selectedGradoId) {
      errors.push("Debe seleccionar un grado");
    }
    const existe = ambitos.find(
      (a) =>
        a.nombre.toLowerCase() === ambitoFormData.nombre.trim().toLowerCase() &&
        a.gradoId === selectedGradoId &&
        a.id !== editingAmbitoId,
    );
    if (existe) {
      errors.push(
        `Ya existe un ámbito llamado "${ambitoFormData.nombre}" en este grado`,
      );
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      if (editingAmbitoId) {
        await updateDoc(doc(db, "ambitos", editingAmbitoId), {
          nombre: ambitoFormData.nombre.trim(),
          orden: ambitoFormData.orden,
          updatedAt: serverTimestamp(),
        });
      } else {
        const maxOrden =
          ambitos.length > 0
            ? Math.max(...ambitos.map((a) => a.orden || 0))
            : 0;
        await addDoc(collection(db, "ambitos"), {
          nombre: ambitoFormData.nombre.trim(),
          gradoId: selectedGradoId,
          orden: maxOrden + 1,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
        });
      }
      resetAmbitoForm();
      await cargarAmbitos(selectedGradoId);
      await cargarTodosLosAmbitos();
    } catch (error) {
      console.error("Error guardando ámbito:", error);
      alert("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }, [
    ambitoFormData,
    selectedGradoId,
    editingAmbitoId,
    ambitos,
    user,
    resetAmbitoForm,
    cargarAmbitos,
    cargarTodosLosAmbitos,
  ]);

  // ✅ NUEVO: Copiar ámbitos y destrezas a otros grados (fusión inteligente)
  const copiarAGrados = useCallback(async () => {
    if (selectedDestGrados.length === 0) {
      alert("⚠️ Selecciona al menos un grado de destino");
      return;
    }
    if (ambitos.length === 0) {
      alert("⚠️ El grado actual no tiene ámbitos para copiar");
      return;
    }

    setIsCopying(true);
    try {
      let ambitosCreados = 0;
      let destrezasCreadas = 0;

      for (const destGradoId of selectedDestGrados) {
        // 1. Cargar ámbitos existentes en el destino
        const qAmbDest = query(
          collection(db, "ambitos"),
          where("gradoId", "==", destGradoId),
        );
        const snapAmbDest = await getDocs(qAmbDest);
        const ambitosDest = snapAmbDest.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Ambito,
        );

        // 2. Por cada ámbito del grado origen
        for (const ambitoOrigen of ambitos) {
          // Buscar ámbito con el mismo nombre en el destino
          let ambitoDestId = ambitosDest.find(
            (a) => a.nombre.toLowerCase() === ambitoOrigen.nombre.toLowerCase(),
          )?.id;

          // Si no existe, crearlo
          if (!ambitoDestId) {
            const ref = await addDoc(collection(db, "ambitos"), {
              nombre: ambitoOrigen.nombre,
              gradoId: destGradoId,
              orden: ambitoOrigen.orden || 0,
              activo: true,
              createdAt: serverTimestamp(),
              createdBy: user?.uid,
            });
            ambitoDestId = ref.id;
            ambitosCreados++;
          }

          // 3. Cargar destrezas del ámbito origen
          const qDesOrigen = query(
            collection(db, "destrezas"),
            where("ambitoId", "==", ambitoOrigen.id),
          );
          const snapDesOrigen = await getDocs(qDesOrigen);
          const destrezasOrigen = snapDesOrigen.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Destreza)
            .sort((a, b) => (a.orden || 0) - (b.orden || 0));

          // 4. Cargar destrezas existentes en el ámbito destino
          const qDesDest = query(
            collection(db, "destrezas"),
            where("ambitoId", "==", ambitoDestId),
          );
          const snapDesDest = await getDocs(qDesDest);
          const destrezasDest = snapDesDest.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Destreza,
          );

          // 5. Copiar solo las destrezas que falten
          let ordenMax =
            destrezasDest.length > 0
              ? Math.max(...destrezasDest.map((d) => d.orden || 0))
              : 0;

          for (const destrezaOrigen of destrezasOrigen) {
            const existe = destrezasDest.some(
              (d) =>
                d.descripcion.toLowerCase() ===
                destrezaOrigen.descripcion.toLowerCase(),
            );
            if (!existe) {
              ordenMax += 1;
              await addDoc(collection(db, "destrezas"), {
                nombre: destrezaOrigen.nombre,
                descripcion: destrezaOrigen.descripcion,
                ambitoId: ambitoDestId,
                gradoId: destGradoId,
                orden: ordenMax,
                activo: true,
                createdAt: serverTimestamp(),
                createdBy: user?.uid,
              });
              destrezasCreadas++;
            }
          }
        }
      }

      alert(
        `✅ Copia completada:\n${ambitosCreados} ámbito(s) y ${destrezasCreadas} destreza(s) creados en ${selectedDestGrados.length} grado(s).\n(Lo que ya existía no se duplicó)`,
      );
      setShowCopyModal(false);
      setSelectedDestGrados([]);
      await cargarTodosLosAmbitos();
      await cargarAmbitos(selectedGradoId);
      await cargarDestrezas(selectedGradoId);
    } catch (error) {
      console.error("Error copiando ámbitos y destrezas:", error);
      alert("Error al copiar ámbitos y destrezas");
    } finally {
      setIsCopying(false);
    }
  }, [
    selectedDestGrados,
    ambitos,
    user,
    selectedGradoId,
    cargarTodosLosAmbitos,
    cargarAmbitos,
    cargarDestrezas,
  ]);

  const toggleDestGrado = (gradoId: string) => {
    setSelectedDestGrados((prev) =>
      prev.includes(gradoId)
        ? prev.filter((id) => id !== gradoId)
        : [...prev, gradoId],
    );
  };

  const analizarYGuardarDestrezas = useCallback(async () => {
    const errors: string[] = [];
    if (!selectedAmbitoId) {
      errors.push("No hay un ámbito seleccionado");
    }
    if (!destrezaMassiveData.trim()) {
      errors.push("Debe ingresar al menos una destreza");
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // ✅ MODO INTELIGENTE: detecta si son destrezas largas (con punto) o cortas (una por línea)
    const lineasLimpias = destrezaMassiveData
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const usaPuntos = lineasLimpias.some((l) => l.endsWith("."));

    let destrezasList: string[];
    if (usaPuntos) {
      // 📖 Modo largo: cada destreza termina en "." (puede ocupar varias líneas)
      destrezasList = destrezaMassiveData
        .split(/(?<=\.)\s*\n+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
    } else {
      // ✏️ Modo corto: cada línea es una destreza (ej: "Matemática"), sin punto
      destrezasList = lineasLimpias;
    }

    if (destrezasList.length === 0) {
      setValidationErrors([
        "No se encontraron destrezas válidas. Escribe al menos una.",
      ]);
      return;
    }

    const ambitoDestrezas = destrezas.filter(
      (d) => d.ambitoId === selectedAmbitoId,
    );
    const duplicadas = destrezasList.filter((d) =>
      ambitoDestrezas.some(
        (existente) => existente.descripcion.toLowerCase() === d.toLowerCase(),
      ),
    );
    if (duplicadas.length > 0) {
      setValidationErrors([
        `${duplicadas.length} destreza(s) ya existe(n) en este ámbito.`,
      ]);
      return;
    }

    const vistas = new Set<string>();
    const duplicadasInternas: string[] = [];
    destrezasList.forEach((d) => {
      const lower = d.toLowerCase();
      if (vistas.has(lower)) {
        duplicadasInternas.push(d);
      }
      vistas.add(lower);
    });
    if (duplicadasInternas.length > 0) {
      setValidationErrors([
        `${duplicadasInternas.length} destreza(s) duplicada(s) en el lote.`,
      ]);
      return;
    }

    setIsSaving(true);
    try {
      const ambito = ambitos.find((a) => a.id === selectedAmbitoId);
      if (!ambito) throw new Error("Ámbito no encontrado");
      const batch = destrezasList.map(async (texto, index) => {
        const nombre = texto.substring(0, 100);
        await addDoc(collection(db, "destrezas"), {
          nombre: nombre.trim(),
          descripcion: texto.trim(),
          ambitoId: selectedAmbitoId,
          gradoId: selectedGradoId,
          orden: ambitoDestrezas.length + index + 1,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
        });
      });

      await Promise.all(batch);
      await cargarDestrezas(selectedGradoId);
      resetDestrezaForm();
      alert(
        `✅ Se registraron ${destrezasList.length} destreza(s) en "${ambito.nombre}"`,
      );
    } catch (error) {
      console.error("Error guardando destrezas:", error);
      alert("Error al guardar las destrezas");
    } finally {
      setIsSaving(false);
    }
  }, [
    destrezaMassiveData,
    selectedAmbitoId,
    selectedGradoId,
    ambitos,
    destrezas,
    user,
    cargarDestrezas,
    resetDestrezaForm,
  ]);

  const handleEditAmbito = useCallback((ambito: Ambito) => {
    setAmbitoFormData({ nombre: ambito.nombre, orden: ambito.orden || 0 });
    setEditingAmbitoId(ambito.id);
    setShowAmbitoForm(true);
    setIsAmbitoMassive(false);
    setValidationErrors([]);
  }, []);

  const handleDeleteAmbito = useCallback(
    async (id: string) => {
      const destrezasDelAmbito = destrezas.filter((d) => d.ambitoId === id);
      if (destrezasDelAmbito.length > 0) {
        if (
          !confirm(
            `Este ámbito tiene ${destrezasDelAmbito.length} destreza(s). ¿Eliminar también las destrezas?`,
          )
        ) {
          return;
        }
        const deleteDestrezas = destrezasDelAmbito.map((d) =>
          deleteDoc(doc(db, "destrezas", d.id)),
        );
        await Promise.all(deleteDestrezas);
      } else {
        if (!confirm("¿Eliminar este ámbito?")) return;
      }
      try {
        await deleteDoc(doc(db, "ambitos", id));
        await cargarAmbitos(selectedGradoId);
        await cargarDestrezas(selectedGradoId);
        await cargarTodosLosAmbitos();
      } catch (error) {
        console.error("Error eliminando:", error);
        alert("Error al eliminar");
      }
    },
    [
      destrezas,
      selectedGradoId,
      cargarAmbitos,
      cargarDestrezas,
      cargarTodosLosAmbitos,
    ],
  );

  const handleDeleteDestreza = useCallback(
    async (id: string) => {
      if (!confirm("¿Eliminar esta destreza?")) return;
      try {
        await deleteDoc(doc(db, "destrezas", id));
        await cargarDestrezas(selectedGradoId);
      } catch (error) {
        console.error("Error eliminando:", error);
        alert("Error al eliminar");
      }
    },
    [selectedGradoId, cargarDestrezas],
  );

  const handleEditDestreza = useCallback((destreza: Destreza) => {
    setDestrezaMassiveData(destreza.descripcion);
    setEditingDestrezaId(destreza.id);
    setShowDestrezaForm(true);
    setValidationErrors([]);

    setTimeout(() => {
      destrezaFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }, []);

  const guardarDestrezaIndividual = useCallback(async () => {
    if (!destrezaMassiveData.trim()) {
      setValidationErrors(["La destreza no puede estar vacía"]);
      return;
    }

    setIsSaving(true);
    try {
      const ambito = ambitos.find((a) => a.id === selectedAmbitoId);
      if (!ambito) throw new Error("Ámbito no encontrado");
      if (editingDestrezaId) {
        await updateDoc(doc(db, "destrezas", editingDestrezaId), {
          nombre: destrezaMassiveData.substring(0, 100).trim(),
          descripcion: destrezaMassiveData.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const ambitoDestrezas = destrezas.filter(
          (d) => d.ambitoId === selectedAmbitoId,
        );
        await addDoc(collection(db, "destrezas"), {
          nombre: destrezaMassiveData.substring(0, 100).trim(),
          descripcion: destrezaMassiveData.trim(),
          ambitoId: selectedAmbitoId,
          gradoId: selectedGradoId,
          orden: ambitoDestrezas.length + 1,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
        });
      }
      await cargarDestrezas(selectedGradoId);
      resetDestrezaForm();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  }, [
    destrezaMassiveData,
    selectedAmbitoId,
    selectedGradoId,
    editingDestrezaId,
    ambitos,
    destrezas,
    user,
    cargarDestrezas,
    resetDestrezaForm,
  ]);

  const getDestrezasByAmbito = (ambitoId: string) => {
    return destrezas.filter((d) => d.ambitoId === ambitoId);
  };

  const irADestrezas = useCallback((ambitoId: string) => {
    setSelectedAmbitoId(ambitoId);
    setCurrentView("destrezas");
    setValidationErrors([]);
  }, []);

  const volverAAmbitos = useCallback(() => {
    setCurrentView("ambitos");
    setSelectedAmbitoId(null);
    resetDestrezaForm();
  }, [resetDestrezaForm]);

  const handlePrint = useCallback(() => {
    const gradoActual = grados.find((g) => g.id === selectedGradoId);
    if (!gradoActual) return;

    const ambitosConDestrezas = ambitos.map((ambito) => ({
      ...ambito,
      destrezas: destrezas.filter((d) => d.ambitoId === ambito.id),
    }));

    const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Respaldo de Ámbitos y Destrezas - ${gradoActual.nombre} ${gradoActual.paralelo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; line-height: 1.5; }
        h1 { text-align: center; color: #2563eb; font-size: 24px; margin-bottom: 5px; }
        h2 { text-align: center; color: #555; font-size: 18px; margin-bottom: 30px; font-weight: normal; }
        .ambito { margin-bottom: 25px; page-break-inside: avoid; }
        .ambito-title { background-color: #f3f4f6; padding: 10px 15px; font-weight: bold; font-size: 16px; border-left: 4px solid #8b5cf6; margin-bottom: 10px; color: #1f2937; }
        .destreza { margin-bottom: 8px; padding-left: 20px; position: relative; font-size: 14px; }
        .destreza::before { content: "•"; position: absolute; left: 0; color: #8b5cf6; font-weight: bold; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ccc; padding-top: 15px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Respaldo de Ámbitos y Destrezas</h1>
      <h2>Grado: ${gradoActual.nombre} - Paralelo: ${gradoActual.paralelo}</h2>
      ${ambitosConDestrezas
        .map(
          (ambito) => `
        <div class="ambito">
          <div class="ambito-title">${ambito.nombre}</div>
          ${
            ambito.destrezas.length > 0
              ? ambito.destrezas
                  .map(
                    (d) => `
            <div class="destreza">${d.descripcion}</div>
          `,
                  )
                  .join("")
              : '<div class="destreza" style="color: #999; font-style: italic;">No hay destrezas registradas en este ámbito.</div>'
          }
        </div>
      `,
        )
        .join("")}
      <div class="footer">
        <p>Generado el: ${new Date().toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <p>Documento de respaldo interno del sistema de gestión escolar.</p>
      </div>
    </body>
    </html>
  `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }, [grados, selectedGradoId, ambitos, destrezas]);

  useEffect(() => {
    cargarAniosLectivos();
  }, [cargarAniosLectivos]);

  useEffect(() => {
    if (aniosLectivos.length > 0) {
      cargarGrados();
      cargarTodosLosAmbitos();
    }
  }, [aniosLectivos, cargarGrados, cargarTodosLosAmbitos]);

  useEffect(() => {
    if (selectedGradoId) {
      cargarAmbitos(selectedGradoId);
      cargarDestrezas(selectedGradoId);
    }
  }, [selectedGradoId, cargarAmbitos, cargarDestrezas]);

  if (loading) {
    return (
      <Layout
        title="Ámbitos y Destrezas"
        subtitle="Configura competencias y destrezas"
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

  const ambitoSeleccionado = ambitos.find((a) => a.id === selectedAmbitoId);
  const destrezasDelAmbito = selectedAmbitoId
    ? getDestrezasByAmbito(selectedAmbitoId)
    : [];
  const anioActivo = aniosLectivos.find((a) => a.activo);
  const gradoOrigen = grados.find((g) => g.id === selectedGradoId);
  const gradosDestino = grados.filter((g) => g.id !== selectedGradoId);

  return (
    <Layout
      title="Ámbitos y Destrezas"
      subtitle="Configura competencias y destrezas por grado"
      showBack
    >
      {anioActivo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-center gap-2 text-blue-800">
            <FaCalendarAlt className="text-sm" />
            <span className="text-sm font-medium">
              Trabajando con año lectivo:
            </span>
            <span className="text-base font-bold text-blue-900">
              {anioActivo.nombre}
            </span>
          </div>
        </div>
      )}

      {!anioActivo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex items-start gap-2">
            <FaInfoCircle className="text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-yellow-800 font-semibold text-sm mb-1">
                No hay año lectivo activo
              </h4>
              <p className="text-yellow-700 text-sm">
                Debes crear y activar un año lectivo primero en el módulo de
                Años Lectivos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selector de Grado como botones */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FaBook className="text-purple-600" />
          Selecciona un Grado
        </h3>

        {grados.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <FaInfoCircle className="text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-yellow-800 font-semibold text-sm">
                No hay grados disponibles
              </h4>
              <p className="text-yellow-700 text-sm">
                Debes crear y activar grados para el año lectivo vigente antes
                de registrar ámbitos.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {grados.map((grado) => {
              const isSelected = selectedGradoId === grado.id;
              const ambitosCount = todosLosAmbitos.filter(
                (a) => a.gradoId === grado.id,
              ).length;
              return (
                <button
                  key={grado.id}
                  onClick={() => {
                    setSelectedGradoId(grado.id);
                    volverAAmbitos();
                  }}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 text-left text-sm ${
                    isSelected
                      ? "border-purple-500 bg-purple-50 shadow-sm"
                      : "border-slate-200 hover:border-purple-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${
                        isSelected
                          ? "bg-linear-to-br from-purple-500 to-indigo-600"
                          : "bg-linear-to-br from-slate-400 to-slate-500"
                      }`}
                    >
                      {grado.paralelo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {grado.nombre}
                      </div>
                      <div className="text-slate-500 text-xs flex items-center gap-1">
                        {ambitosCount > 0 ? (
                          <span className="text-purple-600 font-medium">
                            {ambitosCount} ámbito{ambitosCount !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-orange-600 font-medium">
                            Sin ámbitos
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <FaUserCheck className="text-purple-600 text-xs shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Breadcrumb de navegación */}
      {currentView === "destrezas" && ambitoSeleccionado && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button
            onClick={volverAAmbitos}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <FaArrowLeft className="text-xs" /> Ámbitos
          </button>
          <span className="text-slate-400">/</span>
          <span className="text-slate-700 font-medium">
            {ambitoSeleccionado.nombre}
          </span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Destrezas</span>
        </div>
      )}

      {/* VISTA: LISTA DE ÁMBITOS */}
      {currentView === "ambitos" && selectedGradoId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-linear-to-r from-purple-600 to-purple-700 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaBook className="text-white text-xl" />
              <div>
                <h3 className="text-white font-semibold text-base">Ámbitos</h3>
                <p className="text-white/80 text-xs">
                  {ambitos.length} ámbito(s) registrado(s)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* ✅ NUEVO: Botón Copiar a otros grados */}
              <button
                onClick={() => {
                  setSelectedDestGrados([]);
                  setShowCopyModal(true);
                }}
                disabled={ambitos.length === 0 || isSaving}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Copiar ámbitos y destrezas a otros grados"
              >
                <FaCopy className="text-xs" /> Copiar
              </button>
              <button
                onClick={handlePrint}
                disabled={ambitos.length === 0}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Imprimir respaldo del grado"
              >
                <FaPrint className="text-xs" /> Imprimir
              </button>
              <button
                onClick={() => setShowAmbitoForm(!showAmbitoForm)}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaPlus className="text-xs" />{" "}
                {showAmbitoForm ? "Cancelar" : "Nuevo Ámbito"}
              </button>
            </div>
          </div>

          <div className="p-5">
            {showAmbitoForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {editingAmbitoId
                      ? "Editar Ámbito"
                      : isAmbitoMassive
                        ? "Ingreso Masivo de Ámbitos"
                        : "Nuevo Ámbito"}
                  </h4>
                  {!editingAmbitoId && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAmbitoMassive(!isAmbitoMassive);
                        setAmbitoMassiveData("");
                        setParsedAmbitos([]);
                        setValidationErrors([]);
                      }}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {isAmbitoMassive ? "Modo Individual" : "Modo Masivo"}
                    </button>
                  )}
                </div>

                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <ul className="text-red-700 text-sm space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!isAmbitoMassive ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={ambitoFormData.nombre}
                        onChange={(e) =>
                          setAmbitoFormData({
                            ...ambitoFormData,
                            nombre: e.target.value,
                          })
                        }
                        placeholder="Ej: Comunicación Oral"
                        disabled={isSaving}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={guardarAmbito}
                        disabled={isSaving}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <FaSpinner className="text-xs animate-spin" />{" "}
                            Guardando...
                          </>
                        ) : (
                          <>
                            <FaCheck className="text-xs" />{" "}
                            {editingAmbitoId ? "Actualizar" : "Guardar"}
                          </>
                        )}
                      </button>
                      <button
                        onClick={resetAmbitoForm}
                        disabled={isSaving}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaTimes className="text-xs" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Ámbitos (uno por línea) *
                      </label>
                      <textarea
                        value={ambitoMassiveData}
                        onChange={(e) => setAmbitoMassiveData(e.target.value)}
                        disabled={isSaving}
                        placeholder={`Ejemplo:\nComunicación Oral\nPensamiento Lógico\nComprensión del Medio Natural`}
                        rows={8}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        <FaInfoCircle className="inline mr-1" /> Escribe cada
                        ámbito en una línea separada.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={guardarAmbitosMasivos}
                        disabled={isSaving}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <FaSpinner className="text-xs animate-spin" />{" "}
                            Procesando...
                          </>
                        ) : (
                          <>
                            <FaUpload className="text-xs" /> Analizar y Guardar
                          </>
                        )}
                      </button>
                      <button
                        onClick={resetAmbitoForm}
                        disabled={isSaving}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FaTimes className="text-xs" /> Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {ambitos.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FaBook className="text-4xl mx-auto mb-3 text-slate-300" />
                <p className="font-medium mb-1">No hay ámbitos registrados</p>
                <p className="text-sm">Crea el primer ámbito para comenzar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ambitos.map((ambito) => {
                  const count = getDestrezasByAmbito(ambito.id).length;
                  return (
                    <div
                      key={ambito.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              {ambito.nombre}
                            </h4>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {count} destreza{count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => irADestrezas(ambito.id)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gestionar destrezas"
                          >
                            <FaTasks className="text-xs" /> Destrezas
                          </button>
                          <button
                            onClick={() => handleEditAmbito(ambito)}
                            disabled={isSaving}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Editar"
                          >
                            <FaEdit className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDeleteAmbito(ambito.id)}
                            disabled={isSaving}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar"
                          >
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA: DESTREZAS DE UN ÁMBITO */}
      {currentView === "destrezas" && ambitoSeleccionado && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-linear-to-r from-teal-600 to-teal-700 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FaTasks className="text-white text-xl" />
              <div>
                <h3 className="text-white font-semibold text-base">
                  Destrezas de: {ambitoSeleccionado.nombre}
                </h3>
                <p className="text-white/80 text-xs">
                  {destrezasDelAmbito.length} destreza(s) registrada(s)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDestrezaForm(!showDestrezaForm)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaPlus className="text-xs" />{" "}
              {showDestrezaForm ? "Cancelar" : "Agregar Destrezas"}
            </button>
          </div>

          <div className="p-5">
            {showDestrezaForm && (
              <div
                ref={destrezaFormRef}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4"
              >
                <h4 className="text-sm font-semibold text-slate-800 mb-3">
                  {editingDestrezaId
                    ? "Editar Destreza"
                    : "Agregar Destrezas (Masivo)"}
                </h4>
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <FaExclamationTriangle className="text-red-600 mt-0.5 shrink-0" />
                      <ul className="text-red-700 text-sm space-y-1">
                        {validationErrors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingDestrezaId
                        ? "Editar destreza"
                        : "Destrezas (cada una termina con punto) *"}
                    </label>
                    <textarea
                      value={destrezaMassiveData}
                      onChange={(e) => setDestrezaMassiveData(e.target.value)}
                      disabled={isSaving}
                      placeholder={
                        editingDestrezaId
                          ? "Edita la destreza aquí..."
                          : "Ejemplo:\nEscucha activamente a sus compañeros y adultos.\nExpresa sus ideas con claridad."
                      }
                      rows={12}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    {!editingDestrezaId && (
                      <p className="text-xs text-slate-500 mt-1">
                        <FaInfoCircle className="inline mr-1" />
                        <strong>Destrezas largas:</strong> termina cada una con punto (.).{" "}
                        <strong>Cortas (una palabra):</strong> una por línea, sin punto.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={
                        editingDestrezaId
                          ? guardarDestrezaIndividual
                          : analizarYGuardarDestrezas
                      }
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <FaSpinner className="text-xs animate-spin" />{" "}
                          {editingDestrezaId
                            ? "Actualizando..."
                            : "Procesando..."}
                        </>
                      ) : (
                        <>
                          <FaCheck className="text-xs" />{" "}
                          {editingDestrezaId
                            ? "Actualizar"
                            : "Analizar y Guardar"}
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetDestrezaForm}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaTimes className="text-xs" /> Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {destrezasDelAmbito.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FaTasks className="text-4xl mx-auto mb-3 text-slate-300" />
                <p className="font-medium mb-1">No hay destrezas registradas</p>
                <p className="text-sm mb-3">
                  Agrega las destrezas de este ámbito
                </p>
                <button
                  onClick={() => setShowDestrezaForm(true)}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaPlus className="text-xs" /> Agregar destrezas
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {destrezasDelAmbito.map((destreza, index) => (
                  <div
                    key={destreza.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-teal-100 text-teal-700 rounded-lg w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-600 text-sm whitespace-pre-line">
                          {destreza.descripcion}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleEditDestreza(destreza)}
                          disabled={isSaving}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Editar"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => handleDeleteDestreza(destreza.id)}
                          disabled={isSaving}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Eliminar"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Ámbitos Masivos */}
      {showConfirmAmbitoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-100 p-2 rounded-lg">
                <FaUpload className="text-purple-600 text-xl" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Confirmar Registro Masivo
              </h3>
            </div>
            <p className="text-slate-600 mb-4">
              Se analizaron y validaron correctamente{" "}
              <strong className="text-purple-700">
                {parsedAmbitos.length}
              </strong>{" "}
              ámbito(s). ¿Deseas registrarlos en el sistema?
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              <ul className="text-sm text-slate-700 space-y-1">
                {parsedAmbitos.map((ambito, idx) => (
                  <li key={idx}>• {ambito}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmarGuardadoAmbitosMasivos}
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <FaSpinner className="text-xs animate-spin" />{" "}
                    Registrando...
                  </>
                ) : (
                  <>
                    <FaCheck className="text-xs" /> Sí, registrar todos
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowConfirmAmbitoModal(false);
                  setParsedAmbitos([]);
                }}
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTimes className="text-xs" /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Modal para Copiar a otros grados */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FaCopy className="text-blue-600 text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Copiar Ámbitos y Destrezas
                </h3>
                <p className="text-xs text-slate-500">
                  Desde:{" "}
                  <strong className="text-purple-700">
                    {gradoOrigen?.nombre} - {gradoOrigen?.paralelo}
                  </strong>{" "}
                  ({ambitos.length} ámbitos)
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Selecciona los grados de destino. Los ámbitos y destrezas que ya
              existan en el destino <strong>no se duplicarán</strong>.
            </p>

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                {selectedDestGrados.length} seleccionado(s)
              </span>
              <button
                onClick={() =>
                  setSelectedDestGrados(
                    selectedDestGrados.length === gradosDestino.length
                      ? []
                      : gradosDestino.map((g) => g.id),
                  )
                }
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {selectedDestGrados.length === gradosDestino.length
                  ? "Deseleccionar todos"
                  : "Seleccionar todos"}
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 max-h-56 overflow-y-auto space-y-1">
              {gradosDestino.map((grado) => {
                const checked = selectedDestGrados.includes(grado.id);
                const ambitosCount = todosLosAmbitos.filter(
                  (a) => a.gradoId === grado.id,
                ).length;
                return (
                  <label
                    key={grado.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                      checked
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDestGrado(grado.id)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-800">
                        {grado.nombre} - {grado.paralelo}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${
                        ambitosCount > 0 ? "text-purple-600" : "text-orange-600"
                      }`}
                    >
                      {ambitosCount > 0 ? `${ambitosCount} ámbito(s)` : "Vacío"}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={copiarAGrados}
                disabled={isCopying || selectedDestGrados.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCopying ? (
                  <>
                    <FaSpinner className="text-xs animate-spin" /> Copiando...
                  </>
                ) : (
                  <>
                    <FaCopy className="text-xs" /> Copiar ahora
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedDestGrados([]);
                }}
                disabled={isCopying}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaTimes className="text-xs" /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
