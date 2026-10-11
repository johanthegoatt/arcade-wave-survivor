function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
}

// Enemies never appear closer than this to the player, so a wave cannot
// open with a hit the player had no time to see.
export const SAFE_SPAWN_DISTANCE = 220;
// Enemies push apart when closer than this (centre to centre), so a wave
// reads as a crowd instead of one stacked blob.
export const SEPARATION_DISTANCE = 30;
const SEPARATION_STRENGTH = 0.9;

function edgePoint(state, side, t) {
  const padding = 22;
  if (side === 0) return { x: t * state.width, y: -padding };
  if (side === 1) return { x: state.width + padding, y: t * state.height };
  if (side === 2) return { x: t * state.width, y: state.height + padding };
  return { x: -padding, y: t * state.height };
}

function spawnEnemy(state, randomFn = Math.random) {
  const player = state.player;
  let point = edgePoint(state, Math.floor(randomFn() * 4), randomFn());

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (Math.hypot(point.x - player.x, point.y - player.y) >= SAFE_SPAWN_DISTANCE) {
      break;
    }
    point = edgePoint(state, Math.floor(randomFn() * 4), randomFn());
  }

  if (Math.hypot(point.x - player.x, point.y - player.y) < SAFE_SPAWN_DISTANCE) {
    // Still too close (player hugging an edge): use the far side of the arena.
    point = {
      x: player.x < state.width / 2 ? state.width + 22 : -22,
      y: player.y < state.height / 2 ? state.height + 22 : -22,
    };
  }

  return {
    x: point.x,
    y: point.y,
    radius: 13,
    speed: 68 + state.wave * 7,
  };
}

export function spawnWave(state, randomFn = Math.random) {
  const enemyCount = 3 + state.wave * 2;
  const enemies = Array.from({ length: enemyCount }, () => spawnEnemy(state, randomFn));
  return {
    ...state,
    enemies,
  };
}

export function createInitialState({ width = 960, height = 540 } = {}, randomFn = Math.random) {
  const base = {
    width,
    height,
    player: {
      x: width / 2,
      y: height / 2,
      radius: 14,
      speed: 250,
      fireCooldownMs: 0,
      invulnMs: 0,
    },
    bullets: [],
    enemies: [],
    score: 0,
    wave: 1,
    lives: 3,
    gameOver: false,
  };

  return spawnWave(base, randomFn);
}

function stepPlayer(state, input, dtMs) {
  const next = {
    ...state,
    player: {
      ...state.player,
      fireCooldownMs: Math.max(0, state.player.fireCooldownMs - dtMs),
      invulnMs: Math.max(0, state.player.invulnMs - dtMs),
    },
  };

  const movement = normalize(input.moveX ?? 0, input.moveY ?? 0);
  next.player.x = clamp(
    next.player.x + movement.x * next.player.speed * (dtMs / 1000),
    next.player.radius,
    next.width - next.player.radius,
  );
  next.player.y = clamp(
    next.player.y + movement.y * next.player.speed * (dtMs / 1000),
    next.player.radius,
    next.height - next.player.radius,
  );

  if ((input.shoot ?? false) && next.player.fireCooldownMs <= 0) {
    const aimX = (input.aimX ?? next.player.x) - next.player.x;
    const aimY = (input.aimY ?? next.player.y - 1) - next.player.y;
    const direction = normalize(aimX, aimY);

    if (direction.x !== 0 || direction.y !== 0) {
      next.bullets = [
        ...next.bullets,
        {
          x: next.player.x,
          y: next.player.y,
          vx: direction.x * 440,
          vy: direction.y * 440,
          radius: 4,
        },
      ];
      next.player.fireCooldownMs = 120;
    }
  }

  return next;
}

export function stepGame(state, input = {}, dtMs = 16, randomFn = Math.random) {
  if (state.gameOver) {
    return state;
  }

  let next = stepPlayer(state, input, dtMs);

  next.bullets = next.bullets
    .map((bullet) => ({
      ...bullet,
      x: bullet.x + bullet.vx * (dtMs / 1000),
      y: bullet.y + bullet.vy * (dtMs / 1000),
    }))
    .filter((bullet) => bullet.x >= -30 && bullet.x <= next.width + 30 && bullet.y >= -30 && bullet.y <= next.height + 30);

  const seconds = dtMs / 1000;
  next.enemies = next.enemies.map((enemy, index, all) => {
    const chase = normalize(next.player.x - enemy.x, next.player.y - enemy.y);

    // Separation steering (Reynolds 1987): push away from close neighbours,
    // weighted by how close they are.
    let pushX = 0;
    let pushY = 0;
    for (let j = 0; j < all.length; j += 1) {
      if (j === index) continue;
      const dx = enemy.x - all[j].x;
      const dy = enemy.y - all[j].y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) {
        // Exactly on top of each other: split them by index.
        pushX += index < j ? -1 : 1;
        continue;
      }
      if (distance < SEPARATION_DISTANCE) {
        const weight = (SEPARATION_DISTANCE - distance) / SEPARATION_DISTANCE;
        pushX += (dx / distance) * weight;
        pushY += (dy / distance) * weight;
      }
    }

    const heading = normalize(chase.x + pushX * SEPARATION_STRENGTH, chase.y + pushY * SEPARATION_STRENGTH);
    return {
      ...enemy,
      x: enemy.x + heading.x * enemy.speed * seconds,
      y: enemy.y + heading.y * enemy.speed * seconds,
    };
  });

  const remainingBullets = [];
  const enemyAlive = new Array(next.enemies.length).fill(true);

  for (const bullet of next.bullets) {
    let consumed = false;
    for (let i = 0; i < next.enemies.length; i += 1) {
      if (!enemyAlive[i]) continue;
      const enemy = next.enemies[i];
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const collide = dx * dx + dy * dy <= (bullet.radius + enemy.radius) ** 2;
      if (!collide) continue;

      enemyAlive[i] = false;
      next.score += 14;
      consumed = true;
      break;
    }

    if (!consumed) {
      remainingBullets.push(bullet);
    }
  }

  next.bullets = remainingBullets;
  next.enemies = next.enemies.filter((_, i) => enemyAlive[i]);

  if (next.player.invulnMs <= 0) {
    const playerRadius = next.player.radius;
    const collisions = next.enemies.filter((enemy) => {
      const dx = enemy.x - next.player.x;
      const dy = enemy.y - next.player.y;
      return dx * dx + dy * dy <= (enemy.radius + playerRadius) ** 2;
    });

    if (collisions.length > 0) {
      next.lives -= 1;
      next.player.invulnMs = 1000;
      next.enemies = next.enemies.filter((enemy) => !collisions.includes(enemy));
    }
  }

  if (next.lives <= 0) {
    next.gameOver = true;
    return next;
  }

  if (next.enemies.length === 0) {
    next.wave += 1;
    next = spawnWave(next, randomFn);
  }

  return next;
}
