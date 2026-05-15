// murid.js — Mengelola fitur dashboard murid: profil, cari ujian, riwayat, dan rekap nilai

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let currentUserData = null;
let schoolsList = [];
let examPackages = [];
let examHistory = [];
let pendingExamPackage = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    currentUser = user;
    await checkStudentProfile(user.uid);
  });

  // Profile form events
  const numberTypeEl = document.getElementById("student-number-type");
  if (numberTypeEl) numberTypeEl.addEventListener("change", updateNumberPlaceholder);
  const nameEl = document.getElementById("student-name");
  const numberEl = document.getElementById("student-number");
  const schoolEl = document.getElementById("student-school");
  [nameEl, numberTypeEl, numberEl, schoolEl].forEach((el) => {
    if (el) el.addEventListener("input", updateProfilePreview);
    if (el) el.addEventListener("change", updateProfilePreview);
  });
  const btnSave = document.getElementById("btn-save-profile");
  if (btnSave) btnSave.addEventListener("click", handleSaveProfile);

  // Exam filter events
  const filterJenjang = document.getElementById("exam-filter-jenjang");
  const filterKelas = document.getElementById("exam-filter-kelas");
  const filterMapel = document.getElementById("exam-filter-mapel");
  if (filterJenjang) filterJenjang.addEventListener("change", () => { updateExamFilterKelas(); renderExamList(); });
  if (filterKelas) filterKelas.addEventListener("change", renderExamList);
  if (filterMapel) filterMapel.addEventListener("input", renderExamList);

  // Access code modal
  const btnSubmitCode = document.getElementById("btn-submit-code");
  if (btnSubmitCode) btnSubmitCode.addEventListener("click", handleSubmitAccessCode);
  const btnCancelCode = document.getElementById("btn-cancel-code");
  if (btnCancelCode) btnCancelCode.addEventListener("click", hideAccessCodeModal);

  // History filter events
  const hFilterMapel = document.getElementById("history-filter-mapel");
  const hFilterJenjang = document.getElementById("history-filter-jenjang");
  const hFilterScore = document.getElementById("history-filter-score");
  if (hFilterMapel) hFilterMapel.addEventListener("input", renderHistoryList);
  if (hFilterJenjang) hFilterJenjang.addEventListener("change", renderHistoryList);
  if (hFilterScore) hFilterScore.addEventListener("change", renderHistoryList);

  // Profile edit events
  const btnEditProfile = document.getElementById("btn-edit-profile");
  if (btnEditProfile) btnEditProfile.addEventListener("click", showEditProfileMode);
  const btnSaveEdit = document.getElementById("btn-save-edit-profile");
  if (btnSaveEdit) btnSaveEdit.addEventListener("click", handleSaveEditProfile);
  const btnCancelEdit = document.getElementById("btn-cancel-edit-profile");
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", hideEditProfileMode);
});

// ==========================================
// CHECK STUDENT PROFILE
// ==========================================
async function checkStudentProfile(uid) {
  showLoading(true);
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showLoading(false); return; }
    currentUserData = userSnap.data();
    if (currentUserData.studentName && currentUserData.studentUniqueNumber && currentUserData.studentNumberType && currentUserData.schoolId) {
      showDashboard();
      await Promise.all([loadPublishedExams(), loadExamHistory()]);
    } else {
      await loadSchoolsDropdown();
      showProfileForm();
    }
  } catch (error) {
    console.error("Gagal memeriksa profil murid:", error);
    showFormError("Gagal memuat data profil. Silakan muat ulang halaman.");
  } finally {
    showLoading(false);
  }
}

