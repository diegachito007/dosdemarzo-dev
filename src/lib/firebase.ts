import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBLsa4tCx4OMEE-5fymTGiuSaE063W4NCE",
  authDomain: "leocalificaciones.firebaseapp.com",
  projectId: "leocalificaciones",
  storageBucket: "leocalificaciones.firebasestorage.app",
  messagingSenderId: "629723932602",
  appId: "1:629723932602:web:00bcfc9707aac46b9f5f83",
  measurementId: "G-5QSPDH2V4M"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();