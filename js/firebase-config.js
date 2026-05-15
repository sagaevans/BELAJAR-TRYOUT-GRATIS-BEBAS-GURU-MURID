// firebase-config.js
// Firebase Web App configuration for Belajar Tryout Gratis

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5qxPy2iS5Lrb9H-roQV3yg-fLnm9lGo4",
  authDomain: "belajar-tryout-gratis.firebaseapp.com",
  projectId: "belajar-tryout-gratis",
  storageBucket: "belajar-tryout-gratis.firebasestorage.app",
  messagingSenderId: "868417168736",
  appId: "1:868417168736:web:275e03976484f63f95aa05"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