// ==========================================
// LOAD SCHOOLS DROPDOWN
// ==========================================
async function loadSchoolsDropdown() {
  const schoolSelect = document.getElementById("student-school");
  if (!schoolSelect) return;
  try {
    const schoolsQuery = query(collection(db, "schools"), orderBy("displayName", "asc"));
    const schoolsSnap = await getDocs(schoolsQuery);
    schoolsList = [];
    schoolsSnap.forEach((docSnap) => { schoolsList.push({ id: docSnap.id, ...docSnap.data() }); });
    schoolSelect.innerHTML = "";
    if (schoolsList.length === 0) {
      schoolSelect.innerHTML = '<option value="">— Tidak ada sekolah —</option>';
      const hintEl = document.getElementById("school-hint");
      if (hintEl) hintEl.style.display = "block";
    } else {
      schoolSelect.innerHTML = '<option value="">— Pilih Sekolah —</option>';
      schoolsList.forEach((school) => {
        const option = document.createElement("option");
        option.value = school.id;
        option.textContent = school.displayName;
        option.dataset.slug = school.slug;
        option.dataset.displayName = school.displayName;
        schoolSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Gagal memuat daftar sekolah:", error);
    schoolSelect.innerHTML = '<option value="">— Gagal memuat sekolah —</option>';
  }
}

// ==========================================
// HANDLE SAVE PROFILE (initial)
// ==========================================
async function handleSaveProfile() {
  const studentName = document.getElementById("student-name").value.trim();
  const studentNumberType = document.getElementById("student-number-type").value;
  const studentNumber = document.getElementById("student-number").value.trim();
  const schoolSelect = document.getElementById("student-school");
  const selectedSchoolId = schoolSelect.value;
  hideErrors();
  if (!studentName) { showFormError("Nama lengkap tidak boleh kosong."); return; }
  if (!studentNumberType) { showFormError("Pilih jenis nomor identitas."); return; }
  if (!studentNumber) { showFormError("Nomor identitas tidak boleh kosong."); return; }
  if (!selectedSchoolId) { showFormError("Pilih sekolah kamu."); return; }
  const selectedOption = schoolSelect.options[schoolSelect.selectedIndex];
  const schoolSlug = selectedOption.dataset.slug || "";
  const schoolName = selectedOption.dataset.displayName || selectedOption.textContent;
  showLoading(true);
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { studentName, studentUniqueNumber: studentNumber, studentNumberType, schoolId: selectedSchoolId, schoolSlug, schoolName });
    currentUserData = { ...currentUserData, studentName, studentUniqueNumber: studentNumber, studentNumberType, schoolId: selectedSchoolId, schoolSlug, schoolName };
    showDashboard();
    showSuccess("Profil berhasil disimpan!");
    await Promise.all([loadPublishedExams(), loadExamHistory()]);
  } catch (error) {
    console.error("Gagal menyimpan profil:", error);
    showFormError("Gagal menyimpan profil. Silakan coba lagi.");
  } finally { showLoading(false); }
}

// ==========================================
// LOAD PUBLISHED EXAMS
// ==========================================
async function loadPublishedExams() {
  try {
    const q = query(collection(db, "exam_packages"), where("isPublished", "==", true), where("schoolId", "==", currentUserData.schoolId));
    const snap = await getDocs(q);
    examPackages = [];
    snap.forEach((docSnap) => { examPackages.push({ id: docSnap.id, ...docSnap.data() }); });
    renderExamList();
  } catch (error) {
    console.error("Gagal memuat ujian:", error);
    const container = document.getElementById("exam-list-container");
    if (container) container.innerHTML = '<p class="text-center" style="color:#c53030;padding:1rem;">Gagal memuat ujian.</p>';
  }
}

// ==========================================
// RENDER EXAM LIST
// ==========================================
function renderExamList() {
  const container = document.getElementById("exam-list-container");
  if (!container) return;
  const fj = (document.getElementById("exam-filter-jenjang") || {}).value || "";
  const fk = (document.getElementById("exam-filter-kelas") || {}).value || "";
  const fm = (document.getElementById("exam-filter-mapel") || {}).value.trim().toLowerCase() || "";
  let filtered = examPackages;
  if (fj) filtered = filtered.filter(p => p.jenjang === fj);
  if (fk) filtered = filtered.filter(p => p.kelas === fk);
  if (fm) filtered = filtered.filter(p => p.mapel.toLowerCase().includes(fm));
  const totalEl = document.getElementById("exam-total");
  if (totalEl) totalEl.textContent = `Total: ${filtered.length} ujian tersedia`;
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Belum ada ujian yang tersedia dari sekolahmu.</p>';
    return;
  }
  let html = "";
  filtered.forEach((pkg) => {
    const codeBadge = pkg.accessCode ? '<span class="badge badge-code">Perlu Kode Akses</span>' : '';
    html += `<div class="exam-card"><div class="exam-card-header"><h3>${pkg.title}</h3>${codeBadge}</div><div class="exam-card-meta"><span>👨‍🏫 ${pkg.teacherUsername}</span><span>${pkg.mapel} — ${pkg.kelas} — ${pkg.jenjang}</span><span>📝 ${pkg.totalQuestions} soal</span></div><button class="btn btn-primary btn-take-exam" data-id="${pkg.id}">Kerjakan Ujian</button></div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll(".btn-take-exam").forEach(btn => {
    btn.addEventListener("click", () => handleTakeExam(btn.dataset.id));
  });
}

// ==========================================
// TAKE EXAM + ACCESS CODE
// ==========================================
function handleTakeExam(packageId) {
  const pkg = examPackages.find(p => p.id === packageId);
  if (!pkg) return;
  if (pkg.accessCode) { pendingExamPackage = pkg; showAccessCodeModal(); }
  else { proceedToExam(pkg); }
}

function showAccessCodeModal() {
  const modal = document.getElementById("access-code-modal");
  const input = document.getElementById("access-code-input");
  const error = document.getElementById("access-code-error");
  if (modal) modal.style.display = "flex";
  if (input) input.value = "";
  if (error) error.style.display = "none";
}

function hideAccessCodeModal() {
  const modal = document.getElementById("access-code-modal");
  if (modal) modal.style.display = "none";
  pendingExamPackage = null;
}

function handleSubmitAccessCode() {
  const input = document.getElementById("access-code-input");
  const error = document.getElementById("access-code-error");
  if (!input || !pendingExamPackage) return;
  if (input.value.trim() === pendingExamPackage.accessCode) {
    hideAccessCodeModal();
    proceedToExam(pendingExamPackage);
  } else {
    if (error) { error.textContent = "Kode akses salah. Coba lagi."; error.style.display = "block"; }
  }
}

function proceedToExam(pkg) {
  localStorage.setItem("currentExamId", pkg.id);
  localStorage.setItem("currentExamTitle", pkg.title);
  localStorage.setItem("currentExamSchoolId", pkg.schoolId);
  window.location.href = "ujian.html";
}

function updateExamFilterKelas() {
  const jenjang = (document.getElementById("exam-filter-jenjang") || {}).value || "";
  const el = document.getElementById("exam-filter-kelas");
  if (!el) return;
  let html = '<option value="">Semua Kelas</option>';
  const opts = jenjang === "SMP" ? ["Kelas 7","Kelas 8","Kelas 9"] : (jenjang === "SMA" || jenjang === "SMK") ? ["Kelas 10","Kelas 11","Kelas 12"] : [];
  opts.forEach(k => { html += `<option value="${k}">${k}</option>`; });
  el.innerHTML = html;
}


// ==========================================
// LOAD EXAM HISTORY
// ==========================================
async function loadExamHistory() {
  try {
    const q = query(collection(db, "exam_results"), where("studentId", "==", currentUser.uid), orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    examHistory = [];
    snap.forEach((docSnap) => { examHistory.push({ id: docSnap.id, ...docSnap.data() }); });
    renderHistoryList();
    renderRecap();
    updateRingkasan();
  } catch (error) {
    console.error("Gagal memuat riwayat:", error);
    const container = document.getElementById("history-list-container");
    if (container) container.innerHTML = '<p class="text-center" style="color:#c53030;padding:1rem;">Gagal memuat riwayat.</p>';
  }
}

// ==========================================
// RENDER HISTORY LIST
// ==========================================
function renderHistoryList() {
  const container = document.getElementById("history-list-container");
  if (!container) return;
  const fm = (document.getElementById("history-filter-mapel") || {}).value.trim().toLowerCase();
  const fj = (document.getElementById("history-filter-jenjang") || {}).value;
  const fs = (document.getElementById("history-filter-score") || {}).value;

  let filtered = examHistory;
  if (fm) filtered = filtered.filter(r => r.mapel.toLowerCase().includes(fm));
  if (fj) filtered = filtered.filter(r => r.jenjang === fj);
  if (fs === "high") filtered = filtered.filter(r => r.score >= 75);
  else if (fs === "mid") filtered = filtered.filter(r => r.score >= 60 && r.score < 75);
  else if (fs === "low") filtered = filtered.filter(r => r.score < 60);

  const totalEl = document.getElementById("history-total");
  if (totalEl) totalEl.textContent = `Total: ${filtered.length} riwayat`;

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Kamu belum mengerjakan ujian apapun.</p>';
    return;
  }

  let html = "";
  filtered.forEach((r) => {
    const scoreClass = r.score >= 75 ? "score-high" : r.score >= 60 ? "score-mid" : "score-low";
    const mins = Math.floor((r.durationSeconds || 0) / 60).toString().padStart(2, "0");
    const secs = ((r.durationSeconds || 0) % 60).toString().padStart(2, "0");
    let dateStr = "—";
    if (r.submittedAt && r.submittedAt.toDate) {
      const d = r.submittedAt.toDate();
      dateStr = `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
    }
    html += `
      <div class="history-item">
        <div class="history-item-header">
          <strong>${r.examTitle}</strong>
          <span class="history-score ${scoreClass}">${r.score}</span>
        </div>
        <div class="history-meta">
          <span>${r.mapel} — ${r.kelas} — ${r.jenjang}</span>
          <span>👨‍🏫 ${r.teacherUsername}</span>
        </div>
        <div class="history-meta">
          <span>Benar: ${r.correctCount} | Salah: ${r.wrongCount}</span>
          <span>Durasi: ${mins}:${secs}</span>
          <span>${dateStr}</span>
        </div>
        <button class="btn btn-outline btn-sm-history" data-id="${r.id}">Lihat Detail</button>
      </div>
    `;
  });
  container.innerHTML = html;
  container.querySelectorAll(".btn-sm-history").forEach(btn => {
    btn.addEventListener("click", () => {
      localStorage.setItem("examResultId", btn.dataset.id);
      window.location.href = "hasil.html";
    });
  });
}

