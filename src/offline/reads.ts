import { getDocs, getDocsFromCache } from 'firebase/firestore';
import type { DocumentData, Query } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { changesFor } from './store';
import type { Change } from './model';
// Use the persistent Firestore cache without waiting for a network timeout.
export function readAvailable<T extends DocumentData>(q: Query<T>) {
  return navigator.onLine ? getDocs(q) : getDocsFromCache(q);
}
export const readCached = getDocsFromCache;
export async function localChanges(collection: Change['collection']) {
  return auth.currentUser ? (await changesFor(auth.currentUser.uid)).filter(c => c.collection === collection) : [];
}
