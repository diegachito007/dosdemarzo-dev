import { collection, doc, getDocFromServer, getDocsFromServer, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { decideChange, logicalKey } from './model';
import type { RecordData } from './model';
import { changesFor, settle } from './store';
import { recalcularInsumos } from '../utils/refuerzo';
class Conflict extends Error {}
let running = false;
export async function synchronize(uid: string) {
  if (running || !navigator.onLine || auth.currentUser?.uid !== uid) return;
  running = true;
  window.dispatchEvent(new CustomEvent('eduX:syncing', { detail: true }));
  try {
    const work = async () => {
      const changes = await changesFor(uid);
      for (const change of changes.filter(c => c.state === 'pending')) {
        if (!navigator.onLine || auth.currentUser?.uid !== uid) break;
        try {
          const snap = await getDocsFromServer(query(collection(db, change.collection), ...Object.entries(change.identity).map(([key,value]) => where(key, '==', value))));
          // Legacy attendance without hora represented the first hour in Calificaciones.
          let legacy = snap.docs;
          if (change.collection === 'asistencias' && change.identity.hora === 1 && !legacy.length) {
            const identity = { ...change.identity }; delete identity.hora;
            const old = await getDocsFromServer(query(collection(db, change.collection), ...Object.entries(identity).map(([key,value]) => where(key, '==', value))));
            legacy = old.docs.filter(d => d.data().hora == null);
          }
          if (legacy.length > 1) throw new Conflict('Hay registros duplicados en el servidor. Revisión necesaria.');
          const targetId = legacy[0]?.id || change.documentId || `offline_${logicalKey(change.collection, change.identity)}`;
          const ref = doc(db, change.collection, targetId);
          await runTransaction(db, async tx => {
            const profile = await tx.get(doc(db, 'usuarios', uid));
            const current = await tx.get(ref);
            if (auth.currentUser?.uid !== uid || profile.data()?.status !== 'active') throw new Conflict('La cuenta ya no está activa.');
            const result = decideChange(change, current.exists() ? current.data() : undefined);
            if (result === 'already-applied') return;
            if (result === 'conflict') throw new Conflict('Este registro cambió en el servidor. Se conservó tu cambio local sin sobrescribirlo.');
            const student = await tx.get(doc(db, 'estudiantes', String(change.identity.estudianteId)));
            if (!student.exists() || !student.data().activo) throw new Conflict('El estudiante ya no está activo.');
            const tutorAttendance = change.collection === 'asistencias' && (profile.data()?.tutorDe || []).includes(student.data().gradoId);
            const assignment = change.assignmentId ? await tx.get(doc(db, 'asignaturasDocente', change.assignmentId)) : undefined;
            if (profile.data()?.role !== 'super_admin' && !tutorAttendance &&
                (!assignment?.exists() || !assignment.data().activo || assignment.data().docenteId !== uid || assignment.data().gradoId !== student.data().gradoId)) {
              throw new Conflict('Tu asignación docente cambió o no se pudo verificar. Revisa la materia.');
            }

            if (change.collection === 'asistencias' && student.data().gradoId !== change.patch.gradoId) throw new Conflict('El estudiante cambió de grado.');
            if (change.collection === 'asistencias' && profile.data()?.role !== 'super_admin' && !tutorAttendance && change.identity.ambitoId !== 'general') {
              const subjectId = assignment?.data()?.destrezaId;
              const subject = subjectId ? await tx.get(doc(db, 'destrezas', subjectId)) : undefined;
              if (subjectId !== change.identity.ambitoId && subject?.data()?.ambitoId !== change.identity.ambitoId) throw new Conflict('La materia de esta hora ya no corresponde a tu asignación.');
            }

            if (change.collection === 'calificaciones') {
              const activity = await tx.get(doc(db, 'actividades', String(change.identity.actividadId)));
              if (!activity.exists() || activity.data().esConsolidado) throw new Conflict('La actividad ya no admite edición de notas.');
              const a = activity.data();
              if (profile.data()?.role !== 'super_admin' && assignment?.data()?.destrezaId !== a.destrezaId) throw new Conflict('La actividad ya no corresponde a tu asignación.');
              const special = !!student.data().conAdaptacion;
              const applies = a.dirigidaA === 'ambos' || (a.dirigidaA === 'especial' ? (a.estudianteIds?.length ? a.estudianteIds.includes(student.id) : special) : !special);
              if (!applies || a.gradoId !== student.data().gradoId) throw new Conflict('La actividad o adaptación del estudiante cambió.');
              if (current.data()?.refuerzo && change.patch.nota !== current.data()?.nota) throw new Conflict('La nota original tiene refuerzo y está protegida.');
            }
            if (change.collection === 'asistencias' && current.data()?.estado === 'J' && !(profile.data()?.tutorDe || []).includes(change.patch.gradoId)) throw new Conflict('Esta hora fue justificada por el tutor.');
            const data: RecordData = { ...change.patch, updatedAt: serverTimestamp(), offlineOperationId: change.revision };
            if (!current.exists()) Object.assign(data, { createdAt: serverTimestamp(), [change.collection === 'asistencias' ? 'registradoPor' : 'docenteId']: uid });
            tx.set(ref, data, { merge: true });
          });
          if (change.collection === 'calificaciones') {
            if (!navigator.onLine) break;
            // Keep the operation durable until its derived marks are confirmed too.
            const result = await recalcularInsumos([String(change.identity.actividadId)], true);
            if (!result.ok) throw new Error(`La nota se guardó; falta recalcular el insumo. ${result.error || 'Reintenta al tener conexión.'}`);
          }
          const acknowledged = await getDocFromServer(ref);
          await settle(change, undefined, acknowledged.exists() ? { id: acknowledged.id, data: acknowledged.data() } : undefined);
          window.dispatchEvent(new Event('eduX:synchronized'));
        } catch (error) {
          const code = (error as {code?: string}).code;
          if (!navigator.onLine || ['unavailable','deadline-exceeded','cancelled'].includes(code || '')) break;
          await settle(change, { state: error instanceof Conflict ? 'conflict' : 'error', message: error instanceof Error ? error.message : 'No se pudo sincronizar.' });
        }
      }
    };
    // Serialize tabs where supported; revisions and transaction checks protect retries too.
    if (navigator.locks) await navigator.locks.request(`edux-sync-${uid}`, work); else await work();
  } finally { running = false; window.dispatchEvent(new CustomEvent('eduX:syncing', { detail: false })); }
}
