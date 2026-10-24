export type RecordData = Record<string, unknown>;
export interface Change {
  key: string;
  uid: string;
  collection: 'asistencias' | 'calificaciones';
  identity: Record<string, string | number>;
  documentId?: string;
  assignmentId?: string;
  studentName?: string;
  base: string | null;
  patch: RecordData;
  revision: string;
  state: 'pending' | 'conflict' | 'error';
  message?: string;
  savedAt: number;
}
export function fingerprint(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === undefined) return null;
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(normalize);
    const obj = v as RecordData;
    // Firestore timestamps retain the same representation through IndexedDB/JSON.
    if ('seconds' in obj && 'nanoseconds' in obj) return [obj.seconds, obj.nanoseconds];
    return Object.fromEntries(Object.keys(obj).filter(k => k !== 'id').sort().map(k => [k, normalize(obj[k])]));
  };
  return JSON.stringify(normalize(value));
}
export function logicalKey(collection: Change['collection'], identity: Change['identity']): string {
  return `${collection}_${Object.keys(identity).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(identity[k])}`).join('_')}`;
}
export function makeChange(uid: string, collection: Change['collection'], identity: Change['identity'], patch: RecordData, existing?: { id: string; data: RecordData }, assignmentId?: string, studentName?: string): Change {
  return { uid, collection, identity, patch, assignmentId, studentName, documentId: existing?.id,
    base: existing ? fingerprint(existing.data) : null,
    key: `${uid}:${logicalKey(collection, identity)}`, revision: crypto.randomUUID(),
    state: 'pending', savedAt: Date.now() };
}
export function mergeChange(previous: Change | undefined, next: Change): Change {
  if (!previous) return next;
  if (previous.state !== 'pending') throw new Error('Hay un cambio en conflicto. Revísalo antes de editar este registro.');
  return { ...next, base: previous.base, documentId: previous.documentId, patch: { ...previous.patch, ...next.patch } };
}
export function decideChange(change: Change, current: RecordData | undefined): 'write' | 'already-applied' | 'conflict' {
  // Per-operation token makes retries safe after an interrupted acknowledgement.
  if (current?.offlineOperationId === change.revision) return 'already-applied';
  return (current ? fingerprint(current) : null) === change.base ? 'write' : 'conflict';
}
