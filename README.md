# Arcade Wave Survivor

## Description
Arcade Wave Survivor is a top-down browser survival shooter with escalating enemy waves and responsive controls.

## Features
- Continuous wave progression with an upgrade pick (one of three) after every cleared wave: faster fire, quicker feet, piercing shots, spread shot or an extra life
- Enemies spawn at least 220 px from the player and spread out with separation steering instead of stacking
- WASD or arrow keys movement + mouse/space firing, P to pause; pauses itself when the tab is hidden
- Three enemy types: grunts, fast dashers from wave 3, and three-hit brutes from wave 5
- Bullet collisions with score rewards
- Life system with invulnerability window
- Best score and wave saved in the browser
- Unit-tested wave simulation engine
- Static Vercel-ready deployment setup

## Run
```bash
cd arcade-wave-survivor
npm run dev
```
Open `http://127.0.0.1:8109/arcade-wave-survivor/index.html`.

## Test
```bash
cd arcade-wave-survivor
npm test
```

## Deploy
```bash
cd arcade-wave-survivor
npx vercel --prod
```

## Inspiration
- https://github.com/end3r/Gamedev-Canvas-workshop
- https://github.com/phaserjs/phaser

## Structure
```text
arcade-wave-survivor/
  index.html
  styles.css
  app.js
  src/
    waveEngine.js
  tests/
    waveEngine.test.js
  package.json
  vercel.json
  README.md
```
