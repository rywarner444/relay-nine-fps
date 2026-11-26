# Relay Nine FPS agent guidance

This is a browser-first, single-player 3D FPS prototype for an AI-assisted cybersecurity engineering portfolio.

## Product goals

- Responsive, enjoyable mouse-and-keyboard movement and energy weapon gameplay.
- A visually distinctive and performant detailed cyberpunk facility with navigable corridors.
- Clear first-minute onboarding and a finishable three-mission micro-campaign.
- Honest claims: no trained AI, real security telemetry, or production detection in the prototype.

## Engineering constraints

- Use synthetic fictional scenarios and original or appropriately licensed assets only.
- Never store personal data, employer details, real telemetry, credentials, model keys, or tokens in browser files.
- Treat all threats as scripted, fictional game entities. The evidence interaction is a proximity-based scan, not a real SOC scanner; adaptive AI and actual evidence analysis are not implemented.
- Keep deterministic simulation logic separate from Three.js scene rendering.
- Keep game playable without network access after its static assets have loaded; no analytics or backend calls.
- Support reduced motion, sound off by default, visible text labels, and clear keyboard controls.
- Preserve graphics presets and test the low preset for weaker systems.
- Batch static geometry by material to keep draw calls low; do not silently replace the unique Relay Nine violet/lime HUD with BREACHWAVE-style SOC cards.
- Keep `src/facility.ts` as the authoritative layout; every mission objective must be reachable on foot. The vault remains physically blocked until its three locks are destroyed.
- Keep combat visibility, projectile collision, difficulty tuning and health consequences deterministic and testable; these are scripted game behaviors, not integrated model intelligence.
- Maintain the 2D-only minimap, local-only settings, responsive health bar, and distinct graphic preset budgets.
- A slide triggers with C or Ctrl while moving, without requiring Shift, and must visibly lower the camera.
- Run `npm run check` before committing.
- Do not make the repository public or enable GitHub Pages without the owner's explicit approval.

## File map

- `src/main.ts`: startup, user input, game loop, HUD and controls.
- `src/arena.ts`: Three.js scene, procedural environment, drones, visual effects.
- `src/facility.ts`: shared map, partitions, doors and vault geometry.
- `src/combat.ts`: pure enemy tier settings, line-of-sight, projectile and health math.
- `src/simulation.ts`: deterministic player movement and scoring.
- `src/campaign.ts`: deterministic mission progression and validation.
- `src/audio.ts`: local synthesized game audio (opt-in).
- `src/styles.css`: menu, HUD, accessible interface and responsive layout.
- `tests/*.test.ts`: deterministic movement and scoring tests.

## Current milestone — Facility Assault (v0.4)

Three finishable missions: contain four roaming rogue processes, scan three fictional evidence terminals in the new side wings, then disable three security locks, open the northern vault, defeat a 42-hit mech sentinel, and shut down the mainframe. The facility now has collision-tested walls, doorways, cover, player health, incoming projectile combat, local tactical minimap and mouse sensitivity settings. A higher-detail beveled carbine, original procedural material texture and larger mech model remain lightweight. The engine is fully local and all enemies use scripted movement and attack math. There is no integrated LLM, trained adaptive AI, genuine threat detection, or backend.
