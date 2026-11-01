# Continuidad — Resolución de Bloqueo de Login por Caché "Zombi" de Firestore (v1.0 FINAL)

Actualizado: 31 de octubre de 2026.
Este documento registra las decisiones, diagnósticos y cambios aplicados a partir de la incidencia detectada el 30/10/2026. Prevalece sobre el historial anterior relacionado con autenticación. **Es el documento definitivo del proyecto para este incidente.**

---

## 0. Origen del incidente

Este documento nació de un **bloqueo de inicio de sesión** reportado por un usuario con rol `super_admin` (`difabians@gmail.com`) en el proyecto real `edux-colegio-dosdemarzo`, replicado posteriormente en el entorno de validación `dosdemarzo-14ded`. 

### Trazabilidad del Incidente → fases ejecutadas

| Síntoma / Fallo | Descripción | Fase que lo cerró | Estado |
|---|---|---|---|
| **S1** | Pantalla de carga infinita y error "No existe el perfil" en navegador habitual. | Fase 1 (diagnóstico) | ✅ CERRADO |
| **S2** | Inconsistencia de UID entre Firestore y la UI (`GestionUsuarios`). | Fase 2 (mapeo estricto) | ✅ CERRADO |
| **S3** | `onSnapshot` bloqueado por validación estricta de `fromCache`. | Fase 1 (relajación controlada) | ✅ CERRADO |

---

## 1. Estado vigente y diagnóstico real

- **Entorno:** Real: `edux-colegio-dosdemarzo`. Réplica: `dosdemarzo-14ded` (validado el 31/10/2026).
- **Diagnóstico inicial:** El usuario `difabians@gmail.com` no podía iniciar sesión en su navegador habitual, mostrando el error: *"No existe el perfil. Contacta al administrador; no se recreará durante esta sesión."*
- **Validación en Incógnito:** Al abrir una ventana de navegación privada, el usuario inició sesión correctamente y pudo acceder a todos los módulos, incluida la Gestión de Usuarios.
- **Estado:** **✅ RESUELTO Y LISTO PARA PRODUCCIÓN.**
- **Lo que NO se toca:** Reglas de seguridad de Firestore, estructura de la base de datos (los IDs y UIDs coinciden correctamente), configuración de `firebase.ts` (`persistentLocalCache`) y payloads de escritura.

### 1.1 Regla de oro con la configuración actual
Firestore está diseñado para ser "offline-first". Con `persistentLocalCache`, el `onSnapshot` **siempre** entregará primero los datos desde IndexedDB (`fromCache: true`) para ser rápido. Si el código rechaza ciegamente estos datos sin un mecanismo de reintento o fallback, el usuario quedará bloqueado si el servidor no envía un evento de cambio inmediato (porque Firestore considera que el documento ya está "sincronizado" localmente).

---

## 2. Bitácora de cambios aplicados (Fases 1 y 2)

### ✅ Fase 1 — Relajación controlada del caché en `AuthContext.tsx`
- **Objetivo:** Permitir que el usuario inicie sesión al instante usando el caché local si es válido, pero seguir bloqueando estados locales no confirmados (`hasPendingWrites`), evitando el "estado zombi".
- **Archivo:** `src/context/AuthContext.tsx` (Alrededor de la línea 150).
- **Cambio:** 
  ```typescript
  // ANTES
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
  
  // DESPUÉS
  // Permitimos el caché para entrar al instante y evitar bloqueos por "estado zombi",
  // pero seguimos ignorando si hay escrituras pendientes locales no confirmadas por el servidor.
  if (snapshot.metadata.hasPendingWrites) return;