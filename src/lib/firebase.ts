import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDes-bN8sWz2VDvwjSq_gKnMqZEqN_8Fe0",
  authDomain: "dosdemarzo-14ded.firebaseapp.com",
  projectId: "dosdemarzo-14ded",
  storageBucket: "dosdemarzo-14ded.firebasestorage.app",
  messagingSenderId: "57067092144",
  appId: "1:57067092144:web:015591afcad20164e3a375"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();