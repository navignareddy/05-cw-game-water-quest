/* =====================================================
   Water Quest — charity: water
   Improved version with difficulty modes, pause, combo,
   best score, and stronger DOM interactions.
===================================================== */

const GAME_CONFIG = {
  easy: {
    label: 'Easy',
    goal: 18,
    duration: 40,
    spawnMs: 1100,
    dirtyChance: 0.12,
  },
  normal: {
    label: 'Normal',
    goal: 25,
    duration: 30,
    spawnMs: 900,
    dirtyChance: 0.20,
  },
  hard: {
    label: 'Hard',
    goal: 32,
    duration: 24,
    spawnMs: 700,
    dirtyChance: 0.30,
  },
};

const MILESTONES = {
  5:  '💧 5 cans collected!',
  10: '🌊 Halfway there!',
  15: '⚡ Strong progress!',
  20: '🔥 Almost done!',
  25: '🎯 Final stretch!',
  30: '🏆 Incredible speed!',
};

const GRID_SIZE = 9;
const CAN_LIFESPAN = 1300;

let mode = 'normal';
let config = GAME_CONFIG[mode];

let currentCans = 0;
let score = 0;
let bestScore = Number(localStorage.getItem('waterQuestBest') || 0);
let timeLeft = config.duration;
let gameActive = false;
let paused = false;
let spawnInterval = null;
let timerInterval = null;
let canTimers = [];
let milestonesHit = new Set();
let currentSpawnDelay = config.spawnMs;
let combo = 0;

const cansEl = document.getElementById('current-cans');
const goalCountEl = document.getElementById('goal-count');
const goalTextEl = document.getElementById('goal-text');
const timerEl = document.getElementById('timer');
const scoreEl = document.getElementById('score-display');
const bestScoreEl = document.getElementById('best-score');
const progressFill = document.getElementById('progress-fill');
const achievement = document.getElementById('achievement');
const feedbackMsg = document.getElementById('feedback-msg');
const milestoneStrip = document.getElementById('milestone-strip');
const grid = document.getElementById('game-grid');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const statusLine = document.getElementById('status-line');
const modeSwitcher = document.getElementById('mode-switcher');

bestScoreEl.textContent = bestScore;

function createGrid() {
  grid.innerHTML = '';
  for (let i = 0; i < GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }
}
createGrid();

function getEmptyCells() {
  return [...grid.querySelectorAll('.grid-cell')].filter(cell => cell.children.length === 0);
}

function updateModeUI() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  config = GAME_CONFIG[mode];
  goalCountEl.textContent = config.goal;
  goalTextEl.textContent = `${config.goal} cans`;
}

function setStatusLine(msg) {
  statusLine.textContent = msg;
}

function updateProgress() {
  const pct = Math.min(100, (currentCans / config.goal) * 100);
  progressFill.style.width = `${pct}%`;
}

function showFeedback(text, type) {
  feedbackMsg.textContent = text;
  feedbackMsg.className = `feedback-msg feedback-${type}`;
  feedbackMsg.style.display = 'block';
  clearTimeout(showFeedback._timer);
  showFeedback._timer = setTimeout(() => {
    feedbackMsg.style.display = 'none';
  }, 1200);
}

function showAchievement(msg) {
  achievement.textContent = msg;
  achievement.style.display = 'block';
  clearTimeout(showAchievement._timer);
  showAchievement._timer = setTimeout(() => {
    achievement.style.display = 'none';
  }, 2000);
}

function addMilestoneChip(text) {
  const chip = document.createElement('span');
  chip.className = 'milestone-chip';
  chip.textContent = text;
  milestoneStrip.appendChild(chip);

  setTimeout(() => {
    chip.classList.add('fade-out');
    setTimeout(() => chip.remove(), 250);
  }, 1100);
}

