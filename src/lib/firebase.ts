import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// ⚠️ MANTÉN AQUÍ TU firebaseConfig EXACTO (no lo cambies)
const firebaseConfig = {
  apiKey: "AIzaSyDes-bN8sWz2VDvwjSq_gKnMqZEqN_8Fe0",
  authDomain: "dosdemarzo-14ded.firebaseapp.com",
  projectId: "dosdemarzo-14ded",
  storageBucket: "dosdemarzo-14ded.firebasestorage.app",
  messagingSenderId: "57067092144",
  appId: "1:57067092144:web:015591afcad20164e3a375"
};

const app = initializeApp(firebaseConfig);

// Caché persistente de Firestore compartida entre pestañas.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// ✅ Auth se mantiene igual
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();