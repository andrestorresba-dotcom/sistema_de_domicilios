import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { auth, db, firebaseConfig, connectAuthIfEmulator } from './firebase';

export type Role = 'admin' | 'cajero';

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
}

// Los usuarios inician sesión con un nombre de usuario; internamente Firebase Auth
// necesita un correo, así que lo construimos. Si escriben un correo completo, se usa tal cual.
const USER_DOMAIN = 'asadero-ventilador.app';
export const usernameToEmail = (username: string) => {
  const clean = username.trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@${USER_DOMAIN}`;
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  cajero: 'Cajero',
};

interface AuthState {
  loading: boolean;
  firebaseUser: User | null;
  profile: UserProfile | null;
  /** true cuando aún no existe ningún administrador (primera instalación) */
  needsSetup: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupFirstAdmin: (name: string, username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'config', 'setup'))
      .then(snap => setNeedsSetup(!snap.exists()))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, user => {
      unsubProfile?.();
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setProfileReady(true);
        return;
      }
      setProfileReady(false);
      unsubProfile = onSnapshot(
        doc(db, 'usuarios', user.uid),
        snap => {
          setProfile(snap.exists() ? ({ uid: user.uid, ...snap.data() } as UserProfile) : null);
          setProfileReady(true);
        },
        () => {
          setProfile(null);
          setProfileReady(true);
        },
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const login = async (username: string, password: string) => {
    await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const setupFirstAdmin = async (name: string, username: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
    const batch = writeBatch(db);
    batch.set(doc(db, 'usuarios', cred.user.uid), {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role: 'admin',
      active: true,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'config', 'setup'), { adminUid: cred.user.uid, createdAt: serverTimestamp() });
    await batch.commit();
    setNeedsSetup(false);
  };

  const value: AuthState = {
    loading: !authReady || !profileReady,
    firebaseUser,
    profile,
    needsSetup,
    isAdmin: profile?.role === 'admin' && profile.active,
    login,
    logout,
    setupFirstAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/**
 * Crea un usuario nuevo sin cerrar la sesión del administrador.
 * Firebase inicia sesión automáticamente con el usuario recién creado, por eso
 * se usa una segunda instancia de la app solo para esta operación.
 */
export async function createStaffUser(data: { name: string; username: string; clave: string; role: Role }) {
  const existing = getApps().find(a => a.name === 'crear-usuarios');
  const secondaryAuth = getAuth(existing ?? initializeApp(firebaseConfig, 'crear-usuarios'));
  if (!existing) connectAuthIfEmulator(secondaryAuth);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(data.username), data.clave);
  await signOut(secondaryAuth);
  await setDoc(doc(db, 'usuarios', cred.user.uid), {
    name: data.name.trim(),
    username: data.username.trim().toLowerCase(),
    role: data.role,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
    case 'auth/email-already-in-use':
      return 'Ese nombre de usuario ya existe.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'Activa el método "Correo/contraseña" en Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa el internet e intenta de nuevo.';
    case 'permission-denied':
      return 'No tienes permiso para hacer esto.';
    default:
      return 'Ocurrió un error. Intenta de nuevo.';
  }
}
