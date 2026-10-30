# Continuidad — Optimización y Rediseño de Módulos Super Admin (v7 FINAL)

Actualizado: 29 de octubre de 2026.
Este documento es el anexo al documento principal de optimización (`CONTEXTO_OPTIMIZACION_FIREBASE_FINAL_v10.md`). Se enfoca específicamente en los módulos utilizados por el rol de **Super Administrador**.

---

## 0. Origen y Filosofía

A diferencia de los módulos de docentes (donde la nómina de estudiantes generaba miles de lecturas), los módulos de Super Admin operan sobre documentos únicos o colecciones pequeñas (configuraciones, catálogos maestros, usuarios). Sin embargo, **la regla de oro se mantiene**: evitar `getDocs` en montajes de componentes y usar listeners compartidos (`onSnapshot`) para aprovechar `persistentLocalCache`.

---

## 1. Bitácora de Cambios (Fases Completadas)

### ✅ Fase 1 — Configuración Institucional (`InstitutionSettings.tsx`)
*   **Optimización:** Reemplazo de `getDocs(collection(...))` por `onSnapshot(doc(...))`. Ahora la lectura se hace una sola vez por sesión.
*   **Diseño:** Formulario dividido en 3 tarjetas lógicas (`Datos Institución`, `Autoridades`, `Directores`). Migración a Toasts flotantes.
*   **Archivo:** `src/pages/InstitutionSettings.tsx`.

### ✅ Fase 2 — Gestión de Usuarios (`GestionUsuarios.tsx`)
*   **Optimización:** `onSnapshot` filtrado (sin `getDocs`). `useMemo` para el filtrado local de la lista de usuarios. Eliminación de la función `reload` obsoleta.
*   **Lógica:** Corrección del doble renderizado al aprobar un usuario. Validación estricta en la cascada de materias al remover grados.
*   **Diseño:** Rediseño completo con la paleta institucional azul. Tarjetas de usuario compactas con "pills" de estado.
*   **Archivo:** `src/pages/GestionUsuarios.tsx`.

### ✅ Fase 3 — Gestión de Materias Docentes (`GestionMateriasDocentes.tsx`)
*   **Optimización:** `onSnapshot` local exclusivo para docentes (`where("role", "==", "docente")`) para evitar leer super admins. Caché manual eliminada.
*   **Lógica:** Transferencias robustas que validan duplicados y delegan el re-renderizado al `onSnapshot`. Limpieza de "huérfanas" mediante `writeBatch`.
*   **Diseño:** Unificación de UI, tarjetas de estadísticas superiores, Toasts flotantes.
*   **Archivo:** `src/pages/GestionMateriasDocentes.tsx`.

### ✅ Fase 4 — Años Lectivos (`AniosLectivos.tsx`)
*   **Optimización:** Uso de `writeBatch` para la creación/edición de años y períodos. 
*   **Lógica:** Corrección de zona horaria en el cálculo de fechas de los períodos.
*   **Diseño:** Formulario y modales rediseñados con el sistema de colores institucional.
*   **Archivo:** `src/pages/AniosLectivos.tsx`.

### ✅ Fase 5 — Gestión de Grados (`Grados.tsx`)
*   **Optimización:** `onSnapshot` filtrado por `anioLectivoId`. `writeBatch` para creación masiva. Validación de referencias usando `getCountFromServer` (metadata, 0 lecturas de documentos completos).
*   **Lógica:** Limpieza de duplicados y borrado seguro (solo si no hay estudiantes/notas asociadas).
*   **Diseño:** Tabla compacta, selector múltiple de niveles/paralelos, Toasts flotantes.
*   **Archivo:** `src/pages/Grados.tsx`.

### ✅ Fase 6 — Ámbitos y Destrezas (`AmbitosDestrezas.tsx`)
Este fue el módulo con mayor riesgo de lecturas masivas, especialmente en Inicial/Preparatoria por la cantidad de destrezas.
*   **Optimización Crítica:** El componente **NO hace consultas directas**. Consume `ambitos` y `destrezas` desde el `DataContext` (que usa `onSnapshot` global). Al cambiar de grado o de pestaña, las lecturas son **0**.
*   **Lógica:** Parseo de destrezas masivas (por línea o por punto final). Copiado de ámbitos/destrezas entre grados con `writeBatch` y validación de duplicados.
*   **Exportación:** En lugar de imprimir a PDF, se implementó la **exportación a Excel** (hojas de ámbitos y destrezas), permitiendo reutilizar y filtrar los datos.
*   **Archivo:** `src/pages/AmbitosDestrezas.tsx`.

---

## 2. Estado Final de los Módulos Super Admin

| Módulo | Estado de Optimización | Lecturas Extra | Notas |
|---|---|---|---|
| `InstitutionSettings.tsx` | ✅ **OPTIMIZADO** | 0 (1 inicial) | Listener por documento |
| `GestionUsuarios.tsx` | ✅ **OPTIMIZADO** | 0 (1 inicial) | Listener filtrado, memoización local |
| `GestionMateriasDocentes.tsx` | ✅ **OPTIMIZADO** | 0 (1 inicial) | Listener filtrado, caché manual eliminada |
| `AniosLectivos.tsx` | ✅ **OPTIMIZADO** | 0 | Lógica de fechas corregida |
| `Grados.tsx` | ✅ **OPTIMIZADO** | 0 (1 inicial) | Validación de refs con metadata |
| `AmbitosDestrezas.tsx` | ✅ **OPTIMIZADO** | **0** | Consumo 100% desde DataContext, export a Excel |

---

## 3. Reglas de Diseño Consolidadas para Nuevos Módulos Super Admin

*   **Contenedores:** `rounded-lg border border-[#D8DEE6] bg-[#FFFFFF] shadow-sm`.
*   **Cabeceras:** Títulos en `text-base font-semibold text-[#244563]`. Botón de regreso con `<FaArrowLeft />`.
*   **Botones Primarios:** `bg-[#244563] hover:bg-[#1B354D] text-white`.
*   **Botones Secundarios:** `bg-[#FFFFFF] border border-[#D8DEE6] text-[#4B5563] hover:bg-[#F3F4F6]`.
*   **Feedback:** Usar `mostrarToast` (flotantes en la esquina superior derecha). No usar alerts ni banners que empujen el contenido.
*   **Carga de Datos:** 
    *   Catálogos maestros (grados, ámbitos, destrezas) → **`useData()`**.
    *   Listas específicas (usuarios, materias, config) → **`onSnapshot`** filtrado.
    *   Nunca usar `getDocs` en el `useEffect` inicial (salvo para conteos de metadata con `getCountFromServer`).

---

## 4. Conclusión de la Fase Super Admin

Con la finalización de `AmbitosDestrezas.tsx`, todos los módulos de Super Admin han sido migrados a la arquitectura optimizada. El consumo de lecturas en esta sección es ahora prácticamente nulo (solo la carga inicial de los listeners), eliminando los picos que antes generaban los módulos de inicial y preparatoria.

El sistema está listo para operar con un consumo de cuota mínimo, garantizando la sostenibilidad del plan Spark de Firebase a largo plazo.