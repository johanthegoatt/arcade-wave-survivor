import { createInitialState, stepGame, chooseUpgrade, UPGRADES } from "./src/waveEngine.js";

const elements = {
  canvas: document.getElementById("arena"),
  overlay: document.getElementById("overlay"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  lives: document.getElementById("lives"),
  enemies: document.getElementById("enemies"),
  upgradeOverlay: document.getElementById("upgradeOverlay"),
  upgradeTitle: document.getElementById("upgradeTitle"),
  upgradeChoices: document.getElementById("upgradeChoices"),
  upgradesTaken: document.getElementById("upgradesTaken"),
};

const context = elements.canvas.getContext("2d");

const ENEMY_COLORS = { grunt: "#ff6f8b", dasher: "#ffb347", brute: "#b18cff" };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const effects = { particles: [], shakeMs: 0, flashMs: 0 };
const MAX_PARTICLES = 400;

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count && effects.particles.length < MAX_PARTICLES; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.4 + Math.random() * 0.6);
    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      lifeMs: 380 + Math.random() * 260,
      ageMs: 0,
      color,
    });
  }
}

function applyEvents(events) {
  for (const event of events ?? []) {
    if (event.type === "kill") burst(event.x, event.y, ENEMY_COLORS[event.kind], event.kind === "brute" ? 26 : 14, 260);
    if (event.type === "hit") burst(event.x, event.y, "#ffffff", 5, 160);
    if (event.type === "hurt") {
      burst(event.x, event.y, "#ffd46b", 20, 300);
      effects.flashMs = 180;
      if (!reducedMotion.matches) effects.shakeMs = 260;
    }
  }
}

function stepEffects(dt) {
  effects.shakeMs = Math.max(0, effects.shakeMs - dt);
  effects.flashMs = Math.max(0, effects.flashMs - dt);
  const seconds = dt / 1000;
  effects.particles = effects.particles.filter((particle) => {
    particle.ageMs += dt;
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.vx *= 0.92;
    particle.vy *= 0.92;
    return particle.ageMs < particle.lifeMs;
  });
}

const inputState = {
  moveX: 0,
  moveY: 0,
  shoot: false,
  aimX: elements.canvas.width / 2,
  aimY: elements.canvas.height / 2,
  left: false,
  right: false,
  up: false,
  down: false,
  stickX: 0,
  stickY: 0,
};

let firePointerId = null;
// Floating thumbstick: wherever the left thumb lands becomes the centre.
const touchStick = { pointerId: null, originX: 0, originY: 0, x: 0, y: 0 };
const STICK_RADIUS = 70;

const appState = {
  game: createInitialState({ width: elements.canvas.width, height: elements.canvas.height }),
  running: false,
  paused: false,
  lastFrameAt: 0,
};

function setOverlayVisible(visible) {
  elements.overlay.hidden = !visible;
}

let shownChoices = "";

function syncUpgrades() {
  const choices = appState.game.upgradeChoices;
  const key = choices.join(",");
  if (key === shownChoices) return;
  shownChoices = key;

  elements.upgradeOverlay.hidden = choices.length === 0;
  elements.upgradeChoices.replaceChildren(
    ...choices.map((id, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const title = document.createElement("strong");
      title.textContent = `${index + 1}. ${UPGRADES[id].label}`;
      const note = document.createElement("small");
      note.textContent = UPGRADES[id].note;
      button.append(title, note);
      button.addEventListener("click", () => pickUpgrade(id));
      return button;
    }),
  );
  if (choices.length > 0) {
    elements.upgradeTitle.textContent = `Wave ${appState.game.wave} cleared`;
    // Drop held keys so the player does not walk off when play resumes.
    inputState.shoot = false;
    inputState.left = inputState.right = inputState.up = inputState.down = false;
    refreshMoveVector();
    elements.upgradeChoices.querySelector("button")?.focus();
  }

  const taken = appState.game.upgradesTaken.map((id) => UPGRADES[id].label);
  elements.upgradesTaken.textContent = taken.length ? taken.join(", ") : "none yet";
}

