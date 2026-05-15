// admin.js — Mengelola fitur admin: verifikasi token, monitoring data, dan manajemen platform

import { db } from "./firebase-config.js";
import { collection, query, where, getDocs, deleteDoc, updateDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let allGuru = [], allMurid = [], allSchools = [], allSoal = [], allPaket = [], allResults = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Check existing session
  if (localStorage.getItem("adminSession") === "active") {
    showAdminDashboard();
    loadAllData();
  }

  // Verify token button
  const btnVerify = document.getElementById("btn-verify-token");
  if (btnVerify) btnVerify.addEventListener("click", handleVerifyToken);

  // Logout button
  const btnLogout = document.getElementById("btn-admin-logout");
  if (btnLogout) btnLogout.addEventListener("click", handleLogout);

  // Filter events
  bindFilterEvents();
});

// ==========================================
// TOKEN VERIFICATION
// ==========================================
async function handleVerifyToken() {
  const tokenInput = document.getElementById("admin-token");
  const errorEl = document.getElementById("admin-login-error");
  if (!tokenInput) return;
  const token = tokenInput.value.trim();
  if (!token) { showLoginError("Masukkan token terlebih dahulu."); return; }
  if (errorEl) errorEl.style.display = "none";
  showLoading(true);

  try {
    // Call GitHub API to verify token
    const response = await fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
      showLoading(false);
      showLoginError("Token tidak valid atau kadaluarsa. Periksa kembali.");
      return;
    }

    const userData = await response.json();
    const githubUsername = userData.login.toLowerCase();

    // Parse owner username from URL
    const ownerUsername = getRepoOwnerFromURL();

    if (!ownerUsername) {
      showLoading(false);
      showLoginError("Tidak dapat menentukan owner repo dari URL. Pastikan deploy di GitHub Pages.");
      return;
    }

    // Compare usernames
    if (githubUsername !== ownerUsername.toLowerCase()) {
      showLoading(false);
      showLoginError("Akses ditolak. Token bukan milik owner repo ini.");
      return;
    }

    // Success! Save session (PAT is NOT saved)
    localStorage.setItem("adminSession", "active");
    localStorage.setItem("adminUsername", githubUsername);
    localStorage.setItem("adminLoginAt", new Date().toISOString());

    // Clear token from input immediately
    tokenInput.value = "";

    showAdminDashboard();
    await loadAllData();

  } catch (error) {
    console.error("Verifikasi gagal:", error);
    showLoginError("Gagal memverifikasi token. Periksa koneksi internet.");
  } finally {
    showLoading(false);
  }
}

// ==========================================
// PARSE REPO OWNER FROM URL
// ==========================================
function getRepoOwnerFromURL() {
  const hostname = window.location.hostname;
  // GitHub Pages format: {username}.github.io
  if (hostname.endsWith(".github.io")) {
    return hostname.replace(".github.io", "");
  }
  // For local development/testing, allow bypass with localStorage
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return localStorage.getItem("adminUsername") || "local-dev";
  }
  // Fallback: try to extract from pathname or meta tag
  return null;
}

// ==========================================
// LOGOUT
// ==========================================
function handleLogout() {
  localStorage.removeItem("adminSession");
  localStorage.removeItem("adminUsername");
  localStorage.removeItem("adminLoginAt");
  window.location.reload();
}

// ==========================================
// SHOW/HIDE UI
// ==========================================
function showAdminDashboard() {
  document.getElementById("admin-login-section").style.display = "none";
  document.getElementById("admin-dashboard-section").style.display = "block";
  const usernameEl = document.getElementById("admin-username-display");
  const logoutBtn = document.getElementById("btn-admin-logout");
  if (usernameEl) { usernameEl.textContent = `@${localStorage.getItem("adminUsername") || "admin"}`; usernameEl.style.display = "inline"; }
  if (logoutBtn) logoutBtn.style.display = "inline";
}