// ==========================================
// RENDER RECAP
// ==========================================
function renderRecap() {
  const container = document.getElementById("recap-content");
  if (!container) return;

  if (examHistory.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Belum ada data. Kerjakan ujian pertamamu!</p>';
    return;
  }

  const totalExams = examHistory.length;
  const totalScore = examHistory.reduce((s, r) => s + r.score, 0);
  const avgScore = (totalScore / totalExams).toFixed(1);
  const maxScore = Math.max(...examHistory.map(r => r.score));
  const minScore = Math.min(...examHistory.map(r => r.score));
  const totalSoal = examHistory.reduce((s, r) => s + (r.totalQuestions || 0), 0);
  const totalBenar = examHistory.reduce((s, r) => s + (r.correctCount || 0), 0);
  const totalSalah = examHistory.reduce((s, r) => s + (r.wrongCount || 0), 0);
  const accuracy = totalSoal > 0 ? ((totalBenar / totalSoal) * 100).toFixed(1) : "0";

  // Group by mapel
  const mapelMap = {};
  examHistory.forEach(r => {
    if (!mapelMap[r.mapel]) mapelMap[r.mapel] = { scores: [], count: 0 };
    mapelMap[r.mapel].scores.push(r.score);
    mapelMap[r.mapel].count++;
  });

  const mapelStats = Object.entries(mapelMap).map(([mapel, data]) => {
    const avg = (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1);
    const max = Math.max(...data.scores);
    const min = Math.min(...data.scores);
    return { mapel, avg: parseFloat(avg), max, min, count: data.count };
  }).sort((a, b) => b.avg - a.avg);

  const best = mapelStats[0];
  const worst = mapelStats[mapelStats.length - 1];

  let html = `
    <div class="stat-grid recap-stats">
      <div class="stat-card"><span class="stat-value">${totalExams}</span><span class="stat-label">Total Ujian</span></div>
      <div class="stat-card"><span class="stat-value">${avgScore}</span><span class="stat-label">Rata-rata Nilai</span></div>
      <div class="stat-card"><span class="stat-value score-high">${maxScore}</span><span class="stat-label">Nilai Tertinggi</span></div>
      <div class="stat-card"><span class="stat-value score-low">${minScore}</span><span class="stat-label">Nilai Terendah</span></div>
      <div class="stat-card"><span class="stat-value">${best.mapel}</span><span class="stat-label">Mapel Terbaik (${best.avg})</span></div>
      <div class="stat-card"><span class="stat-value">${worst.mapel}</span><span class="stat-label">Perlu Ditingkatkan (${worst.avg})</span></div>
      <div class="stat-card"><span class="stat-value">${accuracy}%</span><span class="stat-label">Akurasi Keseluruhan</span></div>
    </div>
    <h3 class="mt-3 mb-2" style="font-size:1rem;color:var(--primary);">Performa per Mata Pelajaran</h3>
    <div class="recap-table-wrapper">
      <table class="recap-table">
        <thead><tr><th>Mapel</th><th>Jumlah Ujian</th><th>Rata-rata</th><th>Tertinggi</th><th>Terendah</th></tr></thead>
        <tbody>
  `;
  mapelStats.forEach(ms => {
    html += `<tr><td>${ms.mapel}</td><td>${ms.count}</td><td>${ms.avg}</td><td>${ms.max}</td><td>${ms.min}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ==========================================
// UPDATE RINGKASAN (Quick Stats)
// ==========================================
function updateRingkasan() {
  const totalEl = document.getElementById("ringkasan-total");
  const avgEl = document.getElementById("ringkasan-avg");
  const highEl = document.getElementById("ringkasan-high");
  const latestEl = document.getElementById("ringkasan-latest");
  const latestLabel = document.getElementById("ringkasan-latest-label");

  if (examHistory.length === 0) {
    if (totalEl) totalEl.textContent = "0";
    if (avgEl) avgEl.textContent = "—";
    if (highEl) highEl.textContent = "—";
    if (latestEl) latestEl.textContent = "—";
    return;
  }

  const totalExams = examHistory.length;
  const avgScore = (examHistory.reduce((s, r) => s + r.score, 0) / totalExams).toFixed(1);
  const maxScore = Math.max(...examHistory.map(r => r.score));
  const latest = examHistory[0];

  if (totalEl) totalEl.textContent = totalExams;
  if (avgEl) avgEl.textContent = avgScore;
  if (highEl) highEl.textContent = maxScore;
  if (latestEl) latestEl.textContent = latest.score;
  if (latestLabel) latestLabel.textContent = `Terbaru: ${latest.examTitle}`;
}

// ==========================================
// PROFILE VIEW / EDIT
// ==========================================
function populateProfileView() {
  const typeLabels = { nomor_absen: "Nomor Absen", nis: "NIS", nisn: "NISN", lainnya: "Lainnya" };
  setTextById("pv-name", currentUserData.studentName);
  setTextById("pv-number", `${currentUserData.studentUniqueNumber} (${typeLabels[currentUserData.studentNumberType] || ""})`);
  setTextById("pv-school", currentUserData.schoolName);
  setTextById("pv-email", currentUserData.email || currentUser.email);
  if (currentUserData.createdAt && currentUserData.createdAt.toDate) {
    const d = currentUserData.createdAt.toDate();
    setTextById("pv-joined", `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`);
  } else {
    setTextById("pv-joined", "—");
  }
}

function showEditProfileMode() {
  document.getElementById("profile-view-mode").style.display = "none";
  document.getElementById("profile-edit-mode").style.display = "block";
  document.getElementById("edit-name").value = currentUserData.studentName || "";
  document.getElementById("edit-number-type").value = currentUserData.studentNumberType || "nomor_absen";
  document.getElementById("edit-number").value = currentUserData.studentUniqueNumber || "";
  document.getElementById("edit-school").value = currentUserData.schoolName || "";
}

function hideEditProfileMode() {
  document.getElementById("profile-view-mode").style.display = "block";
  document.getElementById("profile-edit-mode").style.display = "none";
  const errEl = document.getElementById("edit-profile-error");
  if (errEl) errEl.style.display = "none";
}

async function handleSaveEditProfile() {
  const name = document.getElementById("edit-name").value.trim();
  const numberType = document.getElementById("edit-number-type").value;
  const number = document.getElementById("edit-number").value.trim();
  const errEl = document.getElementById("edit-profile-error");
  if (errEl) errEl.style.display = "none";
  if (!name) { if (errEl) { errEl.textContent = "Nama tidak boleh kosong."; errEl.style.display = "block"; } return; }
  if (!number) { if (errEl) { errEl.textContent = "Nomor identitas tidak boleh kosong."; errEl.style.display = "block"; } return; }
  showLoading(true);
  try {
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { studentName: name, studentNumberType: numberType, studentUniqueNumber: number });
    currentUserData.studentName = name;
    currentUserData.studentNumberType = numberType;
    currentUserData.studentUniqueNumber = number;
    hideEditProfileMode();
    populateProfileView();
    showSuccess("Profil berhasil diperbarui!");
  } catch (error) {
    console.error("Gagal update profil:", error);
    if (errEl) { errEl.textContent = "Gagal menyimpan. Coba lagi."; errEl.style.display = "block"; }
  } finally { showLoading(false); }
}

// ==========================================
// HELPER: Number Placeholder
// ==========================================
function updateNumberPlaceholder() {
  const numberTypeEl = document.getElementById("student-number-type");
  const numberEl = document.getElementById("student-number");
  if (!numberTypeEl || !numberEl) return;
  const placeholders = { nomor_absen: "Contoh: 12", nis: "Contoh: 20240123", nisn: "Contoh: 0012345678", lainnya: "Masukkan nomor identitasmu" };
  numberEl.placeholder = placeholders[numberTypeEl.value] || "Masukkan nomor identitasmu";
}

// ==========================================
// HELPER: Profile Preview (initial form)
// ==========================================
function updateProfilePreview() {
  const name = document.getElementById("student-name").value.trim() || "—";
  const numberType = document.getElementById("student-number-type").value;
  const number = document.getElementById("student-number").value.trim() || "—";
  const schoolSelect = document.getElementById("student-school");
  const typeLabels = { nomor_absen: "Nomor Absen", nis: "NIS", nisn: "NISN", lainnya: "Lainnya" };
  const typeLabel = typeLabels[numberType] || "—";
  let schoolName = "—";
  if (schoolSelect && schoolSelect.value) {
    schoolName = schoolSelect.options[schoolSelect.selectedIndex].dataset.displayName || schoolSelect.options[schoolSelect.selectedIndex].textContent;
  }
  setTextById("preview-name", name);
  setTextById("preview-number", number !== "—" ? `${number} (${typeLabel})` : "—");
  setTextById("preview-school", schoolName);
}

// ==========================================
// UI HELPERS
// ==========================================
function showProfileForm() {
  const f = document.getElementById("profile-form-section");
  const d = document.getElementById("dashboard-content");
  if (f) f.style.display = "block";
  if (d) d.style.display = "none";
}

function showDashboard() {
  const f = document.getElementById("profile-form-section");
  const d = document.getElementById("dashboard-content");
  if (f) f.style.display = "none";
  if (d) d.style.display = "block";
  if (currentUserData) {
    const welcomeEl = document.getElementById("welcome-message");
    if (welcomeEl) welcomeEl.textContent = `Selamat datang, ${currentUserData.studentName}! Cari ujian, kerjakan soal, dan pantau perkembangan nilaimu.`;
    populateProfileView();
  }
}

function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function showFormError(message) {
  const el = document.getElementById("form-error");
  if (el) { el.textContent = message; el.style.display = "block"; }
}

function hideErrors() {
  const el = document.getElementById("form-error");
  if (el) el.style.display = "none";
}

function showSuccess(msg) {
  const el = document.getElementById("success-message");
  if (el) { el.textContent = msg; el.style.display = "block"; setTimeout(() => { el.style.display = "none"; }, 5000); }
}

function setTextById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "—";
}
