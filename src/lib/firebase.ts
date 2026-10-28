// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCRUnn46RHTIBHbFS2tqJAo0zqd0ySPyeY",
  authDomain: "sistema-domicilios-5d183.firebaseapp.com",
  projectId: "sistema-domicilios-5d183",
  storageBucket: "sistema-domicilios-5d183.firebasestorage.app",
  messagingSenderId: "399101328704",
  appId: "1:399101328704:web:abcb5bf8fc65a534c0cea5",
  measurementId: "G-T3KNN5ZWXE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Para probar en local sin tocar los datos reales: VITE_USE_EMULATORS=true npm run dev
// (con `firebase emulators:start --only auth,firestore` corriendo)
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";

export const db = getFirestore(app);
export const auth = getAuth(app);

export function connectAuthIfEmulator(a: Auth) {
  if (USE_EMULATORS) connectAuthEmulator(a, "http://127.0.0.1:9099", { disableWarnings: true });
}

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthIfEmulator(auth);
} else {
  getAnalytics(app);
}
