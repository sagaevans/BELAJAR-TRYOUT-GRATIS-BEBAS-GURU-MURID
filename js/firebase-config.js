// firebase-config.js
// Isi konfigurasi Firebase kamu di sini setelah setup project di Firebase Console
// Menggunakan Firebase v9 modular SDK via CDN (di-import dari HTML)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_KAMU",
  authDomain: "GANTI_DENGAN_AUTH_DOMAIN_KAMU",
  projectId: "GANTI_DENGAN_PROJECT_ID_KAMU",
  storageBucket: "GANTI_DENGAN_STORAGE_BUCKET_KAMU",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID_KAMU",
  appId: "GANTI_DENGAN_APP_ID_KAMU"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
