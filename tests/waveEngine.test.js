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

test("enemies never spawn within the safe distance of the player", async () => {
  const { SAFE_SPAWN_DISTANCE } = await import("../src/waveEngine.js");
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (const [px, py] of [[480, 270], [20, 20], [940, 20], [20, 520], [940, 520], [480, 15]]) {
    const state = createInitialState({}, rand);
    state.player.x = px;
    state.player.y = py;
    state.wave = 6;
    const spawned = spawnWave(state, rand);
    for (const enemy of spawned.enemies) {
      assert.ok(Math.hypot(enemy.x - px, enemy.y - py) >= SAFE_SPAWN_DISTANCE);
    }
  }
});

test("stacked enemies spread out instead of moving as one blob", () => {
  const state = createInitialState({}, () => 0.5);
  state.player.x = 480;
  state.player.y = 270;
  state.enemies = Array.from({ length: 5 }, () => ({ x: 100, y: 270, radius: 13, speed: 80 }));
  let next = state;
  for (let i = 0; i < 60; i += 1) {
    next = stepGame(next, {}, 16, () => 0.5);
  }
  const xs = next.enemies.map((e) => e.x);
  const ys = next.enemies.map((e) => e.y);
  const spread = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
  assert.ok(spread > 20, `spread ${spread}`);
});
