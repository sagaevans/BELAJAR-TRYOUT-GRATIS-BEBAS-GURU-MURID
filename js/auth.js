// auth.js — Menangani login Google, logout, dan pengecekan role pengguna

import { auth, db, googleProvider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// Track which role button was clicked (for new users)
let pendingRole = null;

// ==========================================
// GOOGLE SIGN-IN (with role intent)
// ==========================================
async function loginWithGoogle(intendedRole) {
  try {
    showLoading(true);
    pendingRole = intendedRole || null;
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await checkUserRole(user.uid);
  } catch (error) {
    console.error("Firebase login error:", error.code, error.message);
    showLoading(false);
    alert("Login gagal: " + error.code);
  }
}

// ==========================================
// CHECK USER ROLE
// ==========================================
async function checkUserRole(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.role === "guru") {
        window.location.href = "dashboard-guru.html";
      } else if (data.role === "murid") {
        window.location.href = "dashboard-murid.html";
      }
    } else {
      if (pendingRole) {
        await saveRole(pendingRole);
      } else {
        showRoleSelection();
      }
    }
  } catch (error) {
    console.error("Gagal memeriksa role:", error.code, error.message);
    alert("Gagal memeriksa data pengguna: " + error.code);
  } finally {
    showLoading(false);
  }
}

// ==========================================
// SAVE ROLE
// ==========================================
async function saveRole(role) {
  const user = auth.currentUser;
  if (!user) {
    alert("Anda belum login.");
    return;
  }

  try {
    showLoading(true);
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: role,
      createdAt: serverTimestamp()
    });

    if (role === "guru") {
      window.location.href = "dashboard-guru.html";
    } else if (role === "murid") {
      window.location.href = "dashboard-murid.html";
    }
  } catch (error) {
    console.error("Gagal menyimpan role:", error.code, error.message);
    showLoading(false);
    alert("Gagal menyimpan role: " + error.code);
  }
}

// ==========================================
// LOGOUT
// ==========================================
async function logout() {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout gagal:", error.code, error.message);
    alert("Logout gagal: " + error.code);
  }
}

// ==========================================
// AUTH STATE LISTENER
// ==========================================
function initAuthListener() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (currentPage === "index.html" || currentPage === "") {
        // On homepage, don't auto-redirect — let user click buttons
      } else if (currentPage === "dashboard-guru.html") {
        await verifyRole(user.uid, "guru");
      } else if (currentPage === "dashboard-murid.html") {
        await verifyRole(user.uid, "murid");
      }
      updateNavbarUser(user.displayName);
    } else {
      if (currentPage !== "index.html" && currentPage !== "" && currentPage !== "admin.html" && currentPage !== "tryout.html") {
        window.location.href = "index.html";
      }
    }
  });
}

// ==========================================
// VERIFY ROLE (for dashboard pages)
// ==========================================
async function verifyRole(uid, expectedRole) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      window.location.href = "index.html";
      return;
    }

    const data = userSnap.data();
    if (data.role !== expectedRole) {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Gagal verifikasi role:", error.code, error.message);
    window.location.href = "index.html";
  }
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) {
    loader.style.display = show ? "flex" : "none";
  }
}

function showRoleSelection() {
  const heroSection = document.getElementById("hero-section");
  const loginSection = document.getElementById("login-section");
  const roleSection = document.getElementById("role-selection");

  if (heroSection) heroSection.style.display = "none";
  if (loginSection) loginSection.style.display = "none";
  if (roleSection) roleSection.style.display = "block";
}

function updateNavbarUser(displayName) {
  const userNameEl = document.getElementById("user-display-name");
  if (userNameEl && displayName) {
    userNameEl.textContent = displayName;
  }
}

// ==========================================
// EVENT BINDINGS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Login buttons (homepage)
  const btnLoginMurid = document.getElementById("btn-login-murid");
  if (btnLoginMurid) {
    btnLoginMurid.addEventListener("click", () => loginWithGoogle("murid"));
  }

  const btnLoginGuru = document.getElementById("btn-login-guru");
  if (btnLoginGuru) {
    btnLoginGuru.addEventListener("click", () => loginWithGoogle("guru"));
  }

  // Legacy: old Google login button (if exists)
  const btnLogin = document.getElementById("btn-login-google");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => loginWithGoogle(null));
  }

  // Role selection buttons (fallback)
  const btnGuru = document.getElementById("btn-role-guru");
  if (btnGuru) {
    btnGuru.addEventListener("click", () => saveRole("guru"));
  }

  const btnMurid = document.getElementById("btn-role-murid");
  if (btnMurid) {
    btnMurid.addEventListener("click", () => saveRole("murid"));
  }

  // Logout button
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }

  // Init auth listener
  initAuthListener();
});
