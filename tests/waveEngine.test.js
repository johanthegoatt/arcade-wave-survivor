import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, spawnWave, stepGame } from "../src/waveEngine.js";

test("createInitialState sets baseline values", () => {
  const state = createInitialState({ width: 900, height: 500 }, () => 0.4);
  assert.equal(state.width, 900);
  assert.equal(state.height, 500);
  assert.equal(state.wave, 1);
  assert.equal(state.lives, 3);
  assert.ok(state.enemies.length > 0);
});

test("spawnWave increases enemy count with wave", () => {
  const state = createInitialState({}, () => 0.2);
  state.wave = 4;
  const spawned = spawnWave(state, () => 0.3);
  assert.equal(spawned.enemies.length, 11);
});

test("stepGame moves player with input", () => {
  const state = createInitialState({}, () => 0.2);
  const next = stepGame(state, { moveX: 1, moveY: 0 }, 100, () => 0.2);
  assert.ok(next.player.x > state.player.x);
});

test("stepGame spawns bullet when shooting", () => {
  const state = createInitialState({}, () => 0.2);
  const next = stepGame(
    state,
    { shoot: true, aimX: state.player.x + 50, aimY: state.player.y },
    16,
    () => 0.2,
  );
  assert.equal(next.bullets.length, 1);
});

test("bullet collision removes enemy and gives score", () => {
  const state = createInitialState({}, () => 0.2);
  state.enemies = [{ x: 400, y: 300, radius: 13, speed: 0 }];
  state.bullets = [{ x: 400, y: 300, vx: 0, vy: 0, radius: 4 }];

  const next = stepGame(state, {}, 16, () => 0.2);
  assert.equal(next.wave, 2);
  assert.ok(next.enemies.length > 0);
  assert.ok(next.score >= 14);
});

test("enemy touching player removes life", () => {
  const state = createInitialState({}, () => 0.2);
  state.enemies = [{ x: state.player.x, y: state.player.y, radius: 13, speed: 0 }];

  const next = stepGame(state, {}, 16, () => 0.2);
  assert.equal(next.lives, 2);
});
