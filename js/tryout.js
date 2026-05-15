// tryout.js — Try Out Gratis tanpa login, soal dari JSON lokal, hasil di browser saja

// ==========================================
// SUBJECT DATA
// ==========================================
const MAPEL_BY_JENJANG = {
  smp: [
    { label: "Matematika", file: "matematika" },
    { label: "IPA", file: "ipa" },
    { label: "IPS", file: "ips" },
    { label: "Bahasa Indonesia", file: "bahasa-indonesia" },
    { label: "Bahasa Inggris", file: "bahasa-inggris" },
    { label: "PPKn", file: "ppkn" }
  ],
  sma: [
    { label: "Matematika", file: "matematika" },
    { label: "Fisika", file: "fisika" },
    { label: "Kimia", file: "kimia" },
    { label: "Biologi", file: "biologi" },
    { label: "Ekonomi", file: "ekonomi" },
    { label: "Sejarah", file: "sejarah" },
    { label: "Bahasa Indonesia", file: "bahasa-indonesia" },
    { label: "Bahasa Inggris", file: "bahasa-inggris" },
    { label: "PPKn", file: "ppkn" }
  ],
  smk: {
    umum: [
      { label: "Matematika", file: "matematika" },
      { label: "Bahasa Indonesia", file: "bahasa-indonesia" },
      { label: "Bahasa Inggris", file: "bahasa-inggris" },
      { label: "IPA Terapan", file: "ipa-terapan" },
      { label: "PPKn", file: "ppkn" }
    ],
    produktif: [
      {
        group: "Teknik & Rekayasa",
        subjects: [
          { label: "Dasar-Dasar Mesin", file: "teknik-dasar-mesin" },
          { label: "Kelistrikan Otomotif", file: "teknik-kelistrikan-otomotif" },
          { label: "Struktur Bangunan", file: "teknik-struktur-bangunan" }
        ]
      },
      {
        group: "Teknologi Informasi (TI)",
        subjects: [
          { label: "Pemrograman Dasar", file: "ti-pemrograman-dasar" },
          { label: "Jaringan Komputer (TKJ)", file: "ti-jaringan-komputer" },
          { label: "Desain Grafis", file: "ti-desain-grafis" }
        ]
      },
      {
        group: "Bisnis & Manajemen",
        subjects: [
          { label: "Dasar Akuntansi", file: "bisnis-dasar-akuntansi" },
          { label: "Pengelolaan Kas", file: "bisnis-pengelolaan-kas" },
          { label: "Pemasaran Digital", file: "bisnis-pemasaran-digital" }
        ]
      },
      {
        group: "Seni & Ekonomi Kreatif",
        subjects: [
          { label: "Teknik Produksi Siaran", file: "seni-produksi-siaran" },
          { label: "Animasi", file: "seni-animasi" },
          { label: "Tata Busana", file: "seni-tata-busana" }
        ]
      },
      {
        group: "Kesehatan & Pekerjaan Sosial",
        subjects: [
          { label: "Dasar Keperawatan", file: "kesehatan-dasar-keperawatan" },
          { label: "Farmakologi Dasar", file: "kesehatan-farmakologi-dasar" }
        ]
      }
    ]
  }
};

// ==========================================
// STATE
// ==========================================
let selectedJenjang = "";
let selectedMapel = "";
let selectedMapelLabel = "";
let questions = [];
let answers = {};
let currentIndex = 0;
let timerInterval = null;
let elapsedSeconds = 0;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Jenjang buttons
  document.querySelectorAll(".jenjang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedJenjang = btn.dataset.jenjang;
      loadMapelButtons(selectedJenjang);
      showStep(2);
    });
  });

  // Back buttons
  document.getElementById("btn-back-step1").addEventListener("click", () => showStep(1));
  document.getElementById("btn-back-step2-empty").addEventListener("click", () => showStep(2));
  document.getElementById("btn-back-step2").addEventListener("click", () => showStep(2));

  // Exam navigation
  document.getElementById("tryout-btn-prev").addEventListener("click", () => navigate(-1));
  document.getElementById("tryout-btn-next").addEventListener("click", () => navigate(1));
  document.getElementById("tryout-btn-finish").addEventListener("click", finishTryout);

  // Option buttons
  document.querySelectorAll("#tryout-options .exam-option-btn").forEach(btn => {
    btn.addEventListener("click", () => selectAnswer(btn.dataset.option));
  });

  // Result buttons
  document.getElementById("tryout-btn-retry").addEventListener("click", resetTryout);
  document.getElementById("tryout-btn-other-mapel").addEventListener("click", () => showStep(2));
});