function spawnScoreFloat(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'score-float';
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function flashCell(cell, type) {
  cell.classList.add(`cell-flash-${type}`);
  setTimeout(() => {
    cell.classList.remove(`cell-flash-${type}`, 'cell-flash-good', 'cell-flash-bad');
  }, 280);
}

function removeItem(cell, item) {
  item.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
  item.style.transform = 'scale(0)';
  item.style.opacity = '0';
  setTimeout(() => {
    if (cell.contains(item)) cell.removeChild(item);
  }, 150);
}

function createBurst(cell, type) {
  const burst = document.createElement('div');
  burst.className = `burst burst-${type}`;
  burst.textContent = type === 'good' ? '💧' : '⚠️';
  cell.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

function getMotivation() {
  const left = config.goal - currentCans;
  if (left > 15) return '💧 Tap the yellow jerry cans!';
  if (left > 8)  return `⚡ ${left} more cans to go!`;
  if (left > 3)  return `🔥 Almost there — ${left} cans left!`;
  return `🚰 Final push — ${left} cans!`;
}

function restartSpawn() {
  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnItem, currentSpawnDelay);
}

function adjustSpawnRate() {
  currentSpawnDelay = Math.max(450, config.spawnMs - currentCans * 12);
  restartSpawn();
}

function spawnItem() {
  if (!gameActive || paused) return;

  const emptyCells = getEmptyCells();
  if (emptyCells.length === 0) return;

  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const isDirty = Math.random() < config.dirtyChance;

  const item = document.createElement('div');
  item.className = `can-item ${isDirty ? 'dirty' : 'clean'}`;

  const emoji = document.createElement('div');
  emoji.className = 'can-emoji';
  emoji.textContent = isDirty ? '🪣' : '🟡';

  const label = document.createElement('div');
  label.className = 'can-label';
  label.textContent = isDirty ? 'DIRTY' : 'CLEAN';

  item.appendChild(emoji);
  item.appendChild(label);
  cell.appendChild(item);

  item.addEventListener('pointerdown', e => {
    e.preventDefault();
    handleClick(e, cell, item, isDirty);
  });

  const t = setTimeout(() => {
    if (cell.contains(item)) removeItem(cell, item);
  }, CAN_LIFESPAN);
  canTimers.push(t);
}

function handleClick(e, cell, item, isDirty) {
  if (!gameActive || paused) return;
  if (item.dataset.hit === '1') return;
  item.dataset.hit = '1';

  const x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || window.innerWidth / 2;
  const y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || window.innerHeight / 2;

  if (isDirty) {
    combo = 0;
    score = Math.max(0, score - 2);
    scoreEl.textContent = score;
    flashCell(cell, 'bad');
    createBurst(cell, 'bad');
    showFeedback('⚠️ Dirty water! −2 points', 'bad');
    spawnScoreFloat(x, y, '−2', '#F5402C');
    setStatusLine('Avoid the dirty water!');
  } else {
    currentCans++;
    combo++;
    score += 1;

    let comboBonus = 0;
    if (combo >= 3 && combo % 3 === 0) {
      comboBonus = 2;
      score += comboBonus;
    }

    cansEl.textContent = currentCans;
    scoreEl.textContent = score;
    updateProgress();
    flashCell(cell, 'good');
    createBurst(cell, 'good');

    if (comboBonus > 0) {
      showFeedback(`💥 Combo x${combo}! +${1 + comboBonus}`, 'good');
      spawnScoreFloat(x, y, `+${1 + comboBonus}`, '#FF902A');
    } else {
      showFeedback('💧 +1 Clean Can!', 'good');
      spawnScoreFloat(x, y, '+1', '#FFC907');
    }

    showAchievement(MILESTONES[currentCans] || `Nice! ${currentCans} cans collected.`);
    if (MILESTONES[currentCans]) addMilestoneChip(MILESTONES[currentCans]);

    setStatusLine(getMotivation());

    if (currentCans >= config.goal) {
      setTimeout(() => endGame(true), 80);
      return;
    }

    adjustSpawnRate();
  }

  removeItem(cell, item);
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (paused) return;

    timeLeft--;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 10) {
      timerEl.classList.add('timer-urgent');
    }

    if (timeLeft <= 0) {
      endGame(false);
    }
  }, 1000);
}

function clearBoardTimers() {
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  canTimers.forEach(clearTimeout);
  canTimers = [];
}

function resetStateValues() {
  currentCans = 0;
  score = 0;
  timeLeft = config.duration;
  gameActive = false;
  paused = false;
  combo = 0;
  currentSpawnDelay = config.spawnMs;
  milestonesHit = new Set();
}

