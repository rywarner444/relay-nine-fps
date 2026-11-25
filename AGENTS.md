# Relay Nine FPS agent guidance

This is a browser-first, single-player 3D FPS prototype for an AI-assisted cybersecurity engineering portfolio.

## Product goals

- Responsive, enjoyable mouse-and-keyboard movement and energy weapon gameplay.
- A visually distinctive but performant stylized cyberpunk arena.
- Clear first-minute onboarding and an immediately playable target range.
- Honest claims: no trained AI, real security telemetry, or production detection in the prototype.

## Engineering constraints

- Use synthetic fictional scenarios and original or appropriately licensed assets only.
- Never store personal data, employer details, real telemetry, credentials, model keys, or tokens in browser files.
- Treat current targets as scripted training drones; adaptive AI and the scanner come in later milestones.
- Keep deterministic simulation logic separate from Three.js scene rendering.
- Keep game playable without network access after its static assets have loaded; no analytics or backend calls.
- Support reduced motion, sound off by default, visible text labels, and clear keyboard controls.
- Preserve graphics presets and test the low preset for weaker systems.
- Batch static geometry by material to keep draw calls low; do not silently replace the unique Relay Nine violet/lime HUD with BREACHWAVE-style SOC cards.
- A slide triggers with C or Ctrl while moving, without requiring Shift, and must visibly lower the camera.
- Run `npm run check` before committing.
- Do not make the repository public or enable GitHub Pages without the owner's explicit approval.

## File map

- `src/main.ts`: startup, user input, game loop, HUD and controls.
- `src/arena.ts`: Three.js scene, procedural environment, drones, visual effects.
- `src/simulation.ts`: deterministic player movement and scoring.
- `src/audio.ts`: local synthesized game audio (opt-in).
- `src/styles.css`: menu, HUD, accessible interface and responsive layout.
- `tests/*.test.ts`: deterministic movement and scoring tests.

## First milestone

One arena, movement/sprint/jump/slide, energy carbine with reload, drone range, optimized graphics options, local statistics and a developer metrics overlay. Campaign, scanner, shield, and adaptive adversary remain future work.