// ==========================================
// STEP MANAGEMENT
// ==========================================
function showStep(step) {
  [1, 2, 3, 4].forEach(s => {
    const el = document.getElementById(`step-${s}`);
    if (el) el.style.display = s === step ? "block" : "none";
  });
  if (step !== 3) stopTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// LOAD MAPEL BUTTONS
// ==========================================
function loadMapelButtons(jenjang) {
  const container = document.getElementById("mapel-container");
  const subtitle = document.getElementById("step2-subtitle");
  if (!container) return;

  const jenjangLabel = jenjang.toUpperCase();
  if (subtitle) subtitle.textContent = `Pilih mata pelajaran ${jenjangLabel} yang ingin kamu latihan.`;

  if (jenjang === "smk") {
    container.innerHTML = renderSmkUmum() + renderSmkProduktif();
    // Bind accordion toggles
    container.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        const isOpen = body.style.display === "block";
        body.style.display = isOpen ? "none" : "block";
        header.classList.toggle("accordion-open", !isOpen);
      });
    });
  } else {
    const subjects = MAPEL_BY_JENJANG[jenjang];
    let html = '<div class="mapel-grid">';
    subjects.forEach(s => {
      html += `<button class="mapel-btn" data-file="${s.file}" data-label="${s.label}">${s.label}</button>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // Bind mapel buttons
  container.querySelectorAll(".mapel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedMapel = btn.dataset.file;
      selectedMapelLabel = btn.dataset.label;
      loadSoalFromJSON(selectedJenjang, selectedMapel);
    });
  });
}

function renderSmkUmum() {
  const subjects = MAPEL_BY_JENJANG.smk.umum;
  let html = '<h3 class="mapel-section-title">Mata Pelajaran Umum</h3><div class="mapel-grid">';
  subjects.forEach(s => {
    html += `<button class="mapel-btn" data-file="${s.file}" data-label="${s.label}">${s.label}</button>`;
  });
  html += '</div>';
  return html;
}

function renderSmkProduktif() {
  const groups = MAPEL_BY_JENJANG.smk.produktif;
  let html = '<h3 class="mapel-section-title mt-3">Muatan Kejuruan (Produktif)</h3>';
  html += '<p style="color:var(--text-light);font-size:0.9rem;margin-bottom:1rem;">Persiapan Uji Kompetensi Keahlian (UKK)</p>';
  html += '<div class="accordion-list">';
  groups.forEach(g => {
    html += `<div class="accordion-item">`;
    html += `<div class="accordion-header">${g.group} <span class="accordion-arrow">▼</span></div>`;
    html += `<div class="accordion-body" style="display:none;"><div class="mapel-grid">`;
    g.subjects.forEach(s => {
      html += `<button class="mapel-btn" data-file="${s.file}" data-label="${s.label}">${s.label}</button>`;
    });
    html += `</div></div></div>`;
  });
  html += '</div>';
  return html;
}

// ==========================================
// LOAD SOAL FROM JSON
// ==========================================
async function loadSoalFromJSON(jenjang, mapelFile) {
  showStep(3);
  const titleEl = document.getElementById("tryout-title");
  if (titleEl) titleEl.textContent = `${selectedMapelLabel} — ${jenjang.toUpperCase()}`;

  const emptyEl = document.getElementById("tryout-empty");
  const questionArea = document.getElementById("tryout-question-area");
  const backBtn = document.getElementById("btn-back-step2");

  // Hide all initially
  if (emptyEl) emptyEl.style.display = "none";
  if (questionArea) questionArea.style.display = "none";
  if (backBtn) backBtn.style.display = "none";

  try {
    const response = await fetch(`data/bank-soal-template/${jenjang}/${mapelFile}.json`);
    if (!response.ok) throw new Error("Fetch failed");
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    // Start tryout
    startTryout(data);

  } catch (error) {
    console.error("Gagal memuat soal:", error);
    if (emptyEl) {
      emptyEl.querySelector("p").textContent = "Gagal memuat soal. Pastikan koneksi internetmu dan coba lagi.";
      emptyEl.style.display = "block";
    }
  }
}

// ==========================================
// START TRYOUT
// ==========================================
function startTryout(soalArray) {
  questions = [...soalArray];
  shuffleArray(questions);
  answers = {};
  currentIndex = 0;
  elapsedSeconds = 0;

  // Show question area
  document.getElementById("tryout-question-area").style.display = "block";
  document.getElementById("tryout-empty").style.display = "none";

  buildQuestionGrid();
  startTimer();
  renderQuestion(0);
}

// ==========================================
// RENDER QUESTION
// ==========================================
function renderQuestion(index) {
  const q = questions[index];
  if (!q) return;

  document.getElementById("tryout-q-number").textContent = `Soal Nomor ${index + 1}`;
  document.getElementById("tryout-question-number").textContent = `Soal ${index + 1} dari ${questions.length}`;
  document.getElementById("tryout-q-text").textContent = q.question;
  document.getElementById("tryout-opt-a").textContent = q.options.A;
  document.getElementById("tryout-opt-b").textContent = q.options.B;
  document.getElementById("tryout-opt-c").textContent = q.options.C;
  document.getElementById("tryout-opt-d").textContent = q.options.D;

  // Highlight selected
  const selected = answers[q.id] || null;
  document.querySelectorAll("#tryout-options .exam-option-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.option === selected);
  });

  // Progress
  const progress = ((index + 1) / questions.length) * 100;
  document.getElementById("tryout-progress").style.width = `${progress}%`;

  // Nav buttons
  document.getElementById("tryout-btn-prev").disabled = index === 0;
  const nextBtn = document.getElementById("tryout-btn-next");
  nextBtn.textContent = index === questions.length - 1 ? "Selesai ➡" : "Selanjutnya ➡";

  // Grid
  updateQuestionGrid();
}

// ==========================================
// SELECT ANSWER
// ==========================================
function selectAnswer(option) {
  const q = questions[currentIndex];
  if (!q) return;
  answers[q.id] = option;
  document.querySelectorAll("#tryout-options .exam-option-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.option === option);
  });
  updateQuestionGrid();
}

// ==========================================
// NAVIGATION
// ==========================================
function navigate(direction) {
  const newIndex = currentIndex + direction;
  if (newIndex < 0) return;
  if (newIndex >= questions.length) {
    finishTryout();
    return;
  }
  currentIndex = newIndex;
  renderQuestion(currentIndex);
}

function goToQuestion(index) {
  if (index >= 0 && index < questions.length) {
    currentIndex = index;
    renderQuestion(currentIndex);
  }
}

// ==========================================
// QUESTION GRID
// ==========================================
function buildQuestionGrid() {
  const grid = document.getElementById("tryout-grid");
  if (!grid) return;
  let html = "";
  questions.forEach((q, i) => {
    html += `<button class="grid-btn" data-index="${i}">${i + 1}</button>`;
  });
  grid.innerHTML = html;
  grid.querySelectorAll(".grid-btn").forEach(btn => {
    btn.addEventListener("click", () => goToQuestion(parseInt(btn.dataset.index)));
  });
}

function updateQuestionGrid() {
  const grid = document.getElementById("tryout-grid");
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
  stopTimer();
  elapsedSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
  const el = document.getElementById("tryout-timer");
  if (!el) return;
  const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const s = (elapsedSeconds % 60).toString().padStart(2, "0");
  el.textContent = `⏱ ${m}:${s}`;
}

// ==========================================
// FINISH TRYOUT
// ==========================================
function finishTryout() {
  const answeredCount = Object.keys(answers).length;
  const unanswered = questions.length - answeredCount;

  let msg = unanswered > 0
    ? `Kamu belum menjawab ${unanswered} soal. Yakin ingin menyelesaikan?`
    : "Yakin ingin menyelesaikan try out ini?";

  if (!confirm(msg)) return;

  stopTimer();
  renderHasil();
  showStep(4);
}

// ==========================================
// RENDER HASIL
// ==========================================
function renderHasil() {
  let correctCount = 0;
  let wrongCount = 0;

  questions.forEach(q => {
    const studentAnswer = answers[q.id] || "";
    if (studentAnswer === q.answer) correctCount++;
    else wrongCount++;
  });

  const total = questions.length;
  const score = Math.round((correctCount / total) * 100 * 100) / 100;

  // Summary
  document.getElementById("tryout-result-title").textContent = `${selectedMapelLabel} — ${selectedJenjang.toUpperCase()}`;
  document.getElementById("tryout-result-score").textContent = score;
  document.getElementById("tryout-result-correct").textContent = correctCount;
  document.getElementById("tryout-result-wrong").textContent = wrongCount;
  document.getElementById("tryout-result-total").textContent = total;
  const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const s = (elapsedSeconds % 60).toString().padStart(2, "0");
  document.getElementById("tryout-result-duration").textContent = `${m}:${s}`;

  // Answer review
  const container = document.getElementById("tryout-review-container");
  if (!container) return;

  let html = "";
  questions.forEach((q, index) => {
    const studentAnswer = answers[q.id] || "";
    const isCorrect = studentAnswer === q.answer;
    const statusClass = isCorrect ? "review-correct" : "review-wrong";
    const statusIcon = isCorrect ? "✅" : "❌";
    const studentLabel = studentAnswer || "Tidak dijawab";

    html += `
      <div class="review-item ${statusClass}">
        <div class="review-header">
          <span class="review-number">${statusIcon} Soal ${index + 1}</span>
          <span class="review-status">${isCorrect ? "Benar" : "Salah"}</span>
        </div>
        <p class="review-question">${q.question}</p>
        <div class="review-options">
          <div class="review-option ${q.answer === 'A' ? 'correct-answer' : ''} ${studentAnswer === 'A' && !isCorrect ? 'wrong-answer' : ''}">A. ${q.options.A}</div>
          <div class="review-option ${q.answer === 'B' ? 'correct-answer' : ''} ${studentAnswer === 'B' && !isCorrect ? 'wrong-answer' : ''}">B. ${q.options.B}</div>
          <div class="review-option ${q.answer === 'C' ? 'correct-answer' : ''} ${studentAnswer === 'C' && !isCorrect ? 'wrong-answer' : ''}">C. ${q.options.C}</div>
          <div class="review-option ${q.answer === 'D' ? 'correct-answer' : ''} ${studentAnswer === 'D' && !isCorrect ? 'wrong-answer' : ''}">D. ${q.options.D}</div>
        </div>
        <p class="review-answer-info">Jawaban kamu: <strong>${studentLabel}</strong> | Jawaban benar: <strong>${q.answer}</strong></p>
        ${q.explanation ? `<div class="review-explanation"><strong>Pembahasan:</strong> ${q.explanation}</div>` : ''}
      </div>
    `;
  });
  container.innerHTML = html;
}

// ==========================================
// RESET TRYOUT (Coba Lagi)
// ==========================================
function resetTryout() {
  startTryout(questions);
  showStep(3);
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
