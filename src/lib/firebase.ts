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

// Para probar en local sin tocar los datos reales: npm run local
// (levanta los emuladores de Firebase y la app; también se abre desde el celular en la misma red wifi)
export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";

export const db = getFirestore(app);
export const auth = getAuth(app);

// Los emuladores corren en el mismo computador que sirve la app (así funciona también desde el celular)
const EMULATOR_HOST = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

export function connectAuthIfEmulator(a: Auth) {
  if (USE_EMULATORS) connectAuthEmulator(a, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
}

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectAuthIfEmulator(auth);
} else {
  getAnalytics(app);
}
