// ujian.js — Mengelola alur pengerjaan ujian: navigasi soal, pilih jawaban, timer, dan submit hasil

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;
let currentUserData = null;
let examPackage = null;
let questions = [];
let answers = {}; // { questionId: "A"|"B"|"C"|"D" }
let currentIndex = 0;
let timerInterval = null;
let elapsedSeconds = 0;
let startedAt = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Check if exam ID exists in localStorage
  const examId = localStorage.getItem("currentExamId");
  if (!examId) {
    window.location.href = "dashboard-murid.html";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    currentUser = user;
    await loadUserData(user.uid);
    await loadExam(examId);
  });

  // Navigation buttons
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnFinish = document.getElementById("btn-finish");

  if (btnPrev) btnPrev.addEventListener("click", goToPrev);
  if (btnNext) btnNext.addEventListener("click", goToNext);
  if (btnFinish) btnFinish.addEventListener("click", handleFinishExam);

  // Option buttons
  const optionBtns = document.querySelectorAll(".exam-option-btn");
  optionBtns.forEach(btn => {
    btn.addEventListener("click", () => selectAnswer(btn.dataset.option));
  });
});

// ==========================================
// LOAD USER DATA
// ==========================================
async function loadUserData(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      currentUserData = userSnap.data();
    }
  } catch (error) {
    console.error("Gagal memuat data user:", error);
  }
}

// ==========================================
// LOAD EXAM
// ==========================================
async function loadExam(examId) {
  showLoading(true);
  try {
    // Fetch exam package
    const examRef = doc(db, "exam_packages", examId);
    const examSnap = await getDoc(examRef);

    if (!examSnap.exists()) {
      alert("Paket ujian tidak ditemukan.");
      window.location.href = "dashboard-murid.html";
      return;
    }

    examPackage = { id: examSnap.id, ...examSnap.data() };

    // Security: verify published
    if (!examPackage.isPublished) {
      alert("Paket ujian ini tidak tersedia.");
      window.location.href = "dashboard-murid.html";
      return;
    }

    // Set title
    const titleEl = document.getElementById("exam-title");
    const titleNav = document.getElementById("exam-title-nav");
    if (titleEl) titleEl.textContent = examPackage.title;
    if (titleNav) titleNav.textContent = examPackage.title;

    // Fetch all questions
    const questionIds = examPackage.questionIds || [];
    questions = [];

    for (const qId of questionIds) {
      const qRef = doc(db, "teacher_questions", qId);
      const qSnap = await getDoc(qRef);
      if (qSnap.exists()) {
        questions.push({ id: qSnap.id, ...qSnap.data() });
      }
    }

    if (questions.length === 0) {
      alert("Tidak ada soal dalam paket ini.");
      window.location.href = "dashboard-murid.html";
      return;
    }

    // Shuffle questions
    shuffleArray(questions);

    // Initialize answers
    answers = {};

    // Start timer
    startedAt = new Date();
    startTimer();

    // Build question grid
    buildQuestionGrid();

    // Show first question
    currentIndex = 0;
    showQuestion(currentIndex);

    // Show exam area
    const examArea = document.getElementById("exam-question-area");
    if (examArea) examArea.style.display = "block";

  } catch (error) {
    console.error("Gagal memuat ujian:", error);
    alert("Gagal memuat ujian. Silakan coba lagi.");
    window.location.href = "dashboard-murid.html";
  } finally {
    showLoading(false);
  }
}

// ==========================================
// SHOW QUESTION
// ==========================================
function showQuestion(index) {
  const q = questions[index];
  if (!q) return;

  // Update question number
  const numLabel = document.getElementById("question-number-label");
  if (numLabel) numLabel.textContent = `Soal Nomor ${index + 1}`;

  const numInfo = document.getElementById("exam-question-number");
  if (numInfo) numInfo.textContent = `Soal ${index + 1} dari ${questions.length}`;

  // Update question text
  const textEl = document.getElementById("question-text");
  if (textEl) textEl.textContent = q.questionText;

  // Update options
  document.getElementById("option-text-a").textContent = q.options.A;
  document.getElementById("option-text-b").textContent = q.options.B;
  document.getElementById("option-text-c").textContent = q.options.C;
  document.getElementById("option-text-d").textContent = q.options.D;

  // Highlight selected answer
  const selectedAnswer = answers[q.id] || null;
  document.querySelectorAll(".exam-option-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.option === selectedAnswer);
  });

  // Update progress bar
  const progress = ((index + 1) / questions.length) * 100;
  const progressBar = document.getElementById("exam-progress");
  if (progressBar) progressBar.style.width = `${progress}%`;

  // Update navigation buttons
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  if (btnPrev) btnPrev.disabled = index === 0;
  if (btnNext) {
    if (index === questions.length - 1) {
      btnNext.textContent = "Selesai ➡";
    } else {
      btnNext.textContent = "Selanjutnya ➡";
    }
  }

  // Update question grid
  updateQuestionGrid();
}

