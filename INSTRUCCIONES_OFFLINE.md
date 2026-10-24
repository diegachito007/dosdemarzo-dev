# Notas y asistencias sin conexión — Dos de Marzo

Esta versión permite registrar asistencia (una o varias horas por acción) y editar notas de actividades existentes en Calificaciones sin internet. Los cambios se confirman primero en IndexedDB y se envían al recuperar conexión con la aplicación abierta. No se ha desplegado ni se han modificado datos del Firebase real.

## Instalación

1. Conserva una copia de tu proyecto actual y sustituye los archivos por los de este ZIP. Incluye el firebase.ts suministrado, con su configuración de cliente conservada.
2. En la carpeta del proyecto ejecuta:

```bash
npm ci
npm run lint
npm run test:offline
npm run build
npm run preview
```

3. Publica la compilación siguiendo tu procedimiento habitual. La PWA necesita HTTPS (localhost también sirve para pruebas). El modo `npm run dev` no demuestra la reapertura offline del service worker.
4. Todos los profesores deben actualizar a esta versión antes de empezar la prueba. No mezcles clientes antiguos, que crean identificadores aleatorios, con la nueva sincronización. No se ejecutó una migración ni un borrado de documentos históricos.
5. Una nueva versión de la PWA muestra «Actualizar aplicación»; guarda los formularios antes de aceptar. No se fuerza la recarga mientras escriben.

## Antes de ir al aula

Con internet, en el mismo navegador/dispositivo que se usará en clase:

1. Iniciar sesión con Google y tener un perfil docente activo.
2. Esperar a que aparezca «Aplicación disponible sin conexión».
3. Pulsar «Preparar mis datos sin conexión» y esperar el mensaje de finalización.
4. Esta preparación descarga las asignaciones del año activo, los estudiantes de sus grados, las actividades y notas del período activo y la asistencia de la semana actual. Los datos maestros se cargan mediante DataContext.
5. Para trabajar otras fechas o períodos hay que cargarlos previamente con conexión. La caché no contiene automáticamente todo el historial de la institución.

El acceso offline reutiliza únicamente el perfil docente activo previamente descargado de la sesión Firebase existente. El primer inicio de sesión, una cuenta nueva y el acceso administrativo requieren internet. Al reconectar se vuelve a recibir el estado del perfil del servidor.

## Durante la clase

- Registrar asistencia igual que antes. Seleccionar las dos horas produce dos cambios distintos por estudiante, conservando cada número de hora.
- Guardar notas desde la lista o desde la matriz de Calificaciones.
- El mensaje «Guardado en este dispositivo» significa almacenamiento local confirmado; todavía puede faltar la confirmación del servidor.
- El indicador muestra red disponible, sin conexión o sincronización en curso, y la cantidad de cambios pendientes.
- Los cambios locales se recuperan al volver a abrir Calificaciones, incluidos los que necesitan revisión. Se puede descargar un respaldo JSON desde el panel de pendientes.
- Los informes y otras vistas siguen leyendo los datos de Firestore/caché: para emitir un informe actualizado, esperar a que la cola esté vacía y volver a abrir o refrescar el informe. No se añadió un motor offline nuevo para todos los reportes.

Crear/eliminar actividades, consolidar/desagrupar, aplicar refuerzos y editar fichas no forman parte del guardado offline de esta primera etapa. Esas operaciones se mantienen online. Los módulos administrativos tampoco están habilitados para operar offline.

## Al recuperar conexión

La aplicación intenta sincronizar al guardar y al recibir el evento de reconexión; reintenta los pendientes cada 15 segundos mientras está abierta. Que exista señal no garantiza que Firebase sea accesible. No se promete sincronización con el navegador cerrado.

Antes de escribir, se verifica en una transacción online el documento actual, el estado del perfil, la asignación docente, el estudiante, la actividad y las adaptaciones correspondientes. Se conservan los identificadores históricos cuando existen; para registros nuevos se usa una identidad estable por actividad/estudiante o grado/materia/fecha/estudiante/hora.

