import { createInitialState, stepGame } from "./src/waveEngine.js";

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
};

const context = elements.canvas.getContext("2d");

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
};

const appState = {
  game: createInitialState({ width: elements.canvas.width, height: elements.canvas.height }),
  running: false,
  paused: false,
  lastFrameAt: 0,
};

function setOverlayVisible(visible) {
  elements.overlay.hidden = !visible;
}

function syncStats() {
  elements.score.textContent = String(appState.game.score);
  elements.wave.textContent = String(appState.game.wave);
  elements.lives.textContent = String(appState.game.lives);
  elements.enemies.textContent = String(appState.game.enemies.length);
}

function drawScene() {
  const game = appState.game;

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
    context.fillStyle = "#ff6f8b";
    context.beginPath();
    context.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    context.fill();
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

  syncStats();
}

function refreshMoveVector() {
  inputState.moveX = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
  inputState.moveY = (inputState.down ? 1 : 0) - (inputState.up ? 1 : 0);
}

function resetGame() {
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

    if (appState.game.gameOver) {
      appState.running = false;
      elements.startBtn.disabled = false;
      elements.pauseBtn.disabled = true;
      setOverlayVisible(true);
    }
  }

  drawScene();
  requestAnimationFrame(animate);
}

elements.startBtn.addEventListener("click", startGame);
elements.pauseBtn.addEventListener("click", togglePause);
elements.restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

elements.canvas.addEventListener("mousemove", (event) => {
  const rect = elements.canvas.getBoundingClientRect();
  inputState.aimX = ((event.clientX - rect.left) / rect.width) * elements.canvas.width;
  inputState.aimY = ((event.clientY - rect.top) / rect.height) * elements.canvas.height;
});

elements.canvas.addEventListener("mousedown", () => {
  inputState.shoot = true;
});

elements.canvas.addEventListener("mouseup", () => {
  inputState.shoot = false;
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "w") inputState.up = true;
  if (key === "s") inputState.down = true;
  if (key === "a") inputState.left = true;
  if (key === "d") inputState.right = true;
  if (key === " ") inputState.shoot = true;
  refreshMoveVector();
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "w") inputState.up = false;
  if (key === "s") inputState.down = false;
  if (key === "a") inputState.left = false;
  if (key === "d") inputState.right = false;
  if (key === " ") inputState.shoot = false;
  refreshMoveVector();
});

resetGame();
requestAnimationFrame(animate);
