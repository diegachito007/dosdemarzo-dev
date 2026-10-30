# Continuidad — Optimización Firebase de dosdemarzo-app (v10 FINAL)

Actualizado: 29 de octubre de 2026.
Este documento registra las decisiones, diagnósticos y cambios aplicados a partir de la auditoría de lecturas de Firestore realizada el 28/10/2026. Prevalece sobre el historial anterior. **Es el documento definitivo del proyecto.**

---

## 0. Origen del proyecto

Este plan de optimización nació de una **auditoría externa de lecturas de Firestore** que identificó 9 fallos rankedos (F0–F8) en el proyecto `dosdemarzo-app`. Nuestro trabajo real ejecutó ese plan con ajustes de diseño, validando cada entrega en el proyecto réplica `dosdemarzo-14ded` antes de tocar el proyecto real `edux-colegio-dosdemarzo`.

### Trazabilidad F0–F8 → fases ejecutadas

| Fallo auditoría | Descripción | Fase que lo cerró | Estado |
|---|---|---|---|
| **F0** | Crash de `PALETA_MATERIAS` en Calificaciones | Fase 1 | ✅ CERRADO |
| **F1** | Churn de lotes en ReporteNotas | Fase 1 (hash) + Fase 4.1 (target ==) | ✅ CERRADO |
| **F2** | Múltiples formas canónicas de nómina | Fase 3 (completa) | ✅ CERRADO |
| **F3** | `/calificaciones` en dos familias paralelas | Fase 4.1 | ✅ CERRADO |
| **F4** | `recalcularInsumos` sin acotar | Fase 1 (firma) + Fase 4.2 (llamadores) | ✅ CERRADO |
| **F5** | PPE lee colección completa de estudiantes | Fase 3.3 | ✅ CERRADO |
| **F6** | `DataContext` con `getDocs` de usuarios | Fase 2 | ✅ CERRADO |
| **F7** | Asistencias por rangos de fechas | Fase 4.3 | ✅ CERRADO |
| **F8** | Lotes de composición variable | Fase 4.4 | ✅ CERRADO |

---

## 1. Estado vigente y diagnóstico real

- **Entorno:** Real: `edux-colegio-dosdemarzo`. Réplica: `dosdemarzo-14ded` (validado el 29/10/2026).
- **Diagnóstico inicial (Google Cloud REAL):** `/calificaciones` (859 lecturas/7d y 358,568 escaneos); `/estudiantes` (837 lecturas/7d); Catálogos (1,613 lecturas/7d).
- **Validación en Réplica (29/10/2026):** Tras recorrer todos los módulos (PPE, Notificaciones, Refuerzos, Calificaciones, ReporteAsistencias, ReporteNotas) en frío, el proyecto consumió **~4.3K lecturas**, demostrando que `/estudiantes` ya no genera picos masivos (solo 3 lecturas en 6 horas).
- **Validación Final (29/10/2026 - Tarde):** Se confirmó en la consola de Firebase que el consumo diario no superó las **15K lecturas** (de 50K permitidas en el plan Spark), demostrando que `persistentLocalCache` está operando al 100% y los parches de memoria eliminaron las lecturas redundantes.
- **Estado:** **✅ LISTO PARA PRODUCCIÓN.**
- **Lo que NO se toca:** Cálculos académicos, reglas de seguridad, `firebase.ts` (persistentLocalCache), payloads de escritura, PDFs, Excels.

### 1.1 Regla de oro con la configuración actual
Con `persistentLocalCache + persistentMultipleTabManager`, una lectura se factura solo cuando un **target (query canónica)** se sincroniza en frío o cambia su composición (ej. nuevos IDs en un `in [...]`). El enemigo estructural no es "abrir listeners", sino **multiplicar targets distintos** sobre los mismos documentos.

---

## 2. Bitácora de cambios aplicados (Fases 1 a 5 + Cierre Final)

### ✅ Fase 1 — Fix Crítico y Churn (instalada y validada)
- **`Calificaciones.tsx` (F0):** `PALETA_MATERIAS` restaurada (14 materias + fallback neutral). **CERRADO** — Ya no hay crash `Cannot read properties of undefined`.
- **`ReporteNotas.tsx` (F1):** `agruparEnLotesEstables()` ordena por hash antes de lotes de 30.
- **`refuerzo.ts` (F4):** `ContextoRecalculoEnMemoria` agregado a `recalcularInsumos()`.

### ✅ Fase 2 — Catálogos Fantasma (instalada y validada)
- **`DataContext.tsx` (F6):** `getDocs` reemplazado por **6 `onSnapshot` compartidos** (grados, ámbitos, destrezas, años, períodos, usuarios). El `reload` es no-op.

### ✅ Fase 3 — Unificación de Nómina (COMPLETADA Y VALIDADA AL 100%)
Se migraron **todos** los módulos a `estudiantesCache`, eliminando consultas directas a `/estudiantes`. **Ningún módulo lee ya esa colección de forma directa.**