Si la versión del servidor cambió, el cambio local queda en «Revisión necesaria». No se impone automáticamente la última edición del dispositivo. Una hora que el tutor justificó no se sobrescribe desde una versión antigua del docente. Cada registro se sincroniza por separado: una clase puede estar parcialmente confirmada mientras otros registros siguen pendientes.

El recálculo de insumos usa la lógica existente y lecturas del servidor. La operación conserva su pendiente si el recálculo falla. La fórmula de notas y el historial de refuerzos no se sustituyeron.

Si aparece conflicto o error:

1. Descargar un respaldo de pendientes si se necesita conservar una copia adicional.
2. Revisar el cambio local y el registro actualizado del servidor con el tutor/administrador.
3. «Reintentar sin sobrescribir cambios ajenos» conserva la versión original de comparación: no fuerza un conflicto a resolverse.
4. Si corresponde conservar el servidor, descartar ese cambio local y volver a cargar la vista antes de editar de nuevo.

No se permite cerrar sesión mientras esa cuenta tenga cambios locales pendientes. No borrar los datos del navegador ni usar modo incógnito para trabajo que necesite conservarse después de cerrar la ventana.

## Pruebas realizadas

- TypeScript: compilación correcta.
- ESLint del proyecto: sin errores ni advertencias.
- Compilación Vite de producción: correcta; genera service worker y precaché. Se mantiene la advertencia de tamaño del bundle principal.
- Siete pruebas automatizadas: identidad por hora, huellas de versión, idempotencia/conflictos, persistencia/aislamiento por cuenta, guardado local atómico/reintentos, siete horas por día y sincronización con conservación de identificadores históricos, justificaciones y asignaciones.
- La persistencia se verifica con fake-indexeddb; las llamadas de sincronización se verifican con un doble de Firestore. Estas pruebas no equivalen a una prueba en Firebase real.
- No se pudo ejecutar la prueba de navegador: la descarga de Chromium falló. No se probó con cuentas reales ni con el emulador de Firebase.

## Prueba piloto requerida antes del uso general

Usar dos cuentas de prueba y registros de prueba:

1. Preparar la aplicación con internet y anotar una nota y asistencia de referencia.
2. Desconectar la red; cerrar y reabrir la PWA. Confirmar que entra la cuenta previamente preparada y aparecen estudiantes/actividades.
3. Registrar un bloque de dos horas y una nota de cero. Confirmar los pendientes; recargar y comprobar que se recuperan.
4. Reconectar. Esperar cero pendientes y revisar desde otro dispositivo: una sola nota por estudiante/actividad y dos asistencias por sus horas.
5. Sin conexión en el equipo docente, preparar una edición de una inasistencia; desde el tutor justificar esa misma hora. Reconectar al docente: la justificación debe mantenerse y el cambio del docente debe quedar en revisión.
6. Probar estados distintos entre las dos horas, cambios de adaptación y retiro de asignación docente mientras el dispositivo está offline.
7. Probar dos pestañas y pérdida de conexión durante sincronización. Confirmar que no se borra una edición local más reciente.
8. Confirmar que los insumos recalculados y los informes coinciden después de sincronizar y refrescar.

## Límites de alcance

La caché persistente ya existía en firebase.ts. La cola añade control de confirmación y conflictos para los guardados indicados; no reemplaza las reglas de seguridad del servidor. El archivo firestore.rules se conservó sin cambios y mantiene sus permisos generales actuales. Revisar permisos por materia/grado sigue siendo un trabajo separado; no se afirma que esos permisos estén endurecidos por esta entrega.

Una versión antigua que escriba documentos aleatorios durante el mismo período puede generar duplicados fuera del control de la cola nueva. Si ya existen varios documentos para una misma identidad, la sincronización los detecta y se detiene para revisión; no los fusiona ni borra automáticamente.
