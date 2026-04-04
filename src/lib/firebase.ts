// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
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
const analytics = getAnalytics(app);
export const db = getFirestore(app);
