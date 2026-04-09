/**
 * TypeRacer — script.js
 * A full-featured typing speed test with real-time WPM,
 * accuracy, mistake tracking, dark mode, and error sounds.
 */

/* ============================================================
   1.  PARAGRAPH POOL
   ============================================================ */
const PARAGRAPHS = [
  "The quick brown fox jumps over the lazy dog near the riverbank, while birds chirped softly in the morning breeze and sunlight filtered through the rustling leaves of ancient oak trees.",
  "Coding is the art of telling a story with logic. Every function serves a purpose, every variable holds meaning, and the elegance of a solution often lies in its simplicity and clarity.",
  "Space exploration has always captured human imagination. From the first footsteps on the moon to the rovers exploring Mars, each mission expands our understanding of the universe and our place within it.",
  "A good book is a portal to another world. The pages carry you through distant lands, complex emotions, and extraordinary adventures that leave a lasting impression long after the final chapter is closed.",
  "The invention of the internet transformed modern civilization. Information that once required hours in a library can now be found in seconds, changing how we learn, communicate, and experience everyday life.",
  "Music transcends language and culture, speaking directly to the human soul. A melody can evoke memories, inspire courage, or bring comfort during the darkest hours of one's life.",
  "Mountains stand as silent witnesses to the passage of time. Their snow-capped peaks pierce the clouds, and their valleys cradle rivers and forests that have thrived for thousands of years.",
  "Artificial intelligence is reshaping industries at a breathtaking pace. Machines now recognize speech, generate art, and drive vehicles, blurring the line between human creativity and computational power.",
  "The ocean covers more than seventy percent of the Earth's surface, yet vast portions remain unexplored. Its depths harbor creatures and ecosystems that challenge our understanding of life itself.",
  "Cooking is a form of love expressed through flavors and aromas. A well-prepared meal brings people together, sparking conversations and creating memories around a shared table.",
  "Philosophy teaches us to question assumptions and examine the foundations of our beliefs. Through reason and dialogue, thinkers across the ages have sought truth, justice, and the good life.",
  "Climate change presents one of the greatest challenges of our era. Rising temperatures, melting glaciers, and shifting weather patterns demand urgent and collective action from every nation on Earth.",
  "The Renaissance was a period of remarkable cultural rebirth in Europe. Artists, scientists, and thinkers challenged medieval traditions, laying the groundwork for the modern world we inhabit today.",
  "Running a marathon requires months of disciplined training, mental fortitude, and physical endurance. Each stride is a negotiation between the desire to stop and the will to keep moving forward.",
  "Typography is the invisible art of written communication. The choice of font, spacing, and layout profoundly influences how a message is perceived, felt, and ultimately remembered by the reader.",
];

/* ============================================================
   2.  STATE
   ============================================================ */
let currentParagraph = "";    // full text for the current test
let timerInterval   = null;   // setInterval handle
let timeLeft        = 60;     // countdown seconds
let hasStarted      = false;  // has the user begun typing
let totalTyped      = 0;      // total characters entered (including corrections)
let correctChars    = 0;      // correctly matched characters (current position)
let mistakes        = 0;      // total mistake events
let currentIndex    = 0;      // cursor position in the paragraph

/* ============================================================
   3.  DOM REFERENCES
   ============================================================ */
const paragraphTextEl  = document.getElementById("paragraphText");
const typingInput      = document.getElementById("typingInput");
const timerDisplay     = document.getElementById("timerDisplay");
const wpmDisplay       = document.getElementById("wpmDisplay");
const mistakesDisplay  = document.getElementById("mistakesDisplay");
const statTimer        = document.getElementById("statTimer");
const restartBtn       = document.getElementById("restartBtn");
const resultsOverlay   = document.getElementById("resultsOverlay");
const finalWpm         = document.getElementById("finalWpm");
const finalAccuracy    = document.getElementById("finalAccuracy");
const finalMistakes    = document.getElementById("finalMistakes");
const finalChars       = document.getElementById("finalChars");
const modalRestartBtn  = document.getElementById("modalRestartBtn");
const themeToggle      = document.getElementById("themeToggle");
const themeIcon        = themeToggle.querySelector(".theme-icon");

/* ============================================================
   4.  AUDIO — error beep (Web Audio API, no external files)
   ============================================================ */
let audioCtx = null;

/**
 * Play a short error tone using the Web Audio API.
 */
function playErrorSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = "square";
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    // Silently ignore if AudioContext is unavailable
  }
}

/* ============================================================
   5.  DARK MODE TOGGLE
   ============================================================ */
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("typerTheme", theme);
}

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// Restore saved preference
(function initTheme() {
  const saved = localStorage.getItem("typerTheme") || "dark";
  applyTheme(saved);
})();

/* ============================================================
   6.  PARAGRAPH INITIALISATION
   ============================================================ */
/**
 * Pick a random paragraph (different from the last one),
 * wrap every character in a <span class="char">, and render it.
 */
function loadParagraph() {
  // Avoid repeating the same paragraph consecutively
  let newPara;
  do {
    newPara = PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
  } while (newPara === currentParagraph && PARAGRAPHS.length > 1);

  currentParagraph = newPara;

  // Build character spans
  paragraphTextEl.innerHTML = currentParagraph
    .split("")
    .map((ch, i) => {
      const cls = i === 0 ? "char current" : "char";
      // Spaces need a special non-breaking space or visible placeholder
      const display = ch === " " ? "&nbsp;" : ch;
      return `<span class="${cls}" data-index="${i}">${display}</span>`;
    })
    .join("");
}