| Sub-fase | Módulo | Cambios principales | Estado |
|---|---|---|---|
| **3.1** | `ReporteNotas.tsx` | Migrado a `estudiantesCache`. ESLint limpio. | ✅ Validado |
| **3.2** | `ReporteAsistencias.tsx` | Migrado a `estudiantesCache` (itera `gradosTutor ∪ gradosDocente`). Fixes `set-state-in-effect` y `prefer-const`. | ✅ Validado |
| **3.3** | `PPE.tsx` | Eliminada lectura de toda la institución (F5). Ahora usa `accesoCache` y `estudiantesCache`. | ✅ Validado |
| **3.4** | `Notificaciones.tsx` | Migrado de `cargarCacheNotificaciones` a `estudiantesCache`. 3 listeners conservados. | ✅ Validado |
| **3.5** | `RefuerzoPedagogico.tsx` | Migrado el `onSnapshot` del proceso activo y el `getDocs` del preview a `estudiantesCache`. | ✅ Validado |

### ✅ Fase 4.1 — ReporteNotas (F3) (instalada y validada)
- **Objetivo:** Matar el churn de `/calificaciones` al consultar desde ReporteNotas.
- **Cambio:** Se reemplazó `actividadId in [lotes de 30]` por `actividadId == id` (consultas individuales). Esto comparte el target canónico con `Calificaciones.tsx`.
- **Optimización extra:** Se filtran las actividades consolidadas (`idsAgrupados`) **antes** de generar las consultas, reduciendo el número de listeners abiertos en un 30-40%.
- **Archivo:** `src/pages/ReporteNotas.tsx`.
- **Estado:** **✅ CERRADO** (con filtro de insumos).

### ✅ Fase 4.2 — Inyección de Memoria (F4) (instalada y validada - Parches B y C)
- **Objetivo:** Evitar que `recalcularInsumos` haga consultas redundantes al aplicar un refuerzo o guardar notas masivas.
- **Cambio:** 
  1. Se modificó `guardarCalificaciones` en `Calificaciones.tsx` (Parche B) para construir el `ContextoRecalculoEnMemoria` (con actividades, estudiantes y calificaciones) antes de llamar a `recalcularInsumos`.
  2. Se modificó `aplicarRefuerzo` en `ReporteNotas.tsx` (Parche C) para inyectar el contexto en memoria.
- **Archivo:** `src/pages/Calificaciones.tsx` y `src/pages/ReporteNotas.tsx`.
- **Estado:** **✅ CERRADO** (inyección de memoria completa, 0 lecturas extras).

### ✅ Fase 4.3 — ReporteAsistencias (F7) (instalada y validada)
- **Objetivo:** Matar el churn de `/asistencias` al cambiar de rango de fechas.
- **Cambio:** Se reemplazó `fecha in [lote de 30]` por consultas **día por día** (`fecha == dia`). Ahora los días ya leídos se reutilizan de la caché persistente entre semanas, meses y trimestres.
- **Optimización extra:** Se procesan 5 días en paralelo con `Promise.all` para acelerar la carga de trimestres (~1.3s en lugar de ~6.5s).
- **Archivo:** `src/pages/ReporteAsistencias.tsx`.
- **Estado:** **✅ CERRADO** (target estable + paralelización).

### ✅ Fase 4.4 — Higiene de Lotes (F8) (instalada y validada - Parche A)
- **Objetivo:** Evitar que los lotes de `in [...]` cambien de composición.
- **Cambio:** Se agregó `.sort()` a los IDs antes de hacer los lotes en `abrirFichaEstudiante` (`Calificaciones.tsx`). Esto hace que los targets de Firestore sean deterministas y reutilizables.
- **Archivo:** `src/pages/Calificaciones.tsx`.
- **Estado:** **✅ CERRADO** (composición estable).

### ✅ Fase 5 — Optimización Final de Notificaciones (instalada y validada)
- **Objetivo:** Evitar que el listener de auditoría traiga todos los eventos históricos del docente.
- **Cambio:** Se agregó `orderBy("registradoEn", "desc")` y `limit(50)` al `onSnapshot` de `notificacionesNotasAuditoria`. Ahora el "Ver historial de cambios" solo trae los **50 eventos más recientes**, no la historia completa.
- **Archivo:** `src/pages/Notificaciones.tsx`.
- **Estado:** **✅ CERRADO** (preventivo para cuando la app tenga años de historial).

---

## 3. Arquitectura de la caché de estudiantes

`src/utils/estudiantesCache.ts` es la **única fuente** de nómina. Expone: `claveAccesoEstudiantes`, `claveConsultaEstudiantes`, `asegurarEstudiantesCache`, `leerEstudiantesCache`, `observarEstudiantesCache`, `configurarAccesoEstudiantes`.

### 3.1 Patrón estándar
```ts
const accesoCache = useMemo(() => claveAccesoEstudiantes(user?.uid, userData), [user?.uid, userData]);
useEffect(() => {
  // asegurarEstudiantesCache(clave) por grado
  // actualizarDesdeCache() -> leerEstudiantesCache + observarEstudiantesCache
}, [accesoCache, anioActivo?.id]);