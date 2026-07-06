import { useState, useEffect, startTransition, useCallback } from "react";
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
import type { Ambito, Destreza, Grado } from "../types";
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
} from "react-icons/fa";

export default function AmbitosDestrezas() {
  const { user } = useAuth();
  const [grados, setGrados] = useState<Grado[]>([]);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [destrezas, setDestrezas] = useState<Destreza[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // ✅ Nuevo estado

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

  const [showDestrezaForm, setShowDestrezaForm] = useState(false);
  const [editingDestrezaId, setEditingDestrezaId] = useState<string | null>(
    null,
  );
  const [destrezaMassiveData, setDestrezaMassiveData] = useState("");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const resetAmbitoForm = useCallback(() => {
    setAmbitoFormData({ nombre: "", orden: 0 });
    setEditingAmbitoId(null);
    setShowAmbitoForm(false);
    setValidationErrors([]);
  }, []);

  const resetDestrezaForm = useCallback(() => {
    setDestrezaMassiveData("");
    setEditingDestrezaId(null);
    setShowDestrezaForm(false);
    setValidationErrors([]);
  }, []);

  const cargarGrados = useCallback(async () => {
    try {
      const q = query(
        collection(db, "grados"),
        where("activo", "==", true),
        orderBy("orden", "asc"),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Grado,
      );

      startTransition(() => {
        setGrados(data);
        if (data.length > 0 && !selectedGradoId) {
          setSelectedGradoId(data[0].id);
        }
      });
    } catch (error) {
      console.error("Error cargando grados:", error);
    }
  }, [selectedGradoId]);

  const cargarAmbitos = useCallback(async (gradoId: string) => {
    try {
      startTransition(() => {
        setLoading(true);
      });

      const q = query(
        collection(db, "ambitos"),
        where("gradoId", "==", gradoId),
        orderBy("orden", "asc"),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Ambito,
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
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Destreza,
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

  // ✅ Guardar Ámbito con feedback visual
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

    setIsSaving(true); // ✅ Iniciar procesamiento

    try {
      if (editingAmbitoId) {
        await updateDoc(doc(db, "ambitos", editingAmbitoId), {
          nombre: ambitoFormData.nombre.trim(),
          orden: ambitoFormData.orden,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "ambitos"), {
          nombre: ambitoFormData.nombre.trim(),
          gradoId: selectedGradoId,
          orden: ambitoFormData.orden,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid,
        });
      }

      resetAmbitoForm();
      await cargarAmbitos(selectedGradoId);
    } catch (error) {
      console.error("Error guardando ámbito:", error);
      alert("Error al guardar");
    } finally {
      setIsSaving(false); // ✅ Terminar procesamiento
    }
  }, [
    ambitoFormData,
    selectedGradoId,
    editingAmbitoId,
    ambitos,
    user,
    resetAmbitoForm,
    cargarAmbitos,
  ]);

  // ✅ Analizar y Guardar Destrezas con feedback visual
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

    const lineas = destrezaMassiveData.split(/\n\s*\n/);
    const destrezasList = lineas
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (destrezasList.length === 0) {
      setValidationErrors([
        "No se encontraron destrezas válidas. Separe cada destreza con una línea en blanco.",
      ]);
      return;
    }

    const destrezasCortas = destrezasList.filter((d) => d.length < 20);
    if (destrezasCortas.length > 0) {
      setValidationErrors([
        `${destrezasCortas.length} destreza(s) muy corta(s). Mínimo 20 caracteres.`,
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

    setIsSaving(true); // ✅ Iniciar procesamiento

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
      setIsSaving(false); // ✅ Terminar procesamiento
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
    setAmbitoFormData({
      nombre: ambito.nombre,
      orden: ambito.orden || 0,
    });
    setEditingAmbitoId(ambito.id);
    setShowAmbitoForm(true);
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
      } catch (error) {
        console.error("Error eliminando:", error);
        alert("Error al eliminar");
      }
    },
    [destrezas, selectedGradoId, cargarAmbitos, cargarDestrezas],
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
  }, []);

  // ✅ Guardar Destreza Individual con feedback visual
  const guardarDestrezaIndividual = useCallback(async () => {
    if (!destrezaMassiveData.trim() || destrezaMassiveData.trim().length < 20) {
      setValidationErrors(["La destreza debe tener al menos 20 caracteres"]);
      return;
    }

    setIsSaving(true); // ✅ Iniciar procesamiento

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
      setIsSaving(false); // ✅ Terminar procesamiento
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

  useEffect(() => {
    cargarGrados();
  }, [cargarGrados]);

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

  return (
    <Layout
      title="Ámbitos y Destrezas"
      subtitle="Configura competencias y destrezas por grado"
      showBack
    >
      {/* Selector de Grado */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-slate-700">Grado:</label>
          <select
            value={selectedGradoId}
            onChange={(e) => {
              setSelectedGradoId(e.target.value);
              volverAAmbitos();
            }}
            className="flex-1 max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {grados.map((grado) => (
              <option key={grado.id} value={grado.id}>
                {grado.nombre} - {grado.paralelo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Breadcrumb de navegación */}
      {currentView === "destrezas" && ambitoSeleccionado && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button
            onClick={volverAAmbitos}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            <FaArrowLeft className="text-xs" />
            Ámbitos
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
      {currentView === "ambitos" && (
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
            <button
              onClick={() => setShowAmbitoForm(!showAmbitoForm)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaPlus className="text-xs" />
              {showAmbitoForm ? "Cancelar" : "Nuevo Ámbito"}
            </button>
          </div>

          <div className="p-5">
            {showAmbitoForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">
                  {editingAmbitoId ? "Editar Ámbito" : "Nuevo Ámbito"}
                </h4>

                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <ul className="text-red-700 text-sm space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
                          <FaSpinner className="text-xs animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <FaCheck className="text-xs" />
                          {editingAmbitoId ? "Actualizar" : "Guardar"}
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetAmbitoForm}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaTimes className="text-xs" />
                      Cancelar
                    </button>
                  </div>
                </div>
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
                            <FaTasks className="text-xs" />
                            Destrezas
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
              <FaPlus className="text-xs" />
              {showDestrezaForm ? "Cancelar" : "Agregar Destrezas"}
            </button>
          </div>

          <div className="p-5">
            {showDestrezaForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
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
                        : "Destrezas (una por bloque, separar con línea en blanco) *"}
                    </label>
                    <textarea
                      value={destrezaMassiveData}
                      onChange={(e) => setDestrezaMassiveData(e.target.value)}
                      disabled={isSaving}
                      placeholder={
                        editingDestrezaId
                          ? "Edita la destreza aquí..."
                          : `Ejemplo:
Escucha activamente a sus compañeros y adultos, demostrando atención y respeto en las conversaciones del aula.

Expresa sus ideas, necesidades y sentimientos con claridad, utilizando un vocabulario adecuado a su edad.

Participa en conversaciones grupales, respetando los turnos de palabra y las opiniones de los demás.`
                      }
                      rows={12}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-sans focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    {!editingDestrezaId && (
                      <p className="text-xs text-slate-500 mt-1">
                        <FaInfoCircle className="inline mr-1" />
                        Separe cada destreza con una línea en blanco. Mínimo 20
                        caracteres.
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
                          <FaSpinner className="text-xs animate-spin" />
                          {editingDestrezaId ? "Actualizando..." : "Procesando..."}
                        </>
                      ) : (
                        <>
                          {editingDestrezaId ? (
                            <>
                              <FaCheck className="text-xs" />
                              Actualizar
                            </>
                          ) : (
                            <>
                              <FaUpload className="text-xs" />
                              Analizar y Guardar
                            </>
                          )}
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetDestrezaForm}
                      disabled={isSaving}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaTimes className="text-xs" />
                      Cancelar
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
                  <FaPlus className="text-xs" />
                  Agregar destrezas
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
                        <h5 className="font-semibold text-slate-900 text-sm mb-1">
                          {destreza.nombre}
                        </h5>
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
    </Layout>
  );
}