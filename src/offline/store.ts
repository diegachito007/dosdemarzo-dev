import { fingerprint, mergeChange } from './model';
import type { Change } from './model';
let connection: Promise<IDBDatabase> | undefined;
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('edux-offline') : undefined;
const emit = () => { listeners.forEach(fn => fn()); window.dispatchEvent(new Event('eduX:offlineChanged')); };
channel?.addEventListener('message', emit);
export function subscribeOffline(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function open() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('edux-outbox-v1', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('changes', { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { connection = undefined; reject(req.error); };
    req.onblocked = () => { connection = undefined; reject(new Error('Cierra otras pestañas para habilitar el guardado local.')); };
  });
  return connection;
}
function request<T>(req: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function completed(tx: IDBTransaction) { return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error || new Error('No se pudo guardar en este dispositivo.')); }); }
export async function changesFor(uid: string) {
  const db = await open(); const tx = db.transaction('changes', 'readonly');
  return (await request(tx.objectStore('changes').getAll()) as Change[]).filter(c => c.uid === uid).sort((a,b) => a.savedAt - b.savedAt);
}
export async function enqueue(changes: Change[]) {
  const db = await open(); const tx = db.transaction('changes', 'readwrite'); const done = completed(tx); const store = tx.objectStore('changes');
  try {
    // Requests are scheduled in one IndexedDB transaction: all local saves or none.
    await Promise.all(changes.map(async next => {
      const prev = await request(store.get(next.key)) as Change | undefined;
      store.put(mergeChange(prev, next));
    }));
  } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
  await done; emit(); channel?.postMessage('changed');
}
export async function settle(change: Change, error?: { state: 'error' | 'conflict'; message: string }, acknowledged?: { id: string; data: Record<string, unknown> }) {
  const db = await open(); const tx = db.transaction('changes', 'readwrite'); const done = completed(tx); const store = tx.objectStore('changes');
  const current = await request(store.get(change.key)) as Change | undefined;
  // Never erase a newer edit made while the old edit was in flight.
  if (current?.revision === change.revision) {
    if (error) store.put({ ...current, ...error }); else store.delete(change.key);
  } else if (current && !error && acknowledged?.data.offlineOperationId === change.revision) {
    store.put({ ...current, documentId: acknowledged.id, base: fingerprint(acknowledged.data) });
  }
  await done; emit(); channel?.postMessage('changed');
}
export async function discard(change: Change) { await settle(change); }
export async function retry(change: Change) {
  // Atomic retry: never delete a pending record before its replacement is durable.
  const db = await open(); const tx = db.transaction('changes', 'readwrite'); const done = completed(tx); const store = tx.objectStore('changes');
  const current = await request(store.get(change.key)) as Change | undefined;
  if (current?.revision === change.revision) store.put({ ...current, state: 'pending', message: undefined });
  await done; emit(); channel?.postMessage('changed');
}