// ==========================================
// LOAD ALL DATA
// ==========================================
async function loadAllData() {
  showLoading(true);
  try {
    await Promise.all([loadGuru(), loadMurid(), loadSchools(), loadSoal(), loadPaket(), loadResults()]);
    updateStats();
  } catch (error) {
    console.error("Gagal memuat data admin:", error);
  } finally {
    showLoading(false);
  }
}

async function loadGuru() {
  const q = query(collection(db, "users"), where("role", "==", "guru"));
  const snap = await getDocs(q);
  allGuru = []; snap.forEach(d => allGuru.push({ id: d.id, ...d.data() }));
  renderGuru();
}

async function loadMurid() {
  const q = query(collection(db, "users"), where("role", "==", "murid"));
  const snap = await getDocs(q);
  allMurid = []; snap.forEach(d => allMurid.push({ id: d.id, ...d.data() }));
  renderMurid();
}

async function loadSchools() {
  const snap = await getDocs(collection(db, "schools"));
  allSchools = []; snap.forEach(d => allSchools.push({ id: d.id, ...d.data() }));
  renderSchools();
}

async function loadSoal() {
  const snap = await getDocs(collection(db, "teacher_questions"));
  allSoal = []; snap.forEach(d => allSoal.push({ id: d.id, ...d.data() }));
  renderSoal();
}

async function loadPaket() {
  const snap = await getDocs(collection(db, "exam_packages"));
  allPaket = []; snap.forEach(d => allPaket.push({ id: d.id, ...d.data() }));
  renderPaket();
}

async function loadResults() {
  const snap = await getDocs(collection(db, "exam_results"));
  allResults = []; snap.forEach(d => allResults.push({ id: d.id, ...d.data() }));
  renderResults();
}

// ==========================================
// UPDATE STATS
// ==========================================
function updateStats() {
  setText("stat-guru", allGuru.length);
  setText("stat-murid", allMurid.length);
  setText("stat-sekolah", allSchools.length);
  setText("stat-soal", allSoal.length);
  setText("stat-paket", allPaket.length);
  setText("stat-published", allPaket.filter(p => p.isPublished).length);
  setText("stat-results", allResults.length);
}