function resetUI() {
  cansEl.textContent = 0;
  timerEl.textContent = config.duration;
  scoreEl.textContent = 0;
  timerEl.classList.remove('timer-urgent');
  progressFill.style.width = '0%';
  achievement.style.display = 'none';
  feedbackMsg.style.display = 'none';
  milestoneStrip.innerHTML = '';
  setStatusLine('Tap Start to begin your mission!');
  pauseBtn.style.display = 'none';
  pauseBtn.textContent = 'Pause';
  resetBtn.style.display = 'none';
  startBtn.textContent = 'Start Game';
  startBtn.disabled = false;
  document.querySelector('.result-overlay')?.remove();
}

function disableModeButtons(disabled) {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

function startGame() {
  clearBoardTimers();
  createGrid();
  resetStateValues();
  updateModeUI();

  gameActive = true;
  paused = false;
  startBtn.disabled = true;
  pauseBtn.style.display = 'inline-block';
  resetBtn.style.display = 'inline-block';
  disableModeButtons(true);

  cansEl.textContent = 0;
  timerEl.textContent = config.duration;
  scoreEl.textContent = 0;
  setStatusLine('💧 Tap the yellow jerry cans!');
  progressFill.style.width = '0%';

  spawnItem();
  restartSpawn();
  startTimer();
}

function pauseGame() {
  if (!gameActive) return;

  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';

  if (paused) {
    setStatusLine('Game paused. Press Resume to continue.');
    clearInterval(spawnInterval);
  } else {
    setStatusLine(getMotivation());
    restartSpawn();
  }
}

function endGame(won) {
  gameActive = false;
  paused = false;
  clearBoardTimers();
  grid.innerHTML = '';
  createGrid();

  startBtn.disabled = false;
  startBtn.textContent = 'Play Again';
  pauseBtn.style.display = 'none';
  resetBtn.style.display = 'inline-block';
  disableModeButtons(false);

  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';

  if (won) {
    overlay.innerHTML = `
      <div class="result-icon">🎉</div>
      <div class="result-title win">MISSION COMPLETE!</div>
      <p class="result-msg">
        You collected all <strong>${config.goal}</strong> jerry cans!<br>
        Final score: <strong>${score}</strong>
      </p>
    `;
    setStatusLine('Amazing work — clean water for all! 🌍');
    launchConfetti();
  } else {
    const emoji = currentCans >= 20 ? '💪' : currentCans >= 10 ? '💧' : '🪣';
    overlay.innerHTML = `
      <div class="result-icon">${emoji}</div>
      <div class="result-title lose">TIME'S UP!</div>
      <p class="result-msg">
        You collected <strong>${currentCans} / ${config.goal}</strong> cans.<br>
        Score: <strong>${score}</strong>
      </p>
    `;
    setStatusLine('Hit Play Again to try once more!');
  }

  grid.before(overlay);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('waterQuestBest', String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
}

function resetGame() {
  clearBoardTimers();
  resetStateValues();
  updateModeUI();
  resetUI();
  createGrid();
}

function checkModeChange(newMode) {
  mode = newMode;
  updateModeUI();

  if (gameActive) {
    resetGame();
  } else {
    resetUI();
  }
}

modeSwitcher.addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  checkModeChange(btn.dataset.mode);
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
resetBtn.addEventListener('click', resetGame);

document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') {
    resetGame();
  }
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (gameActive) pauseGame();
  }
  if (e.key === 'Enter' && !gameActive) {
    startGame();
  }
});

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#FFC907', '#2E9DF7', '#4FCB53', '#FF902A', '#8BD1CB', '#F5402C', '#ffffff'];
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.5,
    w: 6 + Math.random() * 9,
    h: 10 + Math.random() * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2.5 + Math.random() * 3.5,
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 9,
    opacity: 1,
  }));

  let rafId;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach(p => {
      if (p.opacity <= 0) return;
      alive = true;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.vy += 0.07;

      if (p.y > canvas.height) p.opacity -= 0.06;
    });

    if (alive) {
      rafId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  })();

  setTimeout(() => {
    cancelAnimationFrame(rafId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 4000);
}

updateModeUI();
resetUI();
