import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import type { AppUser } from '../types';

interface AuthContextType {
  user: User | null;
  userData: AppUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  canDeleteUser: (targetUser: AppUser) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const userRef = doc(db, 'usuarios', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const newUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || 'Nuevo Usuario',
            photoURL: firebaseUser.photoURL ?? null,
            role: 'docente',
            status: 'pending',
            gradosAsignados: [],
            tutorDe: [],
            nombreDocumento: '',
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, {
            ...newUser,
            createdAt: serverTimestamp(),
          });
          setUserData(newUser);
        }

        const unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setUserData({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: data.displayName || firebaseUser.displayName || 'Usuario',
              photoURL: firebaseUser.photoURL ?? null,
              role: data.role || 'docente',
              status: data.status || 'pending',
              gradosAsignados: data.gradosAsignados || [],
              tutorDe: data.tutorDe || [],
              nombreDocumento: data.nombreDocumento || '',
              createdAt: data.createdAt || new Date().toISOString(),
            });
          }
          setLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          return;
        }
        if (firebaseError.code === 'auth/popup-blocked') {
          console.warn('Popup bloqueado por el navegador');
          return;
        }
      }
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // ✅ SIMPLIFICADO: Solo super_admin puede eliminar usuarios
  const canDeleteUser = useCallback((targetUser: AppUser): boolean => {
    if (!userData) return false;
    
    // Solo super_admin puede eliminar usuarios
    if (userData.role === 'super_admin') {
      return userData.uid !== targetUser.uid;
    }
    
    // Docentes no pueden eliminar a nadie
    return false;
  }, [userData]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        loginWithGoogle,
        logout,
        canDeleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};