// ==========================================
// RENDER GURU
// ==========================================
function renderGuru() {
  const container = document.getElementById("admin-guru-container");
  if (!container) return;
  const search = (document.getElementById("admin-guru-search") || {}).value.trim().toLowerCase();
  let filtered = allGuru;
  if (search) filtered = filtered.filter(g => (g.teacherUsername || "").toLowerCase().includes(search) || (g.email || "").toLowerCase().includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data guru.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Username</th><th>Email</th><th>Sekolah</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>';
  filtered.forEach(g => {
    const date = g.createdAt && g.createdAt.toDate ? g.createdAt.toDate().toLocaleDateString("id-ID") : "—";
    html += `<tr><td>${g.teacherUsername || "—"}</td><td>${g.email || "—"}</td><td>${g.schoolName || "—"}</td><td>${date}</td><td><button class="btn-sm btn-delete" data-col="users" data-id="${g.id}">Hapus</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
  bindDeleteButtons(container);
}

// ==========================================
// RENDER MURID
// ==========================================
function renderMurid() {
  const container = document.getElementById("admin-murid-container");
  if (!container) return;
  const search = (document.getElementById("admin-murid-search") || {}).value.trim().toLowerCase();
  let filtered = allMurid;
  if (search) filtered = filtered.filter(m => (m.studentName || "").toLowerCase().includes(search) || (m.studentUniqueNumber || "").includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data murid.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Nama</th><th>Nomor</th><th>Sekolah</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>';
  filtered.forEach(m => {
    const date = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleDateString("id-ID") : "—";
    html += `<tr><td>${m.studentName || "—"}</td><td>${m.studentUniqueNumber || "—"} (${m.studentNumberType || ""})</td><td>${m.schoolName || "—"}</td><td>${date}</td><td><button class="btn-sm btn-delete" data-col="users" data-id="${m.id}">Hapus</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
  bindDeleteButtons(container);
}

// ==========================================
// RENDER SCHOOLS
// ==========================================
function renderSchools() {
  const container = document.getElementById("admin-school-container");
  if (!container) return;
  const search = (document.getElementById("admin-school-search") || {}).value.trim().toLowerCase();
  let filtered = allSchools;
  if (search) filtered = filtered.filter(s => (s.displayName || "").toLowerCase().includes(search) || (s.city || "").toLowerCase().includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data sekolah.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Nama Sekolah</th><th>Jenjang</th><th>Status</th><th>Kota</th><th>Aksi</th></tr></thead><tbody>';
  filtered.forEach(s => {
    html += `<tr><td>${s.displayName || "—"}</td><td>${s.level || "—"}</td><td>${s.status || "—"}</td><td>${s.city || "—"}</td><td><button class="btn-sm btn-delete" data-col="schools" data-id="${s.id}">Hapus</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
  bindDeleteButtons(container);
}

// ==========================================
// RENDER SOAL
// ==========================================
function renderSoal() {
  const container = document.getElementById("admin-soal-container");
  if (!container) return;
  const fj = (document.getElementById("admin-soal-jenjang") || {}).value;
  const search = (document.getElementById("admin-soal-search") || {}).value.trim().toLowerCase();
  let filtered = allSoal;
  if (fj) filtered = filtered.filter(s => s.jenjang === fj);
  if (search) filtered = filtered.filter(s => (s.mapel || "").toLowerCase().includes(search) || (s.teacherUsername || "").toLowerCase().includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data soal.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Mapel</th><th>Kelas</th><th>Jenjang</th><th>Guru</th><th>Preview</th><th>Aksi</th></tr></thead><tbody>';
  filtered.slice(0, 50).forEach(s => {
    const preview = (s.questionText || "").substring(0, 40) + "...";
    html += `<tr><td>${s.mapel || "—"}</td><td>${s.kelas || "—"}</td><td>${s.jenjang || "—"}</td><td>${s.teacherUsername || "—"}</td><td>${preview}</td><td><button class="btn-sm btn-delete" data-col="teacher_questions" data-id="${s.id}">Hapus</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  if (filtered.length > 50) html += `<p class="form-hint">Menampilkan 50 dari ${filtered.length} soal.</p>`;
  container.innerHTML = html;
  bindDeleteButtons(container);
}

// ==========================================
// RENDER PAKET
// ==========================================
function renderPaket() {
  const container = document.getElementById("admin-paket-container");
  if (!container) return;
  const fs = (document.getElementById("admin-paket-status") || {}).value;
  const search = (document.getElementById("admin-paket-search") || {}).value.trim().toLowerCase();
  let filtered = allPaket;
  if (fs === "published") filtered = filtered.filter(p => p.isPublished);
  else if (fs === "draft") filtered = filtered.filter(p => !p.isPublished);
  if (search) filtered = filtered.filter(p => (p.title || "").toLowerCase().includes(search) || (p.teacherUsername || "").toLowerCase().includes(search));
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data paket.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Judul</th><th>Mapel</th><th>Guru</th><th>Status</th><th>Soal</th><th>Aksi</th></tr></thead><tbody>';
  filtered.forEach(p => {
    const badge = p.isPublished ? '<span class="badge badge-published">Published</span>' : '<span class="badge badge-draft">Draft</span>';
    const unpubBtn = p.isPublished ? `<button class="btn-sm btn-unpublish" data-id="${p.id}">Unpublish</button>` : '';
    html += `<tr><td>${p.title || "—"}</td><td>${p.mapel || "—"}</td><td>${p.teacherUsername || "—"}</td><td>${badge}</td><td>${p.totalQuestions || 0}</td><td>${unpubBtn} <button class="btn-sm btn-delete" data-col="exam_packages" data-id="${p.id}">Hapus</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
  bindDeleteButtons(container);
  container.querySelectorAll(".btn-unpublish").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Unpublish paket ini?")) return;
      showLoading(true);
      try {
        await updateDoc(doc(db, "exam_packages", btn.dataset.id), { isPublished: false });
        await loadPaket();
        updateStats();
      } catch (e) { alert("Gagal unpublish."); }
      finally { showLoading(false); }
    });
  });
}

// ==========================================
// RENDER RESULTS
// ==========================================
function renderResults() {
  const container = document.getElementById("admin-result-container");
  if (!container) return;
  const search = (document.getElementById("admin-result-search") || {}).value.trim().toLowerCase();
  const fs = (document.getElementById("admin-result-score") || {}).value;
  let filtered = allResults;
  if (search) filtered = filtered.filter(r => (r.studentName || "").toLowerCase().includes(search) || (r.examTitle || "").toLowerCase().includes(search));
  if (fs === "high") filtered = filtered.filter(r => r.score >= 75);
  else if (fs === "mid") filtered = filtered.filter(r => r.score >= 60 && r.score < 75);
  else if (fs === "low") filtered = filtered.filter(r => r.score < 60);
  if (filtered.length === 0) { container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data hasil.</p>'; return; }
  let html = '<div class="recap-table-wrapper"><table class="recap-table"><thead><tr><th>Murid</th><th>Ujian</th><th>Guru</th><th>Nilai</th><th>Benar</th><th>Salah</th></tr></thead><tbody>';
  filtered.slice(0, 100).forEach(r => {
    const sc = r.score >= 75 ? "score-high" : r.score >= 60 ? "score-mid" : "score-low";
    html += `<tr><td>${r.studentName || "—"}</td><td>${r.examTitle || "—"}</td><td>${r.teacherUsername || "—"}</td><td class="${sc}">${r.score}</td><td>${r.correctCount}</td><td>${r.wrongCount}</td></tr>`;
  });
  html += '</tbody></table></div>';
  if (filtered.length > 100) html += `<p class="form-hint">Menampilkan 100 dari ${filtered.length} hasil.</p>`;
  container.innerHTML = html;
}

// ==========================================
// DELETE HANDLER
// ==========================================
function bindDeleteButtons(container) {
  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const col = btn.dataset.col;
      const id = btn.dataset.id;
      const warnings = {
        users: "Yakin ingin menghapus akun ini?",
        schools: "Yakin ingin menghapus sekolah ini? Guru/murid yang terdaftar tidak ikut terhapus.",
        teacher_questions: "Yakin ingin menghapus soal ini? Soal dalam paket ujian bisa terdampak.",
        exam_packages: "Yakin ingin menghapus paket ini? Data hasil murid tidak ikut terhapus."
      };
      if (!confirm(warnings[col] || "Yakin ingin menghapus?")) return;
      showLoading(true);
      try {
        await deleteDoc(doc(db, col, id));
        await loadAllData();
      } catch (e) { console.error("Delete error:", e); alert("Gagal menghapus."); }
      finally { showLoading(false); }
    });
  });
}

// ==========================================
// FILTER EVENT BINDINGS
// ==========================================
function bindFilterEvents() {
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("input", fn); if (el) el.addEventListener("change", fn); };
  bind("admin-guru-search", renderGuru);
  bind("admin-murid-search", renderMurid);
  bind("admin-school-search", renderSchools);
  bind("admin-soal-jenjang", renderSoal);
  bind("admin-soal-search", renderSoal);
  bind("admin-paket-status", renderPaket);
  bind("admin-paket-search", renderPaket);
  bind("admin-result-search", renderResults);
  bind("admin-result-score", renderResults);
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function showLoginError(msg) {
  const el = document.getElementById("admin-login-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