function pickUpgrade(id) {
  appState.game = chooseUpgrade(appState.game, id);
  appState.lastFrameAt = 0;
  elements.canvas.focus?.();
}

function syncStats() {
  elements.score.textContent = String(appState.game.score);
  elements.wave.textContent = String(appState.game.wave);
  elements.lives.textContent = String(appState.game.lives);
  elements.enemies.textContent = String(appState.game.enemies.length);
  syncUpgrades();
}

function drawScene() {
  const game = appState.game;

  context.save();
  if (effects.shakeMs > 0) {
    const strength = (effects.shakeMs / 260) * 7;
    context.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
  }

  const gradient = context.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#121f37");
  gradient.addColorStop(1, "#182a4a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, game.width, game.height);

  for (const bullet of game.bullets) {
    context.fillStyle = "#8ce7ff";
    context.beginPath();
    context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    context.fill();
  }

  for (const enemy of game.enemies) {
    context.fillStyle = ENEMY_COLORS[enemy.kind] ?? ENEMY_COLORS.grunt;
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    context.fill();
    if (enemy.kind === "brute") {
      // Shrinking ring shows how many hits are left.
      context.strokeStyle = "rgba(255,255,255,0.8)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * enemy.hp) / 3);
      context.stroke();
    }
  }

  context.fillStyle = game.player.invulnMs > 0 ? "#ffd46b" : "#6bffb7";
  context.beginPath();
  context.arc(game.player.x, game.player.y, game.player.radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.75)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(game.player.x, game.player.y);
  context.lineTo(inputState.aimX, inputState.aimY);
  context.stroke();

  for (const particle of effects.particles) {
    context.globalAlpha = 1 - particle.ageMs / particle.lifeMs;
    context.fillStyle = particle.color;
    context.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  context.globalAlpha = 1;
  context.restore();

  if (effects.flashMs > 0) {
    context.fillStyle = `rgba(255, 80, 100, ${(effects.flashMs / 180) * 0.25})`;
    context.fillRect(0, 0, game.width, game.height);
  }

  if (touchStick.pointerId !== null) {
    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(touchStick.originX, touchStick.originY, STICK_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.45)";
    context.beginPath();
    context.arc(touchStick.originX + touchStick.x, touchStick.originY + touchStick.y, 26, 0, Math.PI * 2);
    context.fill();
  }

  syncStats();
}

function refreshMoveVector() {
  const keyX = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  const keyY = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);
  inputState.moveX = keyX || inputState.stickX;
  inputState.moveY = keyY || inputState.stickY;
}

function resetGame() {
  shownChoices = "";
  appState.game = createInitialState({ width: elements.canvas.width, height: elements.canvas.height });
  appState.running = false;
  appState.paused = false;
  appState.lastFrameAt = 0;
  setOverlayVisible(false);
  elements.startBtn.disabled = false;
  elements.pauseBtn.disabled = true;
  elements.pauseBtn.textContent = "Pause";
  drawScene();
}

function startGame() {
  if (appState.game.gameOver) {
    appState.game = createInitialState({ width: elements.canvas.width, height: elements.canvas.height });
  }

  appState.running = true;
  appState.paused = false;
  appState.lastFrameAt = 0;
  setOverlayVisible(false);
  elements.startBtn.disabled = true;
  elements.pauseBtn.disabled = false;
  elements.pauseBtn.textContent = "Pause";
}

function togglePause() {
  if (!appState.running) return;
  appState.paused = !appState.paused;
  elements.pauseBtn.textContent = appState.paused ? "Resume" : "Pause";
}

function animate(timestamp) {
  if (!appState.lastFrameAt) {
    appState.lastFrameAt = timestamp;
  }

  const dt = Math.min(timestamp - appState.lastFrameAt, 100);
  appState.lastFrameAt = timestamp;

  if (appState.running && !appState.paused && !appState.game.gameOver) {
    appState.game = stepGame(appState.game, {
      moveX: inputState.moveX,
      moveY: inputState.moveY,
      shoot: inputState.shoot,
      aimX: inputState.aimX,
      aimY: inputState.aimY,
    }, dt);
    applyEvents(appState.game.events);

    if (appState.game.gameOver) {
      appState.running = false;
      elements.startBtn.disabled = false;
      elements.pauseBtn.disabled = true;
      setOverlayVisible(true);
    }
  }

  stepEffects(dt);
  drawScene();
  requestAnimationFrame(animate);
}

elements.startBtn.addEventListener("click", startGame);
elements.pauseBtn.addEventListener("click", togglePause);
elements.restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

function aimAt(event) {
  const rect = elements.canvas.getBoundingClientRect();
  inputState.aimX = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
  inputState.aimY = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
}

elements.canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId === touchStick.pointerId) {
    updateStick(event);
    return;
  }
  if (event.pointerType === "touch" && event.pointerId !== firePointerId) return;
  aimAt(event);
});

function canvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * elements.canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * elements.canvas.height,
  };
}

function updateStick(event) {
  const point = canvasPoint(event);
  let dx = point.x - touchStick.originX;
  let dy = point.y - touchStick.originY;
  const length = Math.hypot(dx, dy);
  if (length > STICK_RADIUS) {
    dx = (dx / length) * STICK_RADIUS;
    dy = (dy / length) * STICK_RADIUS;
  }
  touchStick.x = dx;
  touchStick.y = dy;
  // Small dead zone so a resting thumb does not drift the player.
  const magnitude = Math.min(1, length / STICK_RADIUS);
  inputState.stickX = magnitude < 0.15 ? 0 : dx / STICK_RADIUS;
  inputState.stickY = magnitude < 0.15 ? 0 : dy / STICK_RADIUS;
  refreshMoveVector();
}

elements.canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && touchStick.pointerId === null) {
    const point = canvasPoint(event);
    if (point.x < elements.canvas.width / 2) {
      elements.canvas.setPointerCapture(event.pointerId);
      touchStick.pointerId = event.pointerId;
      touchStick.originX = point.x;
      touchStick.originY = point.y;
      updateStick(event);
      return;
    }
  }
  aimAt(event);
  // Capture so a release outside the canvas still stops the gun.
  elements.canvas.setPointerCapture(event.pointerId);
  firePointerId = event.pointerId;
  inputState.shoot = true;
});

function releaseFire(event) {
  if (event.pointerId === touchStick.pointerId) {
    touchStick.pointerId = null;
    inputState.stickX = inputState.stickY = 0;
    refreshMoveVector();
    return;
  }
  if (event.pointerId !== firePointerId) return;
  firePointerId = null;
  inputState.shoot = false;
}
elements.canvas.addEventListener("pointerup", releaseFire);
elements.canvas.addEventListener("pointercancel", releaseFire);

const MOVE_KEYS = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const choices = appState.game.upgradeChoices;
  if (choices.length > 0) {
    const index = Number(key) - 1;
    if (index >= 0 && index < choices.length) pickUpgrade(choices[index]);
    return;
  }
  if (MOVE_KEYS[key]) {
    event.preventDefault();
    inputState[MOVE_KEYS[key]] = true;
  }
  if (key === " ") {
    if (event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    inputState.shoot = true;
  }
  if (key === "p") togglePause();
  refreshMoveVector();
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (MOVE_KEYS[key]) inputState[MOVE_KEYS[key]] = false;
  if (key === " ") inputState.shoot = false;
  refreshMoveVector();
});

// Pause when the tab is hidden or the window loses focus, and let go of any
// held keys: a keyup that happens in another window never reaches the page,
// which left the player running or firing on their own.
function pauseForFocusLoss() {
  inputState.shoot = false;
  inputState.left = inputState.right = inputState.up = inputState.down = false;
  inputState.stickX = inputState.stickY = 0;
  touchStick.pointerId = null;
  refreshMoveVector();
  if (appState.running && !appState.paused) togglePause();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseForFocusLoss();
});
window.addEventListener("blur", pauseForFocusLoss);

resetGame();
requestAnimationFrame(animate);
