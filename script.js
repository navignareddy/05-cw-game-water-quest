/* =====================================================
   Water Quest — charity: water
   Single-page card layout game logic
===================================================== */

const GOAL_CANS     = 25;
const GAME_DURATION = 30;
const GRID_SIZE     = 9;
const BASE_SPAWN_MS = 900;
const CAN_LIFESPAN  = 1300; // ms before can disappears on its own

const MILESTONES = {
  5:  '💧 5 Cans! Keep it up!',
  10: '🌊 Halfway there!',
  15: '⚡ 15 Cans! Amazing!',
  20: '🔥 Almost done — push it!',
};

let currentCans   = 0;
let score         = 0;
let timeLeft      = GAME_DURATION;
let gameActive    = false;
let spawnInterval = null;
let timerInterval = null;
let canTimers     = [];
let milestonesHit = new Set();
let spawnDelay    = BASE_SPAWN_MS;

const cansEl       = document.getElementById('current-cans');
const timerEl      = document.getElementById('timer');
const scoreEl      = document.getElementById('score-display');
const progressFill = document.getElementById('progress-fill');
const achievement  = document.getElementById('achievement');
const feedbackMsg  = document.getElementById('feedback-msg');
const grid         = document.getElementById('game-grid');
const startBtn     = document.getElementById('start-btn');
const resetBtn     = document.getElementById('reset-btn');
const statusLine   = document.getElementById('status-line');

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
  return [...grid.querySelectorAll('.grid-cell')].filter(c => c.children.length === 0);
}

function spawnItem() {
  if (!gameActive) return;
  const empty = getEmptyCells();
  if (empty.length === 0) return;

  const cell    = empty[Math.floor(Math.random() * empty.length)];
  const isDirty = Math.random() < 0.20; // 20% chance obstacle

  const item = document.createElement('div');
  item.className = `can-item ${isDirty ? 'dirty' : 'clean'}`;

  const emoji = document.createElement('div');
  emoji.className = 'can-emoji';
  emoji.textContent = isDirty ? '🪣' : '🟡';

  const label = document.createElement('div');
  label.className = 'can-label';
  label.textContent = isDirty ? 'DIRTY!' : 'CLEAN';

  item.appendChild(emoji);
  item.appendChild(label);
  cell.appendChild(item);

  item.addEventListener('click', e => handleClick(e, cell, item, isDirty));
  item.addEventListener('touchstart', e => { e.preventDefault(); handleClick(e.changedTouches[0], cell, item, isDirty); }, { passive: false });

  const t = setTimeout(() => {
    if (cell.contains(item)) removeItem(cell, item);
  }, CAN_LIFESPAN);
  canTimers.push(t);
}

function removeItem(cell, item) {
  item.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
  item.style.transform  = 'scale(0)';
  item.style.opacity    = '0';
  setTimeout(() => { if (cell.contains(item)) cell.removeChild(item); }, 150);
}

function handleClick(e, cell, item, isDirty) {
  if (!gameActive) return;

  item.style.pointerEvents = 'none';

  if (isDirty) {
    score = Math.max(0, score - 2);
    scoreEl.textContent = score;
    flashCell(cell, 'bad');
    showFeedback('⚠️ Dirty water! −2 points', 'bad');
    spawnScoreFloat(e.clientX, e.clientY, '−2', '#F5402C');
    setStatusLine('Avoid the dirty water!');
  } else {
    currentCans++;
    score++;
    cansEl.textContent  = currentCans;
    scoreEl.textContent = score;
    updateProgress();
    flashCell(cell, 'good');
    showFeedback('💧 +1 Clean Can!', 'good');
    spawnScoreFloat(e.clientX, e.clientY, '+1', '#FFC907');
    checkMilestone(currentCans);
    setStatusLine(getMotivation());

    if (currentCans >= GOAL_CANS) {
      setTimeout(() => endGame(true), 80);
      return;
    }
  }

  removeItem(cell, item);
}

let feedbackTimer;
function showFeedback(text, type) {
  clearTimeout(feedbackTimer);
  feedbackMsg.textContent = text;
  feedbackMsg.className   = `feedback-msg feedback-${type}`;
  feedbackMsg.style.display = 'block';
  feedbackTimer = setTimeout(() => { feedbackMsg.style.display = 'none'; }, 1200);
}

function flashCell(cell, type) {
  cell.classList.add(`cell-flash-${type}`);
  setTimeout(() => cell.classList.remove(`cell-flash-${type}`, 'cell-flash-good', 'cell-flash-bad'), 280);
}

