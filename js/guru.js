// guru.js — Mengelola fitur dashboard guru: profil, CRUD soal, paket ujian, dan hasil murid

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let currentUserData = null;
let questionsList = [];
let packagesList = [];
let editingQuestionId = null;
let editingPackageId = null;
let selectedQuestionIds = new Set();

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    currentUser = user;
    await checkTeacherProfile(user.uid);
  });

  // === PROFILE FORM EVENTS ===
  const levelEl = document.getElementById("school-level");
  const statusEl = document.getElementById("school-status");
  const nameEl = document.getElementById("school-name-number");
  const cityEl = document.getElementById("school-city");
  [levelEl, statusEl, nameEl, cityEl].forEach((el) => {
    if (el) el.addEventListener("input", updateSchoolPreview);
  });
  if (cityEl) cityEl.addEventListener("input", () => { cityEl.value = cityEl.value.toUpperCase(); });
  if (nameEl) nameEl.addEventListener("input", () => { nameEl.value = nameEl.value.toUpperCase(); });
  const usernameEl = document.getElementById("teacher-username");
  if (usernameEl) {
    usernameEl.addEventListener("input", () => {
      usernameEl.value = usernameEl.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    });
  }
  const btnSave = document.getElementById("btn-save-profile");
  if (btnSave) btnSave.addEventListener("click", handleSaveProfile);

  // === QUESTION FORM EVENTS ===
  const qJenjang = document.getElementById("q-jenjang");
  if (qJenjang) qJenjang.addEventListener("change", updateKelasOptions);
  const btnSaveSoal = document.getElementById("btn-save-soal");
  if (btnSaveSoal) btnSaveSoal.addEventListener("click", handleSaveQuestion);
  const btnCancelSoal = document.getElementById("btn-cancel-soal");
  if (btnCancelSoal) btnCancelSoal.addEventListener("click", resetQuestionForm);

  // === QUESTION FILTER EVENTS ===
  const filterJenjang = document.getElementById("filter-jenjang");
  const filterKelas = document.getElementById("filter-kelas");
  const filterMapel = document.getElementById("filter-mapel");
  if (filterJenjang) filterJenjang.addEventListener("change", () => { updateFilterKelas(); renderQuestionList(); });
  if (filterKelas) filterKelas.addEventListener("change", renderQuestionList);
  if (filterMapel) filterMapel.addEventListener("input", renderQuestionList);

  // === PACKAGE FORM EVENTS ===
  const pJenjang = document.getElementById("p-jenjang");
  if (pJenjang) pJenjang.addEventListener("change", () => { updatePaketKelasOptions(); updatePaketMapelOptions(); });
  const btnSavePaket = document.getElementById("btn-save-paket");
  if (btnSavePaket) btnSavePaket.addEventListener("click", handleSavePackage);
  const btnCancelPaket = document.getElementById("btn-cancel-paket");
  if (btnCancelPaket) btnCancelPaket.addEventListener("click", resetPackageForm);

  // === PACKAGE QUESTION FILTER EVENTS ===
  const pFilterJenjang = document.getElementById("p-filter-jenjang");
  const pFilterKelas = document.getElementById("p-filter-kelas");
  const pFilterMapel = document.getElementById("p-filter-mapel");
  if (pFilterJenjang) pFilterJenjang.addEventListener("change", () => { updatePaketFilterKelas(); renderQuestionSelectList(); });
  if (pFilterKelas) pFilterKelas.addEventListener("change", renderQuestionSelectList);
  if (pFilterMapel) pFilterMapel.addEventListener("input", renderQuestionSelectList);
});


// ==========================================
// CHECK TEACHER PROFILE
// ==========================================
async function checkTeacherProfile(uid) {
  showLoading(true);
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) { showLoading(false); return; }
    currentUserData = userSnap.data();
    if (currentUserData.teacherUsername && currentUserData.schoolId) {
      showDashboard();
      await loadQuestions();
      await loadPackages();
      await loadTeacherResults();
    } else {
      showProfileForm();
    }
  } catch (error) {
    console.error("Gagal memeriksa profil guru:", error);
    showFormError("Gagal memuat data profil. Silakan muat ulang halaman.");
  } finally {
    showLoading(false);
  }
}

// ==========================================
// HANDLE SAVE PROFILE
// ==========================================
async function handleSaveProfile() {
  const username = document.getElementById("teacher-username").value.trim();
  const level = document.getElementById("school-level").value;
  const status = document.getElementById("school-status").value;
  const nameNumber = document.getElementById("school-name-number").value.trim().toUpperCase();
  const city = document.getElementById("school-city").value.trim().toUpperCase();
  hideErrors();
  if (!username) { showUsernameError("Username tidak boleh kosong."); return; }
  if (username.length < 3) { showUsernameError("Username minimal 3 karakter."); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showUsernameError("Username hanya boleh huruf kecil, angka, dan underscore (_)."); return; }
  if (!level) { showFormError("Pilih jenjang sekolah."); return; }
  if (!status) { showFormError("Pilih status sekolah."); return; }
  if (!nameNumber) { showFormError("Isi nama atau nomor sekolah."); return; }
  if (!city) { showFormError("Isi kota sekolah."); return; }
  showLoading(true);
  try {
    // Check username uniqueness via teacher_usernames/{username}
    const usernameRef = doc(db, "teacher_usernames", username);
    const usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists() && usernameSnap.data().uid !== currentUser.uid) {
      showLoading(false);
      showUsernameError("Username sudah digunakan. Pilih username lain.");
      return;
    }

    // Generate school data
    const displayName = `${level} ${status} ${nameNumber} ${city}`;
    const slug = displayName.toLowerCase().replace(/\s+/g, "-");

    // Save school using slug as document ID
    const schoolRef = doc(db, "schools", slug);
    const schoolSnap = await getDoc(schoolRef);
    if (!schoolSnap.exists()) {
      await setDoc(schoolRef, {
        level,
        status,
        nameNumber,
        city,
        displayName,
        slug,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Reserve username in teacher_usernames collection
    if (!usernameSnap.exists()) {
      await setDoc(usernameRef, {
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });
    }

    // Update user document
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
      teacherUsername: username,
      schoolId: slug,
      schoolSlug: slug,
      schoolName: displayName,
      updatedAt: serverTimestamp()
    });

    currentUserData = { ...currentUserData, teacherUsername: username, schoolId: slug, schoolSlug: slug, schoolName: displayName };
    showDashboard();
    showSuccess("Profil berhasil disimpan!");
    await loadQuestions();
    await loadPackages();
    await loadTeacherResults();
  } catch (error) {
    console.error("Gagal menyimpan profil guru:", error.code, error.message, error);
    showFormError("Gagal menyimpan profil: " + (error.code || error.message));
  } finally { showLoading(false); }
}


