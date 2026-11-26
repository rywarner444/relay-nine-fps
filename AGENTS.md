# Relay Nine FPS agent guidance

This is a browser-first, single-player 3D FPS prototype for an AI-assisted cybersecurity engineering portfolio.

## Product goals

- Responsive, enjoyable mouse-and-keyboard movement and energy weapon gameplay.
- Three visually distinctive and performant maps: a base floor, a signal foundry, and an open boss arena.
- Clear first-minute onboarding and a finishable three-mission micro-campaign.
- Honest claims: no trained AI, real security telemetry, or production detection in the prototype.

## Engineering constraints

- Use synthetic fictional scenarios and original or appropriately licensed assets only.
- Never store personal data, employer details, real telemetry, credentials, model keys, or tokens in browser files.
- Treat all threats as scripted, fictional game entities. Network fragments are proximity-based game pickups, not real SOC artifacts; adaptive AI and actual evidence analysis are not implemented.
- Keep deterministic simulation logic separate from Three.js scene rendering.
- Keep game playable without network access after its static assets have loaded; no analytics or backend calls.
- Support reduced motion, sound off by default, visible text labels, and clear keyboard controls.
- Preserve graphics presets and test the low preset for weaker systems.
- Batch static geometry by material to keep draw calls low; do not silently replace the unique Relay Nine violet/lime HUD with BREACHWAVE-style SOC cards.
- Keep `src/facility.ts` as the authoritative **base-floor** corridor layout; foundry and boss arena use independent level geometry. Every mission objective must be reachable on foot.
- Keep combat visibility, projectile collision, difficulty tuning and health consequences deterministic and testable; these are scripted game behaviors, not integrated model intelligence.
- Maintain the 2D-only minimap, local-only settings, responsive health bar, and distinct graphic preset budgets.
- Save only the highest unlocked mission number in browser localStorage. Dying retries the current level, and tower capture requires sustained proximity rather than E interaction.
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
- `src/objectives.ts`: pure, deterministic tower hold-zone capture rules.
- `src/audio.ts`: local synthesized game audio (opt-in).
- `src/styles.css`: menu, HUD, accessible interface and responsive layout.
- `tests/*.test.ts`: deterministic movement and scoring tests.

## Current milestone — Three Distinct Fronts (v0.5)

Three finishable, fully separate environments: (01) base-floor corridor battle with eight roaming rogues, three collectible network fragments dropped by carrier enemies, and a computer upload; (02) industrial foundry with eight respawning enemies and three purple uplinks requiring nine-second capture holds; (03) open circular arena with a mobile 110-hit mech, four escort drones and timed incoming reinforcements. The boss itself is the sole final objective. A prominent boss armor bar, capture HUD, endgame achievement, local unlocked-level checkpoints and same-level death retry complete the loop. Rendering, assets, and game AI are generated locally without any real security telemetry, live LLM, APIs, or backend.
