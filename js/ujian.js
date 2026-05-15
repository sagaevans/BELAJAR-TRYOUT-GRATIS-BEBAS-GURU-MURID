// ujian.js — Mengelola alur pengerjaan ujian: navigasi soal, pilih jawaban, timer, dan submit hasil

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

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
  // Support both URL parameter and localStorage for exam ID
  const urlParams = new URLSearchParams(window.location.search);
  let examId = urlParams.get("examId") || urlParams.get("id") || localStorage.getItem("currentExamId");

  console.log("Exam ID from URL:", urlParams.get("examId") || urlParams.get("id"));
  console.log("Exam ID from localStorage:", localStorage.getItem("currentExamId"));
  console.log("Final examId:", examId);

  if (!examId) {
    showExamError("ID ujian tidak ditemukan.");
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
    console.log("Loading exam package with ID:", examId);
    const examRef = doc(db, "exam_packages", examId);
    const examSnap = await getDoc(examRef);

    if (!examSnap.exists()) {
      showExamError("Ujian tidak ditemukan.");
      showLoading(false);
      return;
    }

    examPackage = { id: examSnap.id, ...examSnap.data() };
    console.log("Loaded exam package:", examPackage);

    // Security: verify published
    if (!examPackage.isPublished) {
      showExamError("Ujian belum dipublish.");
      showLoading(false);
      return;
    }

    // Validate questionIds
    const questionIds = examPackage.questionIds || [];
    console.log("Question IDs:", questionIds);

    if (questionIds.length === 0) {
      showExamError("Paket ujian belum memiliki soal.");
      showLoading(false);
      return;
    }

    // Set title
    const titleEl = document.getElementById("exam-title");
    const titleNav = document.getElementById("exam-title-nav");
    if (titleEl) titleEl.textContent = examPackage.title;
    if (titleNav) titleNav.textContent = examPackage.title;

    // Fetch all questions one by one (avoids "in" query limitations)
    questions = [];
    for (const qId of questionIds) {
      try {
        const qRef = doc(db, "teacher_questions", qId);
        const qSnap = await getDoc(qRef);
        if (qSnap.exists()) {
          questions.push({ id: qSnap.id, ...qSnap.data() });
        } else {
          console.warn("Question not found:", qId);
        }
      } catch (qError) {
        console.error("Gagal memuat soal:", qId, qError.code, qError.message);
      }
    }

    console.log("Loaded questions:", questions.length, "of", questionIds.length);

    if (questions.length === 0) {
      showExamError("Soal ujian tidak ditemukan.");
      showLoading(false);
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
    console.error("Gagal memuat ujian:", error.code, error.message, error);
    if (error.code) {
      showExamError("Gagal memuat ujian: " + error.code);
    } else {
      showExamError("Gagal memuat ujian. Periksa console untuk detail.");
    }
  } finally {
    showLoading(false);
  }
}

// ==========================================
// SHOW EXAM ERROR (visible on page)
// ==========================================
function showExamError(message) {
  const titleEl = document.getElementById("exam-title");
  if (titleEl) titleEl.textContent = message;
  const examArea = document.getElementById("exam-question-area");
  if (examArea) examArea.style.display = "none";
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

    console.log("Saving exam result:", { examId: resultData.examId, score: resultData.score, correctCount, wrongCount });

    // Save to Firestore
    const resultRef = await addDoc(collection(db, "exam_results"), resultData);
    console.log("Exam result saved with ID:", resultRef.id);

    // Clear localStorage exam data
    localStorage.removeItem("currentExamId");
    localStorage.removeItem("currentExamTitle");
    localStorage.removeItem("currentExamSchoolId");

    // Set result ID for hasil.html
    localStorage.setItem("examResultId", resultRef.id);

    // Redirect to hasil.html
    window.location.href = "hasil.html";

  } catch (error) {
    console.error("Gagal menyimpan hasil:", error.code, error.message, error);
    if (error.code) {
      alert("Gagal menyimpan hasil ujian: " + error.code);
    } else {
      alert("Gagal menyimpan hasil ujian. Periksa console untuk detail.");
    }
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
