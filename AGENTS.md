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
- `src/navigation.ts`: deterministic collision-aware dotted minimap route to the base-floor upload computer.
- `src/audio.ts`: local synthesized game audio (opt-in).
- `src/styles.css`: menu, HUD, accessible interface and responsive layout.
- `tests/*.test.ts`: deterministic movement and scoring tests.

## Current milestone — Combat Readability (v0.7)

Three finishable, fully separate environments: (01) base-floor corridor battle with **18** roaming rogues and a faster firing cadence, three collectible bright-green network fragments dropped by green-halo carriers, and a green upload computer guided by an on-demand collision-aware dotted lime minimap route; (02) industrial foundry with eight respawning enemies and three purple uplinks requiring nine-second capture holds, whose floor rings disappear when secured; (03) open circular arena with a mobile 110-hit mech, four escort drones and timed incoming reinforcements. The boss itself is the sole final objective. Prominent nearby E prompts, concise pre-deployment objective briefings, an opaque depth-tested ARC-7 carbine, a radial reload meter with weapon tilt, an engineering control integrated into Operator Vitals, a boss armor bar, endgame achievement, local unlocked-level checkpoints and same-level death retry complete the loop. No friendly maintenance decoy, unnecessary integrity meter, or floating rectangular background behind the engineering toggle. All assets, enemy behavior and objectives are synthetic, deterministic and local; no real telemetry, live LLM, APIs, or backend.
