// hasil.js — Menampilkan hasil ujian dan review jawaban

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const resultId = localStorage.getItem("examResultId");
  if (!resultId) {
    window.location.href = "dashboard-murid.html";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    await loadResult(resultId);
  });

  // Back button clears localStorage
  const btnBack = document.getElementById("btn-back-dashboard");
  if (btnBack) {
    btnBack.addEventListener("click", (e) => {
      localStorage.removeItem("examResultId");
    });
  }
});

// ==========================================
// LOAD RESULT
// ==========================================
async function loadResult(resultId) {
  showLoading(true);
  try {
    const resultRef = doc(db, "exam_results", resultId);
    const resultSnap = await getDoc(resultRef);

    if (!resultSnap.exists()) {
      alert("Hasil ujian tidak ditemukan.");
      localStorage.removeItem("examResultId");
      window.location.href = "dashboard-murid.html";
      return;
    }

    const data = resultSnap.data();
    displayResult(data);
    displayAnswerReview(data.answers || []);

  } catch (error) {
    console.error("Gagal memuat hasil:", error);
    alert("Gagal memuat hasil ujian.");
    window.location.href = "dashboard-murid.html";
  } finally {
    showLoading(false);
  }
}

// ==========================================
// DISPLAY RESULT SUMMARY
// ==========================================
function displayResult(data) {
  // Title
  const titleEl = document.getElementById("result-exam-title");
  if (titleEl) titleEl.textContent = data.examTitle || "Ujian";

  // Score
  const scoreEl = document.getElementById("result-score");
  if (scoreEl) scoreEl.textContent = data.score;

  // Student info
  setTextById("result-student-name", data.studentName);
  setTextById("result-school-name", data.schoolName);
  setTextById("result-mapel", data.mapel);
  setTextById("result-kelas-jenjang", `${data.kelas} — ${data.jenjang}`);
  setTextById("result-correct", data.correctCount);
  setTextById("result-wrong", data.wrongCount);
  setTextById("result-total", data.totalQuestions);
  setTextById("result-teacher", data.teacherUsername);

  // Duration
  const durationEl = document.getElementById("result-duration");
  if (durationEl) {
    const mins = Math.floor(data.durationSeconds / 60).toString().padStart(2, "0");
    const secs = (data.durationSeconds % 60).toString().padStart(2, "0");
    durationEl.textContent = `${mins}:${secs}`;
  }

  // Date
  const dateEl = document.getElementById("result-date");
  if (dateEl) {
    if (data.submittedAt && data.submittedAt.toDate) {
      const d = data.submittedAt.toDate();
      dateEl.textContent = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } else if (data.startedAt) {
      const d = new Date(data.startedAt);
      dateEl.textContent = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } else {
      dateEl.textContent = "—";
    }
  }

  // Show summary section
  const summaryEl = document.getElementById("result-summary");
  if (summaryEl) summaryEl.style.display = "block";

  const backEl = document.getElementById("back-btn-section");
  if (backEl) backEl.style.display = "block";
}

// ==========================================
// DISPLAY ANSWER REVIEW
// ==========================================
function displayAnswerReview(answers) {
  const container = document.getElementById("answer-review-container");
  const section = document.getElementById("answer-review-section");
  if (!container || !section) return;

  if (answers.length === 0) return;

  let html = "";
  answers.forEach((item, index) => {
    const statusClass = item.isCorrect ? "review-correct" : "review-wrong";
    const statusIcon = item.isCorrect ? "✅" : "❌";
    const studentLabel = item.studentAnswer || "Tidak dijawab";

    html += `
      <div class="review-item ${statusClass}">
        <div class="review-header">
          <span class="review-number">${statusIcon} Soal ${index + 1}</span>
          <span class="review-status">${item.isCorrect ? "Benar" : "Salah"}</span>
        </div>
        <p class="review-question">${item.questionText}</p>
        <div class="review-options">
          <div class="review-option ${item.correctAnswer === 'A' ? 'correct-answer' : ''} ${item.studentAnswer === 'A' && !item.isCorrect ? 'wrong-answer' : ''}">A. ${item.options.A}</div>
          <div class="review-option ${item.correctAnswer === 'B' ? 'correct-answer' : ''} ${item.studentAnswer === 'B' && !item.isCorrect ? 'wrong-answer' : ''}">B. ${item.options.B}</div>
          <div class="review-option ${item.correctAnswer === 'C' ? 'correct-answer' : ''} ${item.studentAnswer === 'C' && !item.isCorrect ? 'wrong-answer' : ''}">C. ${item.options.C}</div>
          <div class="review-option ${item.correctAnswer === 'D' ? 'correct-answer' : ''} ${item.studentAnswer === 'D' && !item.isCorrect ? 'wrong-answer' : ''}">D. ${item.options.D}</div>
        </div>
        <p class="review-answer-info">Jawaban kamu: <strong>${studentLabel}</strong> | Jawaban benar: <strong>${item.correctAnswer}</strong></p>
        ${item.explanation ? `<div class="review-explanation"><strong>Pembahasan:</strong> ${item.explanation}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
  section.style.display = "block";
}

// ==========================================
// UTILITIES
// ==========================================
function setTextById(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "—";
}

function showLoading(show) {
  const loader = document.getElementById("loading-indicator");
  if (loader) loader.style.display = show ? "flex" : "none";
}
