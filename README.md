# RELAY NINE — The Signal Campaign

### [▶ PLAY RELAY NINE — LAUNCH THE GAME IN YOUR BROWSER](https://rywarner444.github.io/relay-nine-fps/)

**No installation · No account · No API keys · Free to play · Desktop browser + mouse and keyboard**

[![Tests and build](https://github.com/rywarner444/relay-nine-fps/actions/workflows/ci.yml/badge.svg)](https://github.com/rywarner444/relay-nine-fps/actions/workflows/ci.yml)
[![Live GitHub Pages deployment](https://github.com/rywarner444/relay-nine-fps/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/rywarner444/relay-nine-fps/actions/workflows/deploy-pages.yml)

**RELAY NINE** is a three-mission, first-person cyberpunk action game built with **TypeScript, Three.js, Vite, and AI-assisted engineering**. Explore three levels across distinct 3D facilities, fight mobile drones, recover fictional network fragments, hold contested uplinks, and defeat a heavily armored final boss.

The project combines responsive FPS mechanics, local state machines, cybersecurity-inspired objectives, handcrafted UI, performance-aware 3D rendering, and automated tests/deployment. The internal creative codename is *Ghost Signal*; the game's public title is **RELAY NINE**.

## 🎮 Play the live demo

### **[► CLICK HERE TO PLAY NOW](https://rywarner444.github.io/relay-nine-fps/)**

1. Open the link above in a modern desktop browser with WebGL and hardware acceleration enabled.
2. Click **START OPERATION** and review the three-step mission briefing. **FIELD MANUAL** provides a concise tutorial and control reference.
3. Click **ENGAGE MISSION**, aim with your mouse, move with **WASD**, and left-click to fire. Press **Esc** to pause and adjust graphics or mouse sensitivity.

The demo is designed for a quick portfolio playthrough, but includes enough depth to reward exploration. Progress is saved locally by unlocked mission, so dying in Mission 2 or 3 never forces you to replay the entire campaign.

**Already played?** [Replay the game](https://rywarner444.github.io/relay-nine-fps/) · [Review the code](https://github.com/rywarner444/relay-nine-fps/tree/main/src) · [See automated checks](https://github.com/rywarner444/relay-nine-fps/actions)

## What you'll experience

- **Fast, tactical combat:** 3D drone patrols with line-of-sight checks, incoming projectiles, cover, sprinting, jumping, sliding, hitmarkers, health and ammo.
- **Polished first-person presentation:** a solid ARC-7 pulse carbine, recoil, an animated reload movement and radial progress meter, cyberpunk lighting, and original violet/lime HUD.
- **Cybersecurity-themed objectives:** collect synthetic network artifacts, insert them at a computer, defend signal uplinks, and stop a fictional rogue-AI sentinel.
- **Useful HUD systems:** live minimap with nearby enemies and objectives, contextual **E** pickup prompts, computer-only dotted navigation route, adjustable mouse sensitivity, and optional local renderer diagnostics.
- **Three distinct levels, a final boss, checkpoints and a victory achievement.**

## Three missions. Three unique maps.

| Mission | Distinct map | Player objective | Cybersecurity / engineering theme |
|---|---|---|---|
| **01 / Base Floor** | Network operations floor, server racks, real corridors and side wings | Fight through **18** faster-firing patrol drones. The three with **bright-green halos** drop equally green network fragments when destroyed. A large **E** prompt appears when you approach each drop. Collect all three; then follow the **lime dotted path on the minimap** to the green-lit computer and press **E** to upload. | Artifact recovery, threat classification, restoration workflow |
| **02 / Signal Foundry** | Industrial refinery floor with pipe tanks, new partitions and wide flanking lanes | Reach three separate purple **uplink towers**. Remain in each tower's glowing **7.5m radius for 9 seconds** to charge it to 100%. Keep fighting while capturing. The captured tower **and floor ring both disappear**; the capture HUD appears only inside an active ring. **No E key** needed. | Infrastructure resilience, availability under pressure |
| **03 / Sentinel Arena** | Open circular combat arena with cover and crimson warning lights | **Defeat Aegis-9**, a mobile 110-HP mech. An obvious top-screen health bar tracks armor. Four escort drones defend it, additional drones spawn on timers, and defeated escorts respawn. Killing the Sentinel is the **only** objective. | Threat prioritization, adversarial systems, resource management |

Completing the final fight unlocks the **GHOST PROTOCOL** achievement and a victory/debrief screen showing score, accuracy, elapsed time, and enemies destroyed. Each mission opens with a concise objective briefing so first-time players know what to do.

### Combat and navigation

- Hostile drones move through patrol routes, acquire targets in range, obey line-of-sight checks, and launch visible energy missiles. Mission 01 starts with **18** hostiles; its fire interval is 1.65 seconds, significantly quicker than the prior 2.1 seconds. Subsequent levels add escalating pressure through faster projectiles and reinforcement timers. Cover stops projectiles; movement and sliding help evade them.
- The ARC-7 carbine is built from detailed opaque, depth-tested beveled geometry and physically based materials. Its **1.35-second reload** displays a circular percentage meter near the reticle and briefly lowers/tilts the gun, returning to normal when ready. Hitmarkers, recoil, large proximity-based pickup/insert prompts, green evidence beacons, the waypoint direction/distance display, and the tactical minimap keep combat legible.
- Each mission starts with **100 health** and full ammo. Losing all health produces a **Defeat** menu with **Retry Mission 0X**—you do **not** have to replay missions you've already passed. Score and elapsed time reset to the start of that mission when retrying.
- Completing missions 01 and 02 saves the **highest unlocked level number** (0, 1, or 2) to `localStorage` in the same browser. Returning players can continue their latest unlocked mission from the intro screen, or choose to restart from level 01. This is a local checkpoint, **not cloud sync**; clearing site data erases the preference.
- The boss fight displays a dedicated red armor bar (`110 / 110`) and periodically introduces reinforcement drones at predetermined times while the Sentinel is alive.
- The earlier amber maintenance drone was removed because it was distracting and had no meaningful role. The unused network-integrity meter was replaced with a live hostile-contact count.
- When the third fragment is collected, the radar calculates a **walkable route around real walls and cover**, drawing it as a luminous dashed line from the player toward the upload computer. That route is deliberately **absent** during other objectives and missions.
- The old red full-screen damage overlay was removed. Damage feedback now pulses the health bar; Engineering View now sits **inside** the opaque Operator Vitals panel instead of floating over an unrelated dark rectangular backdrop.

### Latest release — v0.7 / Combat Readability

- Increased **Mission 01 to 18 hostile drones** with additional patrol coverage while batching drone meshes to control draw calls.
- Matched carrier markers, dropped fragments, and the upload computer to **bright green** so instructions and gameplay agree.
- Added a prominent **circular reload percentage meter** and a timed gun-lowering/tilt animation.
- Improved the ARC-7's **opaque, depth-tested geometry** and connected its receiver for a more solid weapon silhouette.
- Integrated **Engineering View** into the Operator Vitals panel and removed the confusing floating dark backdrop.
- Published the browser game via **GitHub Pages** with a verified two-job GitHub Actions build/deploy pipeline and an artifact-lookup retry.

### Controls

| Input | Action |
|---|---|
| WASD / mouse | Move / look and aim |
| Left click | Fire ARC-7 |
| Shift | Sprint |
| Space | Jump |
| C or Ctrl while moving | Slide and lower camera (Shift not required) |
| E | Collect dropped fragments or upload to computer (**Mission 01 only**) |
| Stand within purple ring | Charge uplink (**Mission 02 only; hold for 9 seconds**) |
| R | Reload |
| Tab | Toggle local engineering/performance diagnostics |
| Esc | Pause, access settings, release mouse |

Mouse sensitivity adjusts from **50% to 250%** in settings and is saved locally. Audio is **off by default** and is synthesized in the browser if enabled. Reduced-motion preferences are respected. The tutorial can be opened from the menu at any time.

## Run it locally (developers)

Requires Node.js **22.12+**, a desktop mouse and keyboard, and a WebGL-capable browser.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:5173/**. In a GitHub Codespace, open forwarded port **5173**. No database, server-side application, account, API keys, or paid AI credits are required.

## Engineering highlights

| Module | Scope |
|---|---|
| `src/arena.ts` | Three separate authored/procedural Three.js scenes; batchable mesh geometry; materials; pickups; uplinks; detailed weapon and mech; independent scripted drone populations; projectile feedback |
| `src/facility.ts` | Authoritative original base-floor wall and doorway geometry |
| `src/combat.ts` | Pure combat tuning, collision, line of sight and projectile dynamics |
| `src/objectives.ts` | Deterministic hold-radius capture state machine; progress pauses when operator leaves the zone |
| `src/navigation.ts` | Pure collision-aware pathfinding used only for the post-fragment minimap route |
| `src/campaign.ts` | Mission event validation, objective gating, checkpoint bounds |
| `src/simulation.ts` | Pure character physics, wall collision, slide/sprint/jump and shooting statistics |
| `src/main.ts` | Stage transition/recovery, keyboard/mouse input, player health, checkpoint storage, minimap and UI |
| `src/styles.css` | Original violet/lime UI plus dedicated capture, boss, victory, tutorial and responsive overlays |
| `tests/*.test.ts` | Mission state, reachability, controls, capture timing, drop/raycast integration, respawning combat and UI contract |

The Three.js game uses procedural models and an original code-generated metal texture; assets require no external download or third-party image license. Static geometry is merged per material to reduce render calls. A local 2D canvas minimap avoids a second 3D renderer. **Auto** graphics chooses a moderate resolution budget and steps down to Low on sustained lag; bloom is High-only. Actual frame rate depends on the device and browser.

### Testing

```bash
npm run check
```

`check` runs **43 automated tests**, TypeScript static validation, and the optimized Vite production build. GitHub Actions runs the same checks for pushes and pull requests. The Pages deployment workflow runs `check` again, uploads the `dist/` site artifact in a dedicated build job, and publishes it from a separate job. It can retry the publish step if GitHub temporarily fails to find the uploaded artifact. Every push to `main` automatically triggers a new deployment.

For an optional browser-based UI smoke test with a locally installed Chrome/Chromium binary:

```bash
npm run smoke
```

The smoke tool may require a `CHROMIUM_PATH` environment variable; the CI unit/build checks do not require Chrome.

## Development history and next improvements

1. **v0.2 / First Contact:** responsive movement, energy weapon, graphics presets, original combat HUD.
2. **v0.3 / Signal Campaign:** initial three-mission scenario, waypoint objectives and Sentinel prototype.
3. **v0.4 / Facility Assault:** expanded base-floor corridors and cover, incoming hostile projectiles, health/radar, configurable mouse sensitivity, advanced weapon and mech models.
4. **v0.5 / Three Distinct Fronts:** independently instantiated 3D maps, carrier fragment drops, charged uplink defense, multi-wave mobile boss encounter with highly visible HP, same-stage defeat retries, local stage unlocks, final achievement.
5. **v0.6 / Combat and Clarity:** denser and faster Mission 01 combat; clear fragment/console interactions; collision-aware dotted minimap guidance; complete uplink-floor cleanup; mission-intel briefing screens; retired maintenance decoy and integrity meter; streamlined health-only damage feedback.
6. **v0.7 / Combat Readability (current):** increased Base Floor to 18 hostiles; matched three artifact/carrier markers and the upload computer to clearly green 3D highlights; added radial reload meter and carbine motion; corrected firearm depth testing and connected its chassis; integrated engineering toggle into vitals to eliminate the floating background artifact.
7. **Public portfolio deployment:** live GitHub Pages site, automated build/deploy workflow, dedicated publish stage and resilient artifact lookup.
8. **Possible next upgrades:** device-specific performance tuning, additional original 3D/PBR models, gamepad/accessibility polish, optional gameplay trailer and richer portfolio screenshots.

## Privacy and AI disclosure

The entire game operates on **synthetic, fictional gameplay data**. There are **no real security telemetry feeds, employer systems, personal-information inputs, accounts, analytics services, tracking scripts, model API keys, or live LLM calls**. Only the unlocked mission number, optional sensitivity, and best score are saved to local browser storage.

The rogue AI antagonist is fictional; enemies are deterministic authored state machines, not trained agents. Trained/adaptive AI, real security evidence analysis, and online LLM integrations are **not implemented**. This repository demonstrates **AI-assisted software development plus human-directed engineering, iteration, testing, and deployment**—not a production cybersecurity tool. All gameplay runs on synthetic local data. Repository visibility and Pages publication are controlled by its owner in GitHub Settings.

---

### [🎮 PLAY RELAY NINE NOW →](https://rywarner444.github.io/relay-nine-fps/)

*A playable 3D cyberpunk portfolio project. No download required.*