// ==========================================
// QUESTION MANAGEMENT — LOAD
// ==========================================
async function loadQuestions() {
  try {
    // Simple query without orderBy to avoid composite index requirement
    const q = query(collection(db, "teacher_questions"), where("teacherId", "==", currentUser.uid));
    const snap = await getDocs(q);
    questionsList = [];
    snap.forEach((docSnap) => { questionsList.push({ id: docSnap.id, ...docSnap.data() }); });
    // Sort client-side by createdAt descending
    questionsList.sort((a, b) => {
      const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    const totalEl = document.getElementById("total-soal-count");
    if (totalEl) totalEl.textContent = questionsList.length;
    renderQuestionList();
    renderQuestionSelectList();
  } catch (error) {
    console.error("Gagal memuat soal:", error.code, error.message, error);
    const container = document.getElementById("soal-list-container");
    if (container) container.innerHTML = '<p class="text-center" style="color:#c53030;padding:1rem;">Gagal memuat soal: ' + (error.code || error.message) + '</p>';
  }
}

// ==========================================
// QUESTION MANAGEMENT — RENDER LIST
// ==========================================
function renderQuestionList() {
  const container = document.getElementById("soal-list-container");
  if (!container) return;
  const fj = document.getElementById("filter-jenjang").value;
  const fk = document.getElementById("filter-kelas").value;
  const fm = document.getElementById("filter-mapel").value.trim().toLowerCase();
  let filtered = questionsList;
  if (fj) filtered = filtered.filter(q => q.jenjang === fj);
  if (fk) filtered = filtered.filter(q => q.kelas === fk);
  if (fm) filtered = filtered.filter(q => q.mapel.toLowerCase().includes(fm));
  const totalEl = document.getElementById("soal-total");
  if (totalEl) totalEl.textContent = `Total: ${filtered.length} soal`;
  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Belum ada soal. Tambahkan soal pertamamu!</p>';
    return;
  }
  let html = "";
  filtered.forEach((q, i) => {
    const preview = q.questionText.length > 80 ? q.questionText.substring(0, 80) + "..." : q.questionText;
    html += `<div class="soal-item"><div class="soal-item-header"><span class="soal-number">#${i+1}</span><span class="soal-meta">${q.mapel} — ${q.kelas} — ${q.jenjang}</span></div><p class="soal-preview">${preview}</p><div class="soal-item-actions"><button class="btn-sm btn-edit" data-id="${q.id}">Edit</button><button class="btn-sm btn-delete" data-id="${q.id}">Hapus</button></div></div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll(".btn-edit").forEach(btn => { btn.addEventListener("click", () => handleEditQuestion(btn.dataset.id)); });
  container.querySelectorAll(".btn-delete").forEach(btn => { btn.addEventListener("click", () => handleDeleteQuestion(btn.dataset.id)); });
}

// ==========================================
// QUESTION MANAGEMENT — SAVE
// ==========================================
async function handleSaveQuestion() {
  const jenjang = document.getElementById("q-jenjang").value;
  const kelas = document.getElementById("q-kelas").value;
  const mapel = document.getElementById("q-mapel").value;
  const questionText = document.getElementById("q-text").value.trim();
  const optA = document.getElementById("q-option-a").value.trim();
  const optB = document.getElementById("q-option-b").value.trim();
  const optC = document.getElementById("q-option-c").value.trim();
  const optD = document.getElementById("q-option-d").value.trim();
  const correctAnswer = document.getElementById("q-answer").value;
  const explanation = document.getElementById("q-explanation").value.trim();
  const errEl = document.getElementById("soal-form-error");
  if (errEl) errEl.style.display = "none";
  if (!jenjang) { showSoalError("Pilih jenjang."); return; }
  if (!kelas) { showSoalError("Pilih kelas."); return; }
  if (!mapel) { showSoalError("Pilih mata pelajaran."); return; }
  if (!questionText) { showSoalError("Isi teks soal."); return; }
  if (!optA || !optB || !optC || !optD) { showSoalError("Lengkapi semua pilihan jawaban."); return; }
  if (!correctAnswer) { showSoalError("Pilih jawaban benar."); return; }
  showLoading(true);
  try {
    const questionData = {
      teacherId: currentUser.uid,
      teacherUsername: currentUserData.teacherUsername,
      schoolId: currentUserData.schoolId,
      schoolSlug: currentUserData.schoolSlug,
      schoolName: currentUserData.schoolName,
      jenjang,
      kelas,
      mapel,
      questionText,
      options: { A: optA, B: optB, C: optC, D: optD },
      correctAnswer,
      explanation,
      updatedAt: serverTimestamp()
    };
    console.log("Saving question payload:", questionData);
    const editId = document.getElementById("edit-question-id").value;
    if (editId) {
      const qRef = doc(db, "teacher_questions", editId);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists() || qSnap.data().teacherId !== currentUser.uid) { showSoalError("Tidak ada izin."); showLoading(false); return; }
      await updateDoc(qRef, questionData);
      showSuccess("Soal berhasil diupdate!");
    } else {
      questionData.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, "teacher_questions"), questionData);
      console.log("Question saved with ID:", docRef.id);
      showSuccess("Soal berhasil disimpan.");
    }
    resetQuestionForm();
    await loadQuestions();
  } catch (error) {
    console.error("Gagal menyimpan soal:", error.code, error.message, error);
    showSoalError("Gagal menyimpan soal: " + (error.code || error.message));
  } finally { showLoading(false); }
}

// ==========================================
// QUESTION MANAGEMENT — EDIT
// ==========================================
function handleEditQuestion(questionId) {
  const question = questionsList.find(q => q.id === questionId);
  if (!question || question.teacherId !== currentUser.uid) return;
  editingQuestionId = questionId;
  document.getElementById("edit-question-id").value = questionId;
  document.getElementById("q-jenjang").value = question.jenjang;
  updateKelasOptions();
  document.getElementById("q-kelas").value = question.kelas;
  document.getElementById("q-mapel").value = question.mapel;
  document.getElementById("q-text").value = question.questionText;
  document.getElementById("q-option-a").value = question.options.A;
  document.getElementById("q-option-b").value = question.options.B;
  document.getElementById("q-option-c").value = question.options.C;
  document.getElementById("q-option-d").value = question.options.D;
  document.getElementById("q-answer").value = question.correctAnswer;
  document.getElementById("q-explanation").value = question.explanation || "";
  document.getElementById("soal-form-title").textContent = "✏️ Edit Soal";
  document.getElementById("btn-save-soal").textContent = "Update Soal";
  document.getElementById("soal-form-title").scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// QUESTION MANAGEMENT — DELETE
// ==========================================
async function handleDeleteQuestion(questionId) {
  const question = questionsList.find(q => q.id === questionId);
  if (!question || question.teacherId !== currentUser.uid) return;
  if (!confirm("Yakin ingin menghapus soal ini?")) return;
  showLoading(true);
  try {
    await deleteDoc(doc(db, "teacher_questions", questionId));
    showSuccess("Soal berhasil dihapus!");
    await loadQuestions();
  } catch (error) { console.error("Gagal menghapus soal:", error); alert("Gagal menghapus soal."); }
  finally { showLoading(false); }
}

// ==========================================
// QUESTION FORM — RESET
// ==========================================
function resetQuestionForm() {
  editingQuestionId = null;
  document.getElementById("edit-question-id").value = "";
  document.getElementById("q-jenjang").value = "";
  document.getElementById("q-kelas").innerHTML = '<option value="">— Pilih Kelas —</option>';
  document.getElementById("q-mapel").innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
  document.getElementById("q-text").value = "";
  document.getElementById("q-option-a").value = "";
  document.getElementById("q-option-b").value = "";
  document.getElementById("q-option-c").value = "";
  document.getElementById("q-option-d").value = "";
  document.getElementById("q-answer").value = "";
  document.getElementById("q-explanation").value = "";
  document.getElementById("soal-form-title").textContent = "📝 Tambah Soal Baru";
  document.getElementById("btn-save-soal").textContent = "Simpan Soal";
  const errEl = document.getElementById("soal-form-error");
  if (errEl) errEl.style.display = "none";
}


// ==========================================
// PACKAGE MANAGEMENT — LOAD
// ==========================================
async function loadPackages() {
  try {
    const q = query(collection(db, "exam_packages"), where("teacherId", "==", currentUser.uid));
    const snap = await getDocs(q);
    packagesList = [];
    snap.forEach((docSnap) => { packagesList.push({ id: docSnap.id, ...docSnap.data() }); });
    // Sort client-side by createdAt descending
    packagesList.sort((a, b) => {
      const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
    const totalEl = document.getElementById("total-paket-count");
    if (totalEl) totalEl.textContent = packagesList.length;
    renderPackageList();
  } catch (error) {
    console.error("Gagal memuat paket:", error.code, error.message, error);
    const container = document.getElementById("paket-list-container");
    if (container) container.innerHTML = '<p class="text-center" style="color:#c53030;padding:1rem;">Gagal memuat paket: ' + (error.code || error.message) + '</p>';
  }
}

// ==========================================
// PACKAGE MANAGEMENT — RENDER LIST
// ==========================================
function renderPackageList() {
  const container = document.getElementById("paket-list-container");
  if (!container) return;
  const totalEl = document.getElementById("paket-total");
  if (totalEl) totalEl.textContent = `Total: ${packagesList.length} paket`;
  if (packagesList.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Belum ada paket ujian. Buat paket pertamamu!</p>';
    return;
  }
  let html = "";
  packagesList.forEach((pkg) => {
    const statusBadge = pkg.isPublished
      ? '<span class="badge badge-published">Published</span>'
      : '<span class="badge badge-draft">Draft</span>';
    const codeInfo = pkg.accessCode ? `<p class="soal-preview">Kode akses: <strong>${pkg.accessCode}</strong></p>` : '';
    const publishBtn = pkg.isPublished
      ? `<button class="btn-sm btn-unpublish" data-id="${pkg.id}">Unpublish</button>`
      : `<button class="btn-sm btn-publish" data-id="${pkg.id}">Publish</button>`;
    html += `
      <div class="soal-item">
        <div class="soal-item-header">
          ${statusBadge}
          <span class="soal-meta">${pkg.mapel} — ${pkg.kelas} — ${pkg.jenjang}</span>
        </div>
        <p class="soal-preview"><strong>${pkg.title}</strong></p>
        <p class="soal-preview">Jumlah soal: ${pkg.totalQuestions} | Durasi: ${pkg.durationMinutes || '—'} menit</p>
        ${codeInfo}
        <div class="soal-item-actions">
          <button class="btn-sm btn-edit" data-id="${pkg.id}">Edit</button>
          ${publishBtn}
          <button class="btn-sm btn-delete" data-id="${pkg.id}">Hapus</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  container.querySelectorAll(".btn-edit").forEach(btn => { btn.addEventListener("click", () => handleEditPackage(btn.dataset.id)); });
  container.querySelectorAll(".btn-publish").forEach(btn => { btn.addEventListener("click", () => handlePublishPackage(btn.dataset.id, true)); });
  container.querySelectorAll(".btn-unpublish").forEach(btn => { btn.addEventListener("click", () => handlePublishPackage(btn.dataset.id, false)); });
  container.querySelectorAll(".btn-delete").forEach(btn => { btn.addEventListener("click", () => handleDeletePackage(btn.dataset.id)); });
}

// ==========================================
// PACKAGE MANAGEMENT — QUESTION SELECT LIST
// ==========================================
function renderQuestionSelectList() {
  const container = document.getElementById("p-question-select-list");
  if (!container) return;
  const fj = (document.getElementById("p-filter-jenjang") || {}).value || "";
  const fk = (document.getElementById("p-filter-kelas") || {}).value || "";
  const fm = (document.getElementById("p-filter-mapel") || {}).value.trim().toLowerCase() || "";
  let filtered = questionsList;
  if (fj) filtered = filtered.filter(q => q.jenjang === fj);
  if (fk) filtered = filtered.filter(q => q.kelas === fk);
  if (fm) filtered = filtered.filter(q => q.mapel.toLowerCase().includes(fm));
  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-light);padding:1rem;text-align:center;">Tidak ada soal yang cocok dengan filter.</p>';
    return;
  }
  let html = "";
  filtered.forEach((q) => {
    const checked = selectedQuestionIds.has(q.id) ? "checked" : "";
    const preview = q.questionText.length > 60 ? q.questionText.substring(0, 60) + "..." : q.questionText;
    html += `<label class="question-check-item"><input type="checkbox" value="${q.id}" ${checked}><span class="qci-text"><span class="qci-preview">${preview}</span><span class="qci-meta">${q.mapel} — ${q.kelas}</span></span></label>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) selectedQuestionIds.add(cb.value);
      else selectedQuestionIds.delete(cb.value);
      updateSelectedCount();
    });
  });
}

function updateSelectedCount() {
  const el = document.getElementById("p-selected-count");
  if (el) el.textContent = `Soal dipilih: ${selectedQuestionIds.size}`;
}

// ==========================================
// PACKAGE MANAGEMENT — SAVE
// ==========================================
async function handleSavePackage() {
  const title = document.getElementById("p-title").value.trim();
  const jenjang = document.getElementById("p-jenjang").value;
  const kelas = document.getElementById("p-kelas").value;
  const mapel = document.getElementById("p-mapel").value;
  const durationInput = document.getElementById("p-duration").value.trim();
  const accessCode = document.getElementById("p-access-code").value.trim();
  const publishRadio = document.querySelector('input[name="p-publish"]:checked');
  const isPublished = publishRadio ? publishRadio.value === "publish" : false;
  const errEl = document.getElementById("paket-form-error");
  if (errEl) errEl.style.display = "none";
  if (!title) { showPaketError("Isi judul paket."); return; }
  if (!jenjang) { showPaketError("Pilih jenjang."); return; }
  if (!kelas) { showPaketError("Pilih kelas."); return; }
  if (!mapel) { showPaketError("Pilih mata pelajaran."); return; }
  if (!durationInput) { showPaketError("Isi durasi ujian."); return; }
  if (Number(durationInput) < 1) { showPaketError("Durasi ujian minimal 1 menit."); return; }
  if (selectedQuestionIds.size === 0) { showPaketError("Pilih minimal 1 soal."); return; }
  showLoading(true);
  try {
    const questionIds = Array.from(selectedQuestionIds);
    const durationMinutes = Number(durationInput);
    const data = {
      teacherId: currentUser.uid,
      teacherUsername: currentUserData.teacherUsername,
      schoolId: currentUserData.schoolId,
      schoolSlug: currentUserData.schoolSlug,
      schoolName: currentUserData.schoolName,
      title, jenjang, kelas, mapel,
      questionIds,
      totalQuestions: questionIds.length,
      durationMinutes,
      accessCode: accessCode || "",
      isPublished,
      updatedAt: serverTimestamp()
    };
    const editId = document.getElementById("edit-paket-id").value;
    if (editId) {
      const pRef = doc(db, "exam_packages", editId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists() || pSnap.data().teacherId !== currentUser.uid) { showPaketError("Tidak ada izin."); showLoading(false); return; }
      await updateDoc(pRef, data);
      showSuccess("Paket berhasil diupdate!");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "exam_packages"), data);
      showSuccess("Paket ujian berhasil disimpan.");
    }
    resetPackageForm();
    await loadPackages();
  } catch (error) {
    console.error("Gagal menyimpan paket:", error.code, error.message, error);
    showPaketError("Gagal menyimpan paket: " + (error.code || error.message));
  }
  finally { showLoading(false); }
}

// ==========================================
// PACKAGE MANAGEMENT — EDIT
// ==========================================
function handleEditPackage(packageId) {
  const pkg = packagesList.find(p => p.id === packageId);
  if (!pkg || pkg.teacherId !== currentUser.uid) return;
  editingPackageId = packageId;
  document.getElementById("edit-paket-id").value = packageId;
  document.getElementById("p-title").value = pkg.title;
  document.getElementById("p-jenjang").value = pkg.jenjang;
  updatePaketKelasOptions();
  updatePaketMapelOptions();
  document.getElementById("p-kelas").value = pkg.kelas;
  document.getElementById("p-mapel").value = pkg.mapel;
  document.getElementById("p-access-code").value = pkg.accessCode || "";
  document.getElementById("p-duration").value = pkg.durationMinutes || "";
  // Set publish radio
  const radios = document.querySelectorAll('input[name="p-publish"]');
  radios.forEach(r => { r.checked = (pkg.isPublished && r.value === "publish") || (!pkg.isPublished && r.value === "draft"); });
  // Set selected questions
  selectedQuestionIds = new Set(pkg.questionIds || []);
  updateSelectedCount();
  renderQuestionSelectList();
  document.getElementById("paket-form-title").textContent = "✏️ Edit Paket Ujian";
  document.getElementById("btn-save-paket").textContent = "Update Paket";
  document.getElementById("paket-form-title").scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// PACKAGE MANAGEMENT — PUBLISH / UNPUBLISH
// ==========================================
async function handlePublishPackage(packageId, publish) {
  const pkg = packagesList.find(p => p.id === packageId);
  if (!pkg || pkg.teacherId !== currentUser.uid) return;
  showLoading(true);
  try {
    const pRef = doc(db, "exam_packages", packageId);
    await updateDoc(pRef, { isPublished: publish });
    showSuccess(publish ? "Paket berhasil dipublish! Murid sekarang bisa melihat paket ini." : "Paket disembunyikan dari murid.");
    await loadPackages();
  } catch (error) { console.error("Gagal update status:", error); alert("Gagal mengubah status paket."); }
  finally { showLoading(false); }
}

// ==========================================
// PACKAGE MANAGEMENT — DELETE
// ==========================================
async function handleDeletePackage(packageId) {
  const pkg = packagesList.find(p => p.id === packageId);
  if (!pkg || pkg.teacherId !== currentUser.uid) return;
  if (!confirm("Yakin ingin menghapus paket ini? Data hasil murid tidak ikut terhapus.")) return;
  showLoading(true);
  try {
    await deleteDoc(doc(db, "exam_packages", packageId));
    showSuccess("Paket berhasil dihapus!");
    await loadPackages();
  } catch (error) { console.error("Gagal menghapus paket:", error); alert("Gagal menghapus paket."); }
  finally { showLoading(false); }
}

// ==========================================
// PACKAGE FORM — RESET
// ==========================================
function resetPackageForm() {
  editingPackageId = null;
  document.getElementById("edit-paket-id").value = "";
  document.getElementById("p-title").value = "";
  document.getElementById("p-jenjang").value = "";
  document.getElementById("p-kelas").innerHTML = '<option value="">— Pilih Kelas —</option>';
  document.getElementById("p-mapel").innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
  document.getElementById("p-access-code").value = "";
  document.getElementById("p-duration").value = "";
  const radios = document.querySelectorAll('input[name="p-publish"]');
  radios.forEach(r => { r.checked = r.value === "draft"; });
  selectedQuestionIds = new Set();
  updateSelectedCount();
  renderQuestionSelectList();
  document.getElementById("paket-form-title").textContent = "📦 Buat Paket Ujian Baru";
  document.getElementById("btn-save-paket").textContent = "Simpan Paket";
  const errEl = document.getElementById("paket-form-error");
  if (errEl) errEl.style.display = "none";
}


// ==========================================
// KELAS DROPDOWN HELPERS
// ==========================================
function getKelasOptions(jenjang) {
  if (jenjang === "SMP") return ['Kelas 7', 'Kelas 8', 'Kelas 9'];
  if (jenjang === "SMA" || jenjang === "SMK") return ['Kelas 10', 'Kelas 11', 'Kelas 12'];
  return [];
}

const MAPEL_BY_JENJANG = {
  SMP: ["Matematika","Bahasa Indonesia","Bahasa Inggris","IPA","IPS","PPKn","Informatika","Seni Budaya","PJOK","Prakarya"],
  SMA: ["Matematika","Bahasa Indonesia","Bahasa Inggris","Fisika","Kimia","Biologi","Ekonomi","Geografi","Sosiologi","Sejarah","PPKn","Informatika"],
  SMK: ["Matematika","Bahasa Indonesia","Bahasa Inggris","PPKn","Sejarah","Informatika","Projek IPAS","Dasar-Dasar Kejuruan","Konsentrasi Keahlian","Produk Kreatif dan Kewirausahaan"]
};

function updateKelasOptions() {
  const jenjang = document.getElementById("q-jenjang").value;
  const kelasSelect = document.getElementById("q-kelas");
  if (!kelasSelect) return;
  let html = '<option value="">— Pilih Kelas —</option>';
  getKelasOptions(jenjang).forEach(k => { html += `<option value="${k}">${k}</option>`; });
  kelasSelect.innerHTML = html;
  updateMapelOptions();
}

function updateMapelOptions() {
  const jenjang = document.getElementById("q-jenjang").value;
  const mapelSelect = document.getElementById("q-mapel");
  if (!mapelSelect) return;
  let html = '<option value="">-- Pilih Mata Pelajaran --</option>';
  const subjects = MAPEL_BY_JENJANG[jenjang] || [];
  subjects.forEach(s => { html += `<option value="${s}">${s}</option>`; });
  mapelSelect.innerHTML = html;
}

function updateFilterKelas() {
  const jenjang = document.getElementById("filter-jenjang").value;
  const el = document.getElementById("filter-kelas");
  if (!el) return;
  let html = '<option value="">Semua Kelas</option>';
  getKelasOptions(jenjang).forEach(k => { html += `<option value="${k}">${k}</option>`; });
  el.innerHTML = html;
}

function updatePaketKelasOptions() {
  const jenjang = document.getElementById("p-jenjang").value;
  const el = document.getElementById("p-kelas");
  if (!el) return;
  let html = '<option value="">— Pilih Kelas —</option>';
  getKelasOptions(jenjang).forEach(k => { html += `<option value="${k}">${k}</option>`; });
  el.innerHTML = html;
}

function updatePaketMapelOptions() {
  const jenjang = document.getElementById("p-jenjang").value;
  const mapelSelect = document.getElementById("p-mapel");
  if (!mapelSelect) return;
  let html = '<option value="">-- Pilih Mata Pelajaran --</option>';
  const subjects = MAPEL_BY_JENJANG[jenjang] || [];
  subjects.forEach(s => { html += `<option value="${s}">${s}</option>`; });
  mapelSelect.innerHTML = html;
}

function updatePaketFilterKelas() {
  const jenjang = document.getElementById("p-filter-jenjang").value;
  const el = document.getElementById("p-filter-kelas");
  if (!el) return;
  let html = '<option value="">Semua Kelas</option>';
  getKelasOptions(jenjang).forEach(k => { html += `<option value="${k}">${k}</option>`; });
  el.innerHTML = html;
}

// ==========================================
// SCHOOL PREVIEW
// ==========================================
function updateSchoolPreview() {
  const level = document.getElementById("school-level").value || "___";
  const status = document.getElementById("school-status").value || "___";
  const nameNumber = document.getElementById("school-name-number").value.trim().toUpperCase() || "___";
  const city = document.getElementById("school-city").value.trim().toUpperCase() || "___";
  const previewEl = document.getElementById("school-preview-name");
  if (previewEl) previewEl.textContent = `${level} ${status} ${nameNumber} ${city}`;
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
    if (welcomeEl) welcomeEl.textContent = `Selamat datang, ${currentUserData.teacherUsername}! Kelola soal, paket ujian, dan pantau hasil murid Anda.`;
    const schoolEl = document.getElementById("dashboard-school-name");
    if (schoolEl) schoolEl.textContent = currentUserData.schoolName || "—";
  }
}

function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function showUsernameError(msg) {
  const el = document.getElementById("username-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function showFormError(msg) {
  const el = document.getElementById("form-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function showSoalError(msg) {
  const el = document.getElementById("soal-form-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function showPaketError(msg) {
  const el = document.getElementById("paket-form-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

function hideErrors() {
  ["username-error", "form-error"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function showSuccess(message) {
  const el = document.getElementById("success-message");
  if (el) { el.textContent = message; el.style.display = "block"; setTimeout(() => { el.style.display = "none"; }, 5000); }
}



// ==========================================
// ANALYTICS — LOAD TEACHER RESULTS
// ==========================================
let teacherResults = [];

async function loadTeacherResults() {
  try {
    const q = query(collection(db, "exam_results"), where("teacherId", "==", currentUser.uid));
    const snap = await getDocs(q);
    teacherResults = [];
    snap.forEach((docSnap) => { teacherResults.push({ id: docSnap.id, ...docSnap.data() }); });
    // Sort client-side by submittedAt descending
    teacherResults.sort((a, b) => {
      const aTime = a.submittedAt && a.submittedAt.toMillis ? a.submittedAt.toMillis() : 0;
      const bTime = b.submittedAt && b.submittedAt.toMillis ? b.submittedAt.toMillis() : 0;
      return bTime - aTime;
    });

    // Update ringkasan stats
    const pesertaEl = document.getElementById("total-peserta-count");
    if (pesertaEl) pesertaEl.textContent = teacherResults.length;
    const publishedEl = document.getElementById("total-published-count");
    if (publishedEl) publishedEl.textContent = packagesList.filter(p => p.isPublished).length;
    const avgEl = document.getElementById("avg-all-score");
    if (avgEl && teacherResults.length > 0) {
      const avg = (teacherResults.reduce((s, r) => s + r.score, 0) / teacherResults.length).toFixed(1);
      avgEl.textContent = avg;
    }

    // Populate filter dropdowns
    populateResultExamFilter();
    populateAnalysisExamSelect();
    renderResultList();
  } catch (error) {
    console.error("Gagal memuat hasil:", error);
    const container = document.getElementById("result-list-container");
    if (container) container.innerHTML = '<p class="text-center" style="color:#c53030;padding:1rem;">Gagal memuat hasil.</p>';
  }
}

function populateResultExamFilter() {
  const select = document.getElementById("result-filter-exam");
  if (!select) return;
  let html = '<option value="">Semua Paket Ujian</option>';
  packagesList.forEach(pkg => { html += `<option value="${pkg.id}">${pkg.title}</option>`; });
  select.innerHTML = html;
}

function populateAnalysisExamSelect() {
  const select = document.getElementById("analysis-exam-select");
  if (!select) return;
  const examsWithResults = [...new Set(teacherResults.map(r => r.examId))];
  let html = '<option value="">— Pilih Paket —</option>';
  packagesList.filter(p => examsWithResults.includes(p.id)).forEach(pkg => {
    html += `<option value="${pkg.id}">${pkg.title} (${pkg.mapel} — ${pkg.kelas})</option>`;
  });
  select.innerHTML = html;
}

// ==========================================
// ANALYTICS — RENDER RESULT LIST
// ==========================================
function renderResultList() {
  const container = document.getElementById("result-list-container");
  if (!container) return;
  const fn = (document.getElementById("result-filter-name") || {}).value.trim().toLowerCase();
  const fe = (document.getElementById("result-filter-exam") || {}).value;
  const fs = (document.getElementById("result-filter-score") || {}).value;

  let filtered = teacherResults;
  if (fn) filtered = filtered.filter(r => (r.studentName || "").toLowerCase().includes(fn));
  if (fe) filtered = filtered.filter(r => r.examId === fe);
  if (fs === "high") filtered = filtered.filter(r => r.score >= 75);
  else if (fs === "mid") filtered = filtered.filter(r => r.score >= 60 && r.score < 75);
  else if (fs === "low") filtered = filtered.filter(r => r.score < 60);

  const totalEl = document.getElementById("result-total");
  if (totalEl) totalEl.textContent = `Total: ${filtered.length} hasil`;

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:2rem;">Belum ada murid yang mengerjakan ujianmu.</p>';
    return;
  }

  // Group by examId
  const grouped = {};
  filtered.forEach(r => {
    if (!grouped[r.examId]) grouped[r.examId] = { title: r.examTitle, mapel: r.mapel, kelas: r.kelas, jenjang: r.jenjang, results: [] };
    grouped[r.examId].results.push(r);
  });

  let html = "";
  Object.entries(grouped).forEach(([examId, group]) => {
    html += `<div class="result-group">
      <div class="result-group-header" data-exam="${examId}">
        <strong>${group.title}</strong>
        <span class="soal-meta">${group.mapel} — ${group.kelas} — ${group.jenjang} | ${group.results.length} peserta</span>
      </div>
      <div class="result-group-body">`;
    group.results.forEach(r => {
      const scoreClass = r.score >= 75 ? "score-high" : r.score >= 60 ? "score-mid" : "score-low";
      const mins = Math.floor((r.durationSeconds || 0) / 60).toString().padStart(2, "0");
      const secs = ((r.durationSeconds || 0) % 60).toString().padStart(2, "0");
      let dateStr = "—";
      if (r.submittedAt && r.submittedAt.toDate) {
        const d = r.submittedAt.toDate();
        dateStr = `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
      }
      const attemptBadge = r.attemptType === "remedial"
        ? '<span class="badge badge-draft" style="background:#f6ad55;color:#744210;font-size:0.7rem;">Remedial</span>'
        : '<span class="badge badge-published" style="font-size:0.7rem;">Reguler</span>';
      html += `<div class="result-student-row">
        <div class="result-student-info"><strong>${r.studentName}</strong><span>${r.studentUniqueNumber} — ${r.studentNumberType}</span> ${attemptBadge}</div>
        <div class="result-student-stats">
          <span class="history-score ${scoreClass}">${r.score}</span>
          <span>Benar: ${r.correctCount} | Salah: ${r.wrongCount}</span>
          <span>${mins}:${secs}</span>
          <span>${dateStr}</span>
          <button class="btn-sm btn-remedial" data-exam-id="${r.examId}" data-exam-title="${r.examTitle}" data-student-id="${r.studentId}" data-student-name="${r.studentName}" data-student-number="${r.studentUniqueNumber}">Beri Remedial</button>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  });
  container.innerHTML = html;

  // Bind remedial buttons
  container.querySelectorAll(".btn-remedial").forEach(btn => {
    btn.addEventListener("click", () => handleGiveRemedial(btn.dataset));
  });
}

// ==========================================
// REMEDIAL ACCESS — GIVE REMEDIAL
// ==========================================
async function handleGiveRemedial(dataset) {
  const { examId, examTitle, studentId, studentName, studentNumber } = dataset;
  if (!examId || !studentId) return;

  const accessDocId = `${examId}_${studentId}`;
  const accessRef = doc(db, "remedial_access", accessDocId);

  showLoading(true);
  try {
    // Check if active remedial already exists
    const accessSnap = await getDoc(accessRef);
    if (accessSnap.exists() && accessSnap.data().status === "active" && !accessSnap.data().used) {
      alert("Murid ini sudah memiliki akses remedial aktif.");
      showLoading(false);
      return;
    }

    // Create/update remedial access
    const remedialData = {
      examId,
      examTitle: examTitle || "",
      studentId,
      studentName: studentName || "",
      studentUniqueNumber: studentNumber || "",
      teacherId: currentUser.uid,
      teacherUsername: currentUserData.teacherUsername,
      schoolName: currentUserData.schoolName || "",
      status: "active",
      used: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log("Giving remedial access:", remedialData);
    await setDoc(accessRef, remedialData);
    showSuccess("Remedial berhasil diberikan kepada murid.");
  } catch (error) {
    console.error("Gagal memberi remedial:", error.code, error.message, error);
    alert("Gagal memberi remedial: " + (error.code || error.message));
  } finally {
    showLoading(false);
  }
}

// ==========================================
// ANALYTICS — PER EXAM ANALYSIS
// ==========================================
function renderExamAnalysis(examId) {
  const container = document.getElementById("exam-analysis-content");
  const qContainer = document.getElementById("question-analysis-content");
  if (!container) return;

  if (!examId) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Pilih paket ujian untuk melihat analisis.</p>';
    if (qContainer) qContainer.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Pilih paket ujian di atas untuk melihat analisis per soal.</p>';
    return;
  }

  const results = teacherResults.filter(r => r.examId === examId);
  if (results.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Belum ada peserta untuk ujian ini.</p>';
    return;
  }

  const total = results.length;
  const scores = results.map(r => r.score);
  const avg = (scores.reduce((a, b) => a + b, 0) / total).toFixed(1);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const passed = results.filter(r => r.score >= 75).length;
  const passRate = ((passed / total) * 100).toFixed(1);

  const sangat = results.filter(r => r.score >= 90).length;
  const baik = results.filter(r => r.score >= 75 && r.score < 90).length;
  const cukup = results.filter(r => r.score >= 60 && r.score < 75).length;
  const kurang = results.filter(r => r.score < 60).length;

  // Ranking table
  const ranked = [...results].sort((a, b) => b.score - a.score || (a.durationSeconds || 0) - (b.durationSeconds || 0));

  let html = `
    <div class="stat-grid recap-stats">
      <div class="stat-card"><span class="stat-value">${total}</span><span class="stat-label">Total Peserta</span></div>
      <div class="stat-card"><span class="stat-value">${avg}</span><span class="stat-label">Rata-rata Nilai</span></div>
      <div class="stat-card"><span class="stat-value score-high">${max}</span><span class="stat-label">Nilai Tertinggi</span></div>
      <div class="stat-card"><span class="stat-value score-low">${min}</span><span class="stat-label">Nilai Terendah</span></div>
      <div class="stat-card"><span class="stat-value">${passRate}%</span><span class="stat-label">Tingkat Kelulusan</span></div>
    </div>
    <h3 style="font-size:1rem;color:var(--primary);margin:1.5rem 0 0.75rem;">Distribusi Nilai</h3>
    <div class="distribution-bars">
      <div class="dist-row"><span class="dist-label">Sangat Baik (>=90)</span><div class="dist-bar-bg"><div class="dist-bar dist-green" style="width:${total?((sangat/total)*100):0}%"></div></div><span class="dist-count">${sangat}</span></div>
      <div class="dist-row"><span class="dist-label">Baik (75-89)</span><div class="dist-bar-bg"><div class="dist-bar dist-blue" style="width:${total?((baik/total)*100):0}%"></div></div><span class="dist-count">${baik}</span></div>
      <div class="dist-row"><span class="dist-label">Cukup (60-74)</span><div class="dist-bar-bg"><div class="dist-bar dist-yellow" style="width:${total?((cukup/total)*100):0}%"></div></div><span class="dist-count">${cukup}</span></div>
      <div class="dist-row"><span class="dist-label">Kurang (<60)</span><div class="dist-bar-bg"><div class="dist-bar dist-red" style="width:${total?((kurang/total)*100):0}%"></div></div><span class="dist-count">${kurang}</span></div>
    </div>
    <h3 style="font-size:1rem;color:var(--primary);margin:1.5rem 0 0.75rem;">Peringkat Murid</h3>
    <div class="recap-table-wrapper"><table class="recap-table">
      <thead><tr><th>#</th><th>Nama</th><th>Nomor</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Durasi</th></tr></thead><tbody>`;
  ranked.forEach((r, i) => {
    const mins = Math.floor((r.durationSeconds||0)/60).toString().padStart(2,"0");
    const secs = ((r.durationSeconds||0)%60).toString().padStart(2,"0");
    const sc = r.score >= 75 ? "score-high" : r.score >= 60 ? "score-mid" : "score-low";
    html += `<tr><td>${i+1}</td><td>${r.studentName}</td><td>${r.studentUniqueNumber}</td><td class="${sc}">${r.score}</td><td>${r.correctCount}</td><td>${r.wrongCount}</td><td>${mins}:${secs}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;

  // Per-question analysis
  renderQuestionAnalysis(examId, results);
}

// ==========================================
// ANALYTICS — PER QUESTION ANALYSIS
// ==========================================
function renderQuestionAnalysis(examId, results) {
  const container = document.getElementById("question-analysis-content");
  if (!container) return;

  const pkg = packagesList.find(p => p.id === examId);
  if (!pkg || !pkg.questionIds || pkg.questionIds.length === 0) {
    container.innerHTML = '<p class="text-center" style="color:var(--text-light);padding:1rem;">Tidak ada data soal.</p>';
    return;
  }

  // Build per-question stats
  const qStats = {};
  pkg.questionIds.forEach(qId => {
    qStats[qId] = { total: 0, correct: 0, wrong: 0, choices: { A: 0, B: 0, C: 0, D: 0 } };
  });

  results.forEach(r => {
    if (!r.answers) return;
    r.answers.forEach(ans => {
      if (!qStats[ans.questionId]) return;
      qStats[ans.questionId].total++;
      if (ans.isCorrect) qStats[ans.questionId].correct++;
      else qStats[ans.questionId].wrong++;
      if (ans.studentAnswer && qStats[ans.questionId].choices[ans.studentAnswer] !== undefined) {
        qStats[ans.questionId].choices[ans.studentAnswer]++;
      }
    });
  });

  // Get question details from questionsList
  const qDetails = {};
  questionsList.forEach(q => { qDetails[q.id] = q; });

  // Build analysis array
  const analysis = pkg.questionIds.map((qId, idx) => {
    const stat = qStats[qId];
    const detail = qDetails[qId];
    const pctCorrect = stat.total > 0 ? ((stat.correct / stat.total) * 100).toFixed(1) : 0;
    const difficulty = parseFloat(pctCorrect) >= 80 ? "Mudah" : parseFloat(pctCorrect) >= 50 ? "Sedang" : "Sulit";
    const preview = detail ? (detail.questionText.length > 80 ? detail.questionText.substring(0, 80) + "..." : detail.questionText) : `Soal #${idx+1}`;
    const correctAnswer = detail ? detail.correctAnswer : "";
    return { qId, idx, preview, stat, pctCorrect: parseFloat(pctCorrect), difficulty, correctAnswer };
  });

  // Summary
  const sorted = [...analysis].sort((a, b) => b.pctCorrect - a.pctCorrect);
  const easiest = sorted[0];
  const hardest = sorted[sorted.length - 1];
  const mostWrong = [...analysis].sort((a, b) => b.stat.wrong - a.stat.wrong)[0];

  let html = `
    <div class="question-analysis-summary">
      <p><strong>Soal termudah:</strong> Soal ${easiest.idx+1} — ${easiest.preview.substring(0,40)}... (${easiest.pctCorrect}% benar)</p>
      <p><strong>Soal tersulit:</strong> Soal ${hardest.idx+1} — ${hardest.preview.substring(0,40)}... (${hardest.pctCorrect}% benar)</p>
      <p><strong>Paling banyak salah:</strong> Soal ${mostWrong.idx+1} — ${mostWrong.stat.wrong} murid salah</p>
    </div>
  `;

  analysis.forEach(a => {
    const diffClass = a.difficulty === "Mudah" ? "badge-published" : a.difficulty === "Sedang" ? "badge-draft" : "badge-hard";
    html += `
      <div class="qa-item">
        <div class="qa-header">
          <span><strong>Soal ${a.idx+1}</strong></span>
          <span class="badge ${diffClass}">${a.difficulty}</span>
        </div>
        <p class="qa-preview">${a.preview}</p>
        <div class="qa-stats">
          <span>Total jawaban: ${a.stat.total}</span>
          <span class="score-high">Benar: ${a.stat.correct} (${a.pctCorrect}%)</span>
          <span class="score-low">Salah: ${a.stat.wrong} (${a.stat.total > 0 ? (100 - a.pctCorrect).toFixed(1) : 0}%)</span>
        </div>
        <div class="qa-choices">
          <div class="qa-choice ${a.correctAnswer === 'A' ? 'qa-correct' : ''}">A: ${a.stat.choices.A} murid</div>
          <div class="qa-choice ${a.correctAnswer === 'B' ? 'qa-correct' : ''}">B: ${a.stat.choices.B} murid</div>
          <div class="qa-choice ${a.correctAnswer === 'C' ? 'qa-correct' : ''}">C: ${a.stat.choices.C} murid</div>
          <div class="qa-choice ${a.correctAnswer === 'D' ? 'qa-correct' : ''}">D: ${a.stat.choices.D} murid</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ==========================================
// ANALYTICS — EVENT BINDINGS (called in init)
// ==========================================
function initAnalyticsEvents() {
  const resultFilterName = document.getElementById("result-filter-name");
  const resultFilterExam = document.getElementById("result-filter-exam");
  const resultFilterScore = document.getElementById("result-filter-score");
  if (resultFilterName) resultFilterName.addEventListener("input", renderResultList);
  if (resultFilterExam) resultFilterExam.addEventListener("change", renderResultList);
  if (resultFilterScore) resultFilterScore.addEventListener("change", renderResultList);

  const analysisSelect = document.getElementById("analysis-exam-select");
  if (analysisSelect) analysisSelect.addEventListener("change", () => renderExamAnalysis(analysisSelect.value));
}

// Call analytics init after DOM loaded
document.addEventListener("DOMContentLoaded", () => { initAnalyticsEvents(); });
