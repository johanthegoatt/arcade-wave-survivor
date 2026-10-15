import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, spawnWave, stepGame, pickEnemyKind, ENEMY_KINDS } from "../src/waveEngine.js";

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
  assert.equal(next.enemies.length, 0);
  assert.ok(next.score >= 14);
  // The cleared wave now waits for an upgrade pick before the next one.
  assert.equal(next.upgradeChoices.length, 3);
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

test("clearing a wave offers three upgrades and stops the clock", async () => {
  const { chooseUpgrade } = await import("../src/waveEngine.js");
  const state = createInitialState({}, () => 0.5);
  state.enemies = [];
  const cleared = stepGame(state, {}, 16, () => 0.1);
  assert.equal(cleared.upgradeChoices.length, 3);
  assert.equal(new Set(cleared.upgradeChoices).size, 3);
  assert.equal(cleared.wave, 1);
  // Frozen while choosing.
  assert.equal(stepGame(cleared, { moveX: 1 }, 500), cleared);

  const picked = chooseUpgrade(cleared, cleared.upgradeChoices[0], () => 0.4);
  assert.equal(picked.wave, 2);
  assert.equal(picked.upgradeChoices.length, 0);
  assert.equal(picked.enemies.length, 7);
  assert.deepEqual(picked.upgradesTaken, [cleared.upgradeChoices[0]]);
});

test("an upgrade not on offer is ignored", async () => {
  const { chooseUpgrade } = await import("../src/waveEngine.js");
  const state = createInitialState({}, () => 0.5);
  state.upgradeChoices = ["rapid", "swift", "heart"];
  assert.equal(chooseUpgrade(state, "pierce"), state);
});

test("upgrades change how the player shoots and moves", async () => {
  const { chooseUpgrade } = await import("../src/waveEngine.js");
  let state = createInitialState({}, () => 0.5);
  for (const id of ["rapid", "spread", "pierce", "heart"]) {
    state = chooseUpgrade({ ...state, upgradeChoices: [id] }, id, () => 0.5);
  }
  assert.equal(state.player.fireDelayMs, 100);
  assert.equal(state.lives, 4);
  state.enemies = [{ id: 99, x: 900, y: 500, radius: 13, speed: 0 }];
  state.upgradeChoices = [];
  const fired = stepGame(state, { shoot: true, aimX: state.player.x + 100, aimY: state.player.y }, 16);
  assert.equal(fired.bullets.length, 3);
  assert.ok(fired.bullets.every((b) => b.hitsLeft === 2));
});

test("a piercing shot kills two enemies in a line", () => {
  const state = createInitialState({}, () => 0.5);
  state.player.x = 100;
  state.player.y = 270;
  state.enemies = [
    { id: 1, x: 300, y: 270, radius: 13, speed: 0 },
    { id: 2, x: 330, y: 270, radius: 13, speed: 0 },
    { id: 3, x: 900, y: 40, radius: 13, speed: 0 },
  ];
  state.bullets = [{ x: 290, y: 270, vx: 440, vy: 0, radius: 4, hitsLeft: 2 }];
  let next = state;
  for (let i = 0; i < 10; i += 1) next = stepGame(next, {}, 16);
  assert.deepEqual(next.enemies.map((e) => e.id), [3]);
});

test("upgrade picks skip ones already maxed out", async () => {
  const { pickUpgradeChoices } = await import("../src/waveEngine.js");
  const state = createInitialState({}, () => 0.5);
  state.upgradesTaken = ["spread", "spread", "pierce", "pierce", "pierce"];
  for (let i = 0; i < 20; i += 1) {
    const choices = pickUpgradeChoices(state, () => i / 20);
    assert.ok(!choices.includes("spread") && !choices.includes("pierce"));
  }
});

test("partial stick input moves the player proportionally slower", () => {
  const state = createInitialState({}, () => 0.2);
  const full = stepGame(state, { moveX: 1, moveY: 0 }, 100, () => 0.2);
  const half = stepGame(state, { moveX: 0.5, moveY: 0 }, 100, () => 0.2);
  const fullDistance = full.player.x - state.player.x;
  const halfDistance = half.player.x - state.player.x;
  assert.ok(Math.abs(halfDistance - fullDistance / 2) < 1e-9);
});

test("diagonal key input is not faster than straight movement", () => {
  const state = createInitialState({}, () => 0.2);
  const next = stepGame(state, { moveX: 1, moveY: 1 }, 100, () => 0.2);
  const moved = Math.hypot(next.player.x - state.player.x, next.player.y - state.player.y);
  assert.ok(Math.abs(moved - state.player.speed * 0.1) < 1e-9);
});

test("early waves only spawn grunts", () => {
  for (const roll of [0, 0.01, 0.5, 0.99]) {
    assert.equal(pickEnemyKind(1, () => roll), "grunt");
    assert.equal(pickEnemyKind(2, () => roll), "grunt");
  }
});

test("later waves mix in dashers and brutes", () => {
  assert.equal(pickEnemyKind(3, () => 0.99), "dasher");
  assert.equal(pickEnemyKind(5, () => 0.01), "brute");
  assert.equal(pickEnemyKind(5, () => 0.5), "grunt");
});

test("a brute survives two hits and dies on the third", () => {
  let state = createInitialState({}, () => 0.2);
  state.enemies = [{ id: 99, kind: "brute", x: 400, y: 300, radius: 20, speed: 0, hp: 3 }];
  state.player.x = 100;
  state.player.y = 100;
  for (let shot = 1; shot <= 3; shot += 1) {
    state.bullets = [{ x: 400, y: 300, vx: 0, vy: 0, radius: 4, hitsLeft: 1 }];
    state = stepGame(state, {}, 16, () => 0.2);
    if (shot < 3) {
      assert.equal(state.enemies.length, 1);
      assert.equal(state.enemies[0].hp, 3 - shot);
      assert.equal(state.score, 0);
    }
  }
  assert.equal(state.score, ENEMY_KINDS.brute.score);
});
