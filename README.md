# Arcade Wave Survivor

## Description
Arcade Wave Survivor is a top-down browser survival shooter with escalating enemy waves and responsive controls.

## Features
- Continuous wave progression
- WASD movement + mouse/space firing
- Enemy chase behavior and collision damage
- Bullet collisions with score rewards
- Life system with invulnerability window
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