function spawnScoreFloat(x, y, text, color) {
  const el = document.createElement('div');
  el.className   = 'score-float';
  el.textContent = text;
  el.style.color = color;
  el.style.left  = x + 'px';
  el.style.top   = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function updateProgress() {
  const pct = Math.min(100, (currentCans / GOAL_CANS) * 100);
  progressFill.style.width = pct + '%';
}

function setStatusLine(msg) {
  statusLine.textContent = msg;
}

function getMotivation() {
  const left = GOAL_CANS - currentCans;
  if (left > 15) return '💧 Tap the yellow jerry cans!';
  if (left > 8)  return `⚡ ${left} more cans to go!`;
  if (left > 3)  return `🔥 Almost there — ${left} cans left!`;
  return `🚰 Final push — ${left} cans!`;
}

function checkMilestone(cans) {
  if (MILESTONES[cans] && !milestonesHit.has(cans)) {
    milestonesHit.add(cans);
    showAchievement(MILESTONES[cans]);
    if (cans >= 10) {
      spawnDelay = Math.max(500, BASE_SPAWN_MS - cans * 14);
      restartSpawn();
    }
  }
}

let achTimer;
function showAchievement(msg) {
  clearTimeout(achTimer);
  achievement.textContent  = msg;
  achievement.style.display = 'block';
  achTimer = setTimeout(() => { achievement.style.display = 'none'; }, 2200);
}

function restartSpawn() {
  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnItem, spawnDelay);
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('timer-urgent');
    if (timeLeft <= 0)  endGame(false);
  }, 1000);
}

function startGame() {
  // Reset state
  currentCans = 0; score = 0; timeLeft = GAME_DURATION;
  gameActive = true; spawnDelay = BASE_SPAWN_MS;
  milestonesHit = new Set();
  canTimers.forEach(clearTimeout); canTimers = [];

  // Reset UI
  cansEl.textContent   = 0;
  timerEl.textContent  = GAME_DURATION;
  scoreEl.textContent  = 0;
  timerEl.classList.remove('timer-urgent');
  progressFill.style.width = '0%';
  achievement.style.display  = 'none';
  feedbackMsg.style.display  = 'none';
  setStatusLine('💧 Tap the yellow jerry cans!');

  // Remove any result overlay
  const overlay = document.querySelector('.result-overlay');
  if (overlay) overlay.remove();

  // Buttons
  startBtn.disabled    = true;
  resetBtn.style.display = 'inline-block';

  createGrid();
  spawnItem();         // immediate first spawn
  restartSpawn();
  startTimer();
}

function endGame(won) {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  canTimers.forEach(clearTimeout);
  grid.innerHTML = '';
  createGrid();

  startBtn.disabled    = false;
  startBtn.textContent = 'Play Again';

  // Result overlay inserted above the grid
  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';

  if (won) {
    overlay.innerHTML = `
      <div class="result-icon">🎉</div>
      <div class="result-title win">MISSION COMPLETE!</div>
      <p class="result-msg">You collected all 25 jerry cans!<br>Final score: <strong>${score}</strong></p>
    `;
    setStatusLine('Amazing work — clean water for all! 🌍');
    launchConfetti();
  } else {
    const emoji = currentCans >= 18 ? '💪' : currentCans >= 10 ? '💧' : '🪣';
    overlay.innerHTML = `
      <div class="result-icon">${emoji}</div>
      <div class="result-title lose">TIME'S UP!</div>
      <p class="result-msg">You collected <strong>${currentCans} / 25 cans</strong>. Score: <strong>${score}</strong><br>${currentCans >= 15 ? 'So close — try again!' : 'Keep going, the community needs you!'}</p>
    `;
    setStatusLine('Hit Play Again to try once more!');
  }

  grid.before(overlay);
  achievement.style.display = 'none';
  feedbackMsg.style.display  = 'none';
}

function resetGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  canTimers.forEach(clearTimeout); canTimers = [];

  currentCans = 0; score = 0; timeLeft = GAME_DURATION;
  cansEl.textContent   = 0;
  timerEl.textContent  = GAME_DURATION;
  scoreEl.textContent  = 0;
  timerEl.classList.remove('timer-urgent');
  progressFill.style.width = '0%';
  achievement.style.display  = 'none';
  feedbackMsg.style.display  = 'none';
  setStatusLine('Tap Start to begin your mission!');
  startBtn.disabled    = false;
  startBtn.textContent = 'Start Game';
  resetBtn.style.display = 'none';

  const overlay = document.querySelector('.result-overlay');
  if (overlay) overlay.remove();
  createGrid();
}

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#FFC907','#2E9DF7','#4FCB53','#FF902A','#8BD1CB','#F5402C','#ffffff'];
  const pieces = Array.from({ length: 160 }, () => ({
    x:    Math.random() * canvas.width,
    y:    -Math.random() * canvas.height * 0.5,
    w:    6 + Math.random() * 9,
    h:    10 + Math.random() * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx:   (Math.random() - 0.5) * 4,
    vy:   2.5 + Math.random() * 3.5,
    rot:  Math.random() * 360,
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
      p.x += p.vx; p.y += p.vy; p.rot += p.vrot; p.vy += 0.07;
      if (p.y > canvas.height) p.opacity -= 0.06;
    });
    if (alive) { rafId = requestAnimationFrame(draw); }
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
  })();

  setTimeout(() => { cancelAnimationFrame(rafId); ctx.clearRect(0,0,canvas.width,canvas.height); }, 4000);
}

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);
document.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && !startBtn.disabled) resetGame();
});