// ==========================================
// SELECT ANSWER
// ==========================================
function selectAnswer(option) {
  const q = questions[currentIndex];
  if (!q) return;

  answers[q.id] = option;

  // Highlight selected
  document.querySelectorAll(".exam-option-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.option === option);
  });

  // Update grid
  updateQuestionGrid();
}

// ==========================================
// NAVIGATION
// ==========================================
function goToPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    showQuestion(currentIndex);
  }
}

function goToNext() {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    showQuestion(currentIndex);
  } else {
    // Last question — trigger finish
    handleFinishExam();
  }
}

function goToQuestion(index) {
  if (index >= 0 && index < questions.length) {
    currentIndex = index;
    showQuestion(currentIndex);
  }
}

// ==========================================
// QUESTION GRID
// ==========================================
function buildQuestionGrid() {
  const grid = document.getElementById("question-grid");
  if (!grid) return;

  let html = "";
  questions.forEach((q, i) => {
    html += `<button class="grid-btn" data-index="${i}">${i + 1}</button>`;
  });
  grid.innerHTML = html;

  // Bind grid buttons
  grid.querySelectorAll(".grid-btn").forEach(btn => {
    btn.addEventListener("click", () => goToQuestion(parseInt(btn.dataset.index)));
  });
}

function updateQuestionGrid() {
  const grid = document.getElementById("question-grid");
  if (!grid) return;

  grid.querySelectorAll(".grid-btn").forEach((btn, i) => {
    const q = questions[i];
    btn.classList.remove("answered", "active");
    if (answers[q.id]) btn.classList.add("answered");
    if (i === currentIndex) btn.classList.add("active");
  });
}

// ==========================================
// TIMER
// ==========================================
function startTimer() {
  elapsedSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const timerEl = document.getElementById("exam-timer");
  if (!timerEl) return;
  const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const secs = (elapsedSeconds % 60).toString().padStart(2, "0");
  timerEl.textContent = `⏱ ${mins}:${secs}`;
}

// ==========================================
// FINISH EXAM
// ==========================================
function handleFinishExam() {
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const unanswered = totalQuestions - answeredCount;

  let message;
  if (unanswered > 0) {
    message = `Kamu belum menjawab ${unanswered} soal. Yakin ingin menyelesaikan ujian?`;
  } else {
    message = "Yakin ingin mengumpulkan jawaban?";
  }

  if (!confirm(message)) return;

  stopTimer();
  calculateAndSaveResult();
}

// ==========================================
// CALCULATE SCORE & SAVE RESULT
// ==========================================
async function calculateAndSaveResult() {
  showLoading(true);

  try {
    // Calculate score
    let correctCount = 0;
    let wrongCount = 0;
    const answerDetails = [];

    questions.forEach((q) => {
      const studentAnswer = answers[q.id] || "";
      const isCorrect = studentAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      else wrongCount++;

      answerDetails.push({
        questionId: q.id,
        questionText: q.questionText,
        options: q.options,
        studentAnswer: studentAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: isCorrect,
        explanation: q.explanation || ""
      });
    });

    const totalQuestions = questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100 * 100) / 100; // 2 decimal

    // Build result document
    const resultData = {
      studentId: currentUser.uid,
      studentName: currentUserData.studentName || "",
      studentUniqueNumber: currentUserData.studentUniqueNumber || "",
      studentNumberType: currentUserData.studentNumberType || "",
      examId: examPackage.id,
      examTitle: examPackage.title,
      teacherId: examPackage.teacherId,
      teacherUsername: examPackage.teacherUsername,
      schoolId: currentUserData.schoolId || "",
      schoolSlug: currentUserData.schoolSlug || "",
      schoolName: currentUserData.schoolName || "",
      mapel: examPackage.mapel,
      jenjang: examPackage.jenjang,
      kelas: examPackage.kelas,
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      wrongCount: wrongCount,
      score: score,
      answers: answerDetails,
      startedAt: startedAt.toISOString(),
      submittedAt: serverTimestamp(),
      durationSeconds: elapsedSeconds
    };

    // Save to Firestore
    const resultRef = await addDoc(collection(db, "exam_results"), resultData);

    // Clear localStorage exam data
    localStorage.removeItem("currentExamId");
    localStorage.removeItem("currentExamTitle");
    localStorage.removeItem("currentExamSchoolId");

    // Set result ID for hasil.html
    localStorage.setItem("examResultId", resultRef.id);

    // Redirect to hasil.html
    window.location.href = "hasil.html";

  } catch (error) {
    console.error("Gagal menyimpan hasil:", error);
    alert("Gagal menyimpan hasil ujian. Silakan coba lagi.");
    showLoading(false);
  }
}

// ==========================================
// UTILITIES
// ==========================================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}