/* ============================================================
   7.  RESET / RESTART
   ============================================================ */
function resetTest() {
  // Stop any running timer
  clearInterval(timerInterval);
  timerInterval = null;

  // Reset state
  timeLeft      = 60;
  hasStarted    = false;
  totalTyped    = 0;
  correctChars  = 0;
  mistakes      = 0;
  currentIndex  = 0;

  // Reset displays
  timerDisplay.textContent   = "60";
  wpmDisplay.textContent     = "0";
  mistakesDisplay.textContent = "0";
  statTimer.classList.remove("danger");

  // Re-enable input and clear it
  typingInput.value    = "";
  typingInput.disabled = false;
  typingInput.focus();

  // Hide results
  resultsOverlay.classList.remove("show");

  // Load fresh paragraph
  loadParagraph();
}

/* ============================================================
   8.  TIMER
   ============================================================ */
function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    // Danger zone styling when ≤ 10 s
    if (timeLeft <= 10) {
      statTimer.classList.add("danger");
    }

    if (timeLeft <= 0) {
      endTest();
    }
  }, 1000);
}

/* ============================================================
   9.  LIVE WPM CALCULATION
   ============================================================ */
/**
 * Standard typing WPM = (correct characters / 5) / elapsed minutes.
 * We count only correctly typed characters (at the current position).
 */
function calcWpm() {
  const elapsedMinutes = (60 - timeLeft) / 60;
  if (elapsedMinutes <= 0) return 0;
  const wordsTyped = correctChars / 5;
  return Math.round(wordsTyped / elapsedMinutes);
}

/* ============================================================
   10. INPUT HANDLER
   ============================================================ */
typingInput.addEventListener("input", handleInput);

function handleInput() {
  const typedValue = typingInput.value;

  // Guard: ignore if test is over
  if (!typingInput.disabled === false) return;

  // Start timer on first keystroke
  if (!hasStarted) {
    hasStarted = true;
    startTimer();
  }

  // Current character being evaluated = length of what's been typed
  const typedLen = typedValue.length;

  // Walk all character spans and classify them
  const spans = paragraphTextEl.querySelectorAll(".char");

  // Reset all span classes first
  spans.forEach((span, i) => {
    span.className = "char"; // clear correct/wrong/current
  });

  // Apply state to each position
  let localCorrect = 0;

  for (let i = 0; i < typedLen && i < spans.length; i++) {
    const typedChar = typedValue[i];
    const expected  = currentParagraph[i];

    if (typedChar === expected) {
      spans[i].classList.add("correct");
      localCorrect++;
    } else {
      spans[i].classList.add("wrong");
    }
  }

  // Mark the "current" cursor position
  if (typedLen < spans.length) {
    spans[typedLen].classList.add("current");
  }

  // Detect new mistake: compare previous correct count
  // A mistake event = any wrong character on the active position
  if (typedLen > 0 && typedLen <= spans.length) {
    const lastTyped    = typedValue[typedLen - 1];
    const lastExpected = currentParagraph[typedLen - 1];

    if (lastTyped !== lastExpected) {
      mistakes++;
      mistakesDisplay.textContent = mistakes;

      // Shake the mistakes counter
      const statMistakesEl = document.getElementById("statMistakes");
      statMistakesEl.classList.remove("shake");
      void statMistakesEl.offsetWidth; // force reflow
      statMistakesEl.classList.add("shake");

      // Error sound
      playErrorSound();
    }
  }

  // Update tracked values
  correctChars  = localCorrect;
  totalTyped    = typedLen;
  currentIndex  = typedLen;

  // Live WPM update
  const wpm = calcWpm();
  const wpmEl = document.getElementById("statWpm");
  wpmDisplay.textContent = wpm;
  wpmEl.classList.remove("bump");
  void wpmEl.offsetWidth;
  wpmEl.classList.add("bump");

  // Auto-end when paragraph is fully and correctly typed
  if (typedLen === currentParagraph.length) {
    endTest();
  }
}

/* ============================================================
   11. PREVENT PASTE
   ============================================================ */
typingInput.addEventListener("paste", (e) => {
  e.preventDefault();
});

/* ============================================================
   12. END TEST
   ============================================================ */
function endTest() {
  clearInterval(timerInterval);
  timerInterval = null;
  typingInput.disabled = true;

  // Final calculations
  const finalWpmVal = calcWpm();

  // Accuracy: correct characters typed / total characters typed * 100
  const accuracyVal = totalTyped === 0
    ? 100
    : Math.round((correctChars / totalTyped) * 100);

  // Populate results modal
  finalWpm.textContent      = finalWpmVal;
  finalAccuracy.textContent = accuracyVal + "%";
  finalMistakes.textContent = mistakes;
  finalChars.textContent    = totalTyped;

  // Show modal with a slight delay for visual polish
  setTimeout(() => {
    resultsOverlay.classList.add("show");
  }, 300);
}

/* ============================================================
   13. RESTART BUTTONS
   ============================================================ */
restartBtn.addEventListener("click", resetTest);
modalRestartBtn.addEventListener("click", resetTest);

/* ============================================================
   14. KEYBOARD SHORTCUT — Tab to restart
   ============================================================ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    resetTest();
  }
});

/* ============================================================
   15. INIT
   ============================================================ */
window.addEventListener("DOMContentLoaded", resetTest);