import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const firebaseError = error as { code: string };
        // Ignorar si el usuario cerró el popup manualmente
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          return;
        }
        // Ignorar si el usuario canceló el popup
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

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
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