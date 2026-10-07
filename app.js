const STORAGE_KEY = "tablasJuaniProgressV1";
const CHALLENGE_BEST_KEY = "tablasJuaniBestV1";

const state = {
  current: null,
  askedAt: null,
  practiceCorrect: 0,
  practiceWrong: 0,
  streak: 0,
  challenge: {
    active: false,
    timeLeft: 60,
    correct: 0,
    wrong: 0,
    timerId: null,
    current: null
  }
};

function keyFor(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}x${y}`;
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function getRecord(a, b) {
  const progress = loadProgress();
  return progress[keyFor(a, b)] || {
    a: Math.min(a, b),
    b: Math.max(a, b),
    attempts: 0,
    correct: 0,
    wrong: 0,
    fastCorrect: 0,
    avgMs: 0,
    lastSeen: 0
  };
}

function updateRecord(a, b, isCorrect, elapsedMs) {
  const progress = loadProgress();
  const key = keyFor(a, b);
  const rec = progress[key] || {
    a: Math.min(a, b),
    b: Math.max(a, b),
    attempts: 0,
    correct: 0,
    wrong: 0,
    fastCorrect: 0,
    avgMs: 0,
    lastSeen: 0
  };

  rec.attempts += 1;

  if (isCorrect) {
    rec.correct += 1;
    if (elapsedMs <= 3000) rec.fastCorrect += 1;
  } else {
    rec.wrong += 1;
  }

  rec.avgMs = rec.avgMs === 0
    ? elapsedMs
    : Math.round(((rec.avgMs * (rec.attempts - 1)) + elapsedMs) / rec.attempts);

  rec.lastSeen = Date.now();
  progress[key] = rec;
  saveProgress(progress);
}

function classify(rec) {
  if (!rec || rec.attempts === 0) return "new";

  const accuracy = rec.correct / rec.attempts;
  const fastRate = rec.fastCorrect / rec.attempts;

  if (rec.attempts >= 4 && accuracy >= 0.9 && fastRate >= 0.6) return "easy";
  if (accuracy >= 0.65) return "medium";
  return "hard";
}

function weightFor(rec) {
  const cls = classify(rec);

  if (cls === "new") return 4;
  if (cls === "hard") return 8;
  if (cls === "medium") return 5;
  return 1;
}

function parseTables() {
  const select = document.getElementById("tableRange");
  const value = select.value;

  if (value === "custom") {
    const raw = document.getElementById("customTables").value;
    const parsed = raw
      .split(",")
      .map(v => Number(v.trim()))
      .filter(v => Number.isInteger(v) && v >= 1 && v <= 12);

    return [...new Set(parsed)].length ? [...new Set(parsed)] : [6, 7, 8];
  }

  const [min, max] = value.split("-").map(Number);
  const result = [];
  for (let n = min; n <= max; n++) result.push(n);
  return result;
}

function buildPool() {
  const tables = parseTables();
  const pool = [];

  for (const a of tables) {
    for (let b = 2; b <= 10; b++) {
      if (a > b && tables.includes(b)) continue;
      pool.push({ a, b });
    }
  }

  return pool;
}

function pickAdaptiveQuestion() {
  const pool = buildPool();
  const weighted = [];

  for (const item of pool) {
    const rec = getRecord(item.a, item.b);
    const weight = weightFor(rec);

    for (let i = 0; i < weight; i++) weighted.push(item);
  }

  if (!weighted.length) return { a: 7, b: 8 };
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function setDifficultyBadge(a, b) {
  const rec = getRecord(a, b);
  const cls = classify(rec);
  const badge = document.getElementById("difficultyBadge");

  const labels = {
    new: "Nueva",
    easy: "Aprendida",
    medium: "Dudosa",
    hard: "Difícil"
  };

  badge.textContent = labels[cls];
  badge.className = `badge ${cls === "new" ? "neutral" : cls}`;
}

function nextPracticeQuestion() {
  state.current = pickAdaptiveQuestion();
  state.askedAt = performance.now();

  document.getElementById("question").textContent = `${state.current.a} × ${state.current.b}`;
  setDifficultyBadge(state.current.a, state.current.b);

  const input = document.getElementById("answerInput");
  input.value = "";
  input.focus();
}

function showFeedback(elementId, message, ok) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `feedback ${ok ? "ok" : "bad"}`;
}

document.getElementById("answerForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const input = document.getElementById("answerInput");
  const answer = Number(input.value);
  if (!Number.isFinite(answer)) return;

  const expected = state.current.a * state.current.b;
  const elapsed = Math.round(performance.now() - state.askedAt);
  const ok = answer === expected;

  updateRecord(state.current.a, state.current.b, ok, elapsed);

  if (ok) {
    state.practiceCorrect += 1;
    state.streak += 1;

    const fastText = elapsed <= 3000 ? " ¡Y rápido!" : "";
    showFeedback("feedback", `✅ Correcto.${fastText}`, true);
  } else {
    state.practiceWrong += 1;
    state.streak = 0;
    showFeedback(
      "feedback",
      `❌ Era ${expected}. Esta cuenta aparecerá más seguido.`,
      false
    );
  }

  document.getElementById("practiceCorrect").textContent = state.practiceCorrect;
  document.getElementById("practiceWrong").textContent = state.practiceWrong;
  document.getElementById("practiceStreak").textContent = state.streak;

  setTimeout(nextPracticeQuestion, ok ? 650 : 1300);
});

document.getElementById("tableRange").addEventListener("change", (event) => {
  document
    .getElementById("customTablesWrap")
    .classList.toggle("hidden", event.target.value !== "custom");
  nextPracticeQuestion();
});

document.getElementById("customTables").addEventListener("change", nextPracticeQuestion);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById(tab.dataset.view).classList.add("active");

    if (tab.dataset.view === "progress") renderProgress();
  });
});

function randomChallengeQuestion() {
  const pool = buildPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function nextChallengeQuestion() {
  state.challenge.current = randomChallengeQuestion();
  document.getElementById("challengeQuestion").textContent =
    `${state.challenge.current.a} × ${state.challenge.current.b}`;

  const input = document.getElementById("challengeInput");
  input.value = "";
  input.focus();

  state.challenge.askedAt = performance.now();
}

function updateChallengeUI() {
  document.getElementById("timer").textContent = state.challenge.timeLeft;
  document.getElementById("challengeCorrect").textContent = state.challenge.correct;
  document.getElementById("challengeWrong").textContent = state.challenge.wrong;
  document.getElementById("bestScore").textContent =
    Number(localStorage.getItem(CHALLENGE_BEST_KEY) || 0);
}

function finishChallenge() {
  clearInterval(state.challenge.timerId);
  state.challenge.active = false;

  document.getElementById("challengeInput").disabled = true;
  document.getElementById("challengeSubmit").disabled = true;
  document.getElementById("startChallengeBtn").disabled = false;

  const best = Number(localStorage.getItem(CHALLENGE_BEST_KEY) || 0);
  const currentScore = state.challenge.correct;

  if (currentScore > best) {
    localStorage.setItem(CHALLENGE_BEST_KEY, currentScore);
    showFeedback("challengeFeedback", `🏆 ¡Nuevo récord! ${currentScore} correctas.`, true);
  } else {
    showFeedback(
      "challengeFeedback",
      `Tiempo. Lograste ${currentScore} correctas. Récord: ${best}.`,
      true
    );
  }

  document.getElementById("challengeQuestion").textContent = "¡Tiempo!";
  updateChallengeUI();
}

document.getElementById("startChallengeBtn").addEventListener("click", () => {
  clearInterval(state.challenge.timerId);

  state.challenge.active = true;
  state.challenge.timeLeft = 60;
  state.challenge.correct = 0;
  state.challenge.wrong = 0;

  document.getElementById("challengeInput").disabled = false;
  document.getElementById("challengeSubmit").disabled = false;
  document.getElementById("startChallengeBtn").disabled = true;
  document.getElementById("challengeFeedback").textContent = "";

  nextChallengeQuestion();
  updateChallengeUI();

  state.challenge.timerId = setInterval(() => {
    state.challenge.timeLeft -= 1;
    updateChallengeUI();

    if (state.challenge.timeLeft <= 0) finishChallenge();
  }, 1000);
});

document.getElementById("challengeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.challenge.active) return;

  const input = document.getElementById("challengeInput");
  const answer = Number(input.value);
  if (!Number.isFinite(answer)) return;

  const q = state.challenge.current;
  const expected = q.a * q.b;
  const elapsed = Math.round(performance.now() - state.challenge.askedAt);
  const ok = answer === expected;

  updateRecord(q.a, q.b, ok, elapsed);

  if (ok) {
    state.challenge.correct += 1;
    showFeedback("challengeFeedback", "✅", true);
  } else {
    state.challenge.wrong += 1;
    showFeedback("challengeFeedback", `❌ ${expected}`, false);
  }

  updateChallengeUI();
  nextChallengeQuestion();
});

function renderProgress() {
  const progress = loadProgress();
  const entries = Object.values(progress);

  const totalAttempts = entries.reduce((sum, r) => sum + r.attempts, 0);
  const totalCorrect = entries.reduce((sum, r) => sum + r.correct, 0);
  const mastered = entries.filter(r => classify(r) === "easy").length;

  document.getElementById("totalAnswers").textContent = totalAttempts;
  document.getElementById("overallAccuracy").textContent =
    totalAttempts ? `${Math.round((totalCorrect / totalAttempts) * 100)}%` : "0%";
  document.getElementById("masteredCount").textContent = mastered;

  const grid = document.getElementById("progressGrid");
  grid.innerHTML = "";

  const all = [];
  for (let a = 2; a <= 10; a++) {
    for (let b = a; b <= 10; b++) {
      const rec = progress[keyFor(a, b)] || {
        a,
        b,
        attempts: 0,
        correct: 0,
        wrong: 0,
        fastCorrect: 0,
        avgMs: 0
      };
      all.push(rec);
    }
  }

  const order = { hard: 0, medium: 1, new: 2, easy: 3 };

  all.sort((x, y) => {
    const cx = classify(x);
    const cy = classify(y);
    if (order[cx] !== order[cy]) return order[cx] - order[cy];
    return (x.a * x.b) - (y.a * y.b);
  });

  for (const rec of all) {
    const cls = classify(rec);
    const icons = {
      easy: "✅",
      medium: "🟡",
      hard: "🔴",
      new: "⚪"
    };

    const accuracy = rec.attempts
      ? Math.round((rec.correct / rec.attempts) * 100)
      : 0;

    const item = document.createElement("div");
    item.className = "progress-item";

    item.innerHTML = `
      <strong>${icons[cls]} ${rec.a} × ${rec.b} = ${rec.a * rec.b}</strong>
      <small>
        ${rec.attempts ? `${accuracy}% · ${rec.attempts} intentos · ${Math.round(rec.avgMs / 100) / 10}s promedio` : "Todavía no practicada"}
      </small>
    `;

    grid.appendChild(item);
  }
}

document.getElementById("resetProgressBtn").addEventListener("click", () => {
  const confirmed = confirm("¿Seguro que querés borrar todo el progreso guardado?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHALLENGE_BEST_KEY);

  state.practiceCorrect = 0;
  state.practiceWrong = 0;
  state.streak = 0;

  document.getElementById("practiceCorrect").textContent = "0";
  document.getElementById("practiceWrong").textContent = "0";
  document.getElementById("practiceStreak").textContent = "0";
  document.getElementById("bestScore").textContent = "0";

  renderProgress();
  nextPracticeQuestion();
});

nextPracticeQuestion();
updateChallengeUI();
