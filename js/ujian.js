// ujian.js — Mengelola alur pengerjaan ujian: navigasi soal, pilih jawaban, countdown timer, dan submit hasil

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
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
let countdownInterval = null;
let remainingSeconds = 0;
let durationMinutes = 60;
let startedAt = null;
let isSubmitting = false;
let isSubmitted = false;
let attemptType = "regular"; // "regular" or "remedial"
let attemptNumber = 1;
let remedialAccessId = null;

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
  if (btnFinish) btnFinish.addEventListener("click", () => handleFinishExam(false));

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

    // Check if student already completed this exam
    const prevResultsQ = query(collection(db, "exam_results"), where("examId", "==", examId), where("studentId", "==", currentUser.uid));
    const prevResultsSnap = await getDocs(prevResultsQ);
    const previousAttempts = prevResultsSnap.size;

    if (previousAttempts > 0) {
      // Student already took this exam — check for active remedial access
      const accessDocId = `${examId}_${currentUser.uid}`;
      const accessRef = doc(db, "remedial_access", accessDocId);
      const accessSnap = await getDoc(accessRef);

      if (accessSnap.exists() && accessSnap.data().status === "active" && !accessSnap.data().used) {
        // Remedial access exists — allow as remedial
        attemptType = "remedial";
        attemptNumber = previousAttempts + 1;
        remedialAccessId = accessDocId;
        console.log("Remedial access found. Attempt:", attemptNumber);
      } else {
        // No active remedial — block
        showExamError("Ujian ini sudah pernah dikerjakan. Hubungi guru jika membutuhkan remedial.");
        showLoading(false);
        return;
      }
    } else {
      attemptType = "regular";
      attemptNumber = 1;
      remedialAccessId = null;
    }

    // Validate questionIds
    const questionIds = examPackage.questionIds || [];
    console.log("Question IDs:", questionIds);

    if (questionIds.length === 0) {
      showExamError("Paket ujian belum memiliki soal.");
      showLoading(false);
      return;
    }

    // Read duration
    durationMinutes = examPackage.durationMinutes || 60;
    console.log("Exam duration minutes:", durationMinutes);

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

    // Start countdown timer with localStorage persistence
    initCountdownTimer(examId);

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
// COUNTDOWN TIMER WITH LOCALSTORAGE PERSISTENCE
// ==========================================
function initCountdownTimer(examId) {
  const storageKey = `exam_start_${examId}_${currentUser.uid}`;
  let startTime = localStorage.getItem(storageKey);

  if (!startTime) {
    // First time — save start time
    startTime = Date.now().toString();
    localStorage.setItem(storageKey, startTime);
  }

  startedAt = new Date(parseInt(startTime));
  const durationSeconds = durationMinutes * 60;
  const elapsedMs = Date.now() - parseInt(startTime);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  remainingSeconds = durationSeconds - elapsedSec;

  console.log("Exam started at:", startedAt);
  console.log("Elapsed seconds:", elapsedSec);
  console.log("Remaining seconds:", remainingSeconds);

  if (remainingSeconds <= 0) {
    // Time already expired — auto submit immediately
    remainingSeconds = 0;
    updateCountdownDisplay();
    console.log("Auto submit triggered (time already expired on load)");
    setTimeout(() => handleFinishExam(true), 500);
    return;
  }

  updateCountdownDisplay();
  countdownInterval = setInterval(() => {
    remainingSeconds--;
    updateCountdownDisplay();
    if (remainingSeconds <= 0) {
      stopCountdown();
      console.log("Auto submit triggered");
      handleFinishExam(true);
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdownDisplay() {
  const timerEl = document.getElementById("exam-timer");
  if (!timerEl) return;
  const display = remainingSeconds > 0 ? remainingSeconds : 0;
  if (display >= 3600) {
    const hrs = Math.floor(display / 3600).toString().padStart(2, "0");
    const mins = Math.floor((display % 3600) / 60).toString().padStart(2, "0");
    const secs = (display % 60).toString().padStart(2, "0");
    timerEl.textContent = `Sisa Waktu: ${hrs}:${mins}:${secs}`;
  } else {
    const mins = Math.floor(display / 60).toString().padStart(2, "0");
    const secs = (display % 60).toString().padStart(2, "0");
    timerEl.textContent = `Sisa Waktu: ${mins}:${secs}`;
  }
  // Warning color when less than 60 seconds
  if (display <= 60 && display > 0) {
    timerEl.style.color = "#c53030";
    timerEl.style.fontWeight = "bold";
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
  if (isSubmitted) return;
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
  if (isSubmitted) return;
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
  if (isSubmitted) return;
  if (currentIndex > 0) {
    currentIndex--;
    showQuestion(currentIndex);
  }
}

function goToNext() {
  if (isSubmitted) return;
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    showQuestion(currentIndex);
  } else {
    // Last question — trigger finish
    handleFinishExam(false);
  }
}

function goToQuestion(index) {
  if (isSubmitted) return;
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
// FINISH EXAM
// ==========================================
function handleFinishExam(autoSubmitted) {
  if (isSubmitting || isSubmitted) return;

  if (autoSubmitted) {
    // Auto submit — no confirmation needed
    alert("Waktu habis. Jawaban dikirim otomatis.");
    stopCountdown();
    submitExam({ autoSubmitted: true });
  } else {
    // Manual submit — ask for confirmation
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

    stopCountdown();
    submitExam({ autoSubmitted: false });
  }
}

// ==========================================
// SUBMIT EXAM (shared by manual + auto submit)
// ==========================================
async function submitExam({ autoSubmitted }) {
  if (isSubmitting || isSubmitted) return;
  isSubmitting = true;
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

    // Calculate time spent
    const durationSeconds = durationMinutes * 60;
    const timeSpentSeconds = Math.max(0, durationSeconds - remainingSeconds);

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
      durationMinutes: durationMinutes,
      durationSeconds: durationSeconds,
      timeSpentSeconds: timeSpentSeconds,
      autoSubmitted: autoSubmitted,
      attemptType: attemptType,
      attemptNumber: attemptNumber,
      remedialAccessId: remedialAccessId || null,
      startedAt: startedAt.toISOString(),
      submittedAt: serverTimestamp()
    };

    console.log("Saving exam result:", { examId: resultData.examId, score: resultData.score, correctCount, wrongCount, timeSpentSeconds, autoSubmitted, attemptType, attemptNumber });

    // Save to Firestore
    const resultRef = await addDoc(collection(db, "exam_results"), resultData);
    console.log("Exam result saved with ID:", resultRef.id);

    // If remedial, mark remedial_access as used
    if (attemptType === "remedial" && remedialAccessId) {
      try {
        const accessRef = doc(db, "remedial_access", remedialAccessId);
        await updateDoc(accessRef, { used: true, status: "used", usedAt: serverTimestamp() });
        console.log("Remedial access marked as used:", remedialAccessId);
      } catch (e) {
        console.warn("Could not update remedial access:", e);
      }
    }

    isSubmitted = true;

    // Clear localStorage exam data
    const storageKey = `exam_start_${examPackage.id}_${currentUser.uid}`;
    localStorage.removeItem(storageKey);
    localStorage.removeItem("currentExamId");
    localStorage.removeItem("currentExamTitle");
    localStorage.removeItem("currentExamSchoolId");

    // Set result ID for hasil.html
    localStorage.setItem("examResultId", resultRef.id);

    // Redirect to hasil.html
    window.location.href = "hasil.html";

  } catch (error) {
    console.error("Gagal submit ujian:", error.code, error.message, error);
    isSubmitting = false;
    if (error.code) {
      alert("Gagal mengirim jawaban: " + error.code);
    } else {
      alert("Gagal mengirim jawaban. Periksa console untuk detail.");
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
