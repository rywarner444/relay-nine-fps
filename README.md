# RELAY NINE — The Signal Campaign

**A three-level cyberpunk browser FPS designed to showcase AI-assisted game engineering, procedural 3D environments, deterministic enemy AI, and cybersecurity-inspired mechanics.**

> **Private development build 0.6 — Combat and Clarity.** Separate 3D levels, 14 faster-firing opponents on Mission 01, collectible network artifacts with large pickup prompts, a collision-aware dotted minimap route to the upload computer, hold-the-zone uplinks with cleared-ring feedback, concise pre-level briefings, a mobile 110-HP final boss, checkpoint retries, and a campaign achievement. The fictional adversaries use scripted game logic; trained/adaptive AI, real security evidence analysis, and online LLM integration are **not implemented**.

The internal creative codename is *Ghost Signal*. The user-facing title is Relay Nine.

## Play locally

Requires Node.js **22.12+**, a desktop mouse and keyboard, and a modern WebGL-capable browser. No keys, accounts, servers, databases, or AI credits are required.

```bash
npm ci
npm run dev
```

Open the Vite URL, usually **http://localhost:5173/**. In GitHub Codespaces, go to the forwarded **5173** port. Click **Start Operation**, read the compact three-step mission briefing, and then click **Engage Mission** to enter combat. **Field Manual** opens a full tutorial. **Esc** pauses and releases the mouse. The repo stays private until the owner approves publication.

## The three levels

| Mission | Distinct map | Player objective | Cybersecurity / engineering theme |
|---|---|---|---|
| **01 / Base Floor** | Network operations floor, server racks, real corridors and side wings | Fight through **14** faster-firing patrol drones. The three with **lime halos** drop green network fragments when destroyed. A large **E** prompt appears when you approach each drop. Collect all three; then follow the **lime dotted path on the minimap** to the computer and press **E** to upload. | Artifact recovery, threat classification, restoration workflow |
| **02 / Signal Foundry** | Industrial refinery floor with pipe tanks, new partitions and wide flanking lanes | Reach three separate purple **uplink towers**. Remain in each tower's glowing **7.5m radius for 9 seconds** to charge it to 100%. Keep fighting while capturing. The captured tower **and floor ring both disappear**; the capture HUD appears only inside an active ring. **No E key** needed. | Infrastructure resilience, availability under pressure |
| **03 / Sentinel Arena** | Open circular combat arena with cover and crimson warning lights | **Defeat Aegis-9**, a mobile 110-HP mech. An obvious top-screen health bar tracks armor. Four escort drones defend it, additional drones spawn on timers, and defeated escorts respawn. Killing the Sentinel is the **only** objective. | Threat prioritization, adversarial systems, resource management |

Completing the final fight unlocks an in-game **GHOST PROTOCOL** achievement and victory/debrief screen with score, accuracy, elapsed time, and enemies destroyed. Missions are deliberately compact enough for portfolio reviewers to try in a short browser session.

### Combat and navigation

- Hostile drones move through patrol routes, acquire targets in range, obey line-of-sight checks, and launch visible energy missiles. Mission 01 starts with fourteen hostiles; its fire interval is 1.65 seconds, significantly quicker than the prior 2.1 seconds. Subsequent levels add escalating pressure through faster projectiles and reinforcement timers. Cover stops projectiles; movement and sliding help evade them.
- The ARC-7 carbine is built from detailed beveled geometry and physically based materials. Hitmarkers, recoil, reloads, large proximity-based pickup/insert prompts, colored beacons, the waypoint direction/distance display, and the tactical minimap keep combat legible.
- Each mission starts with **100 health** and full ammo. Losing all health produces a **Defeat** menu with **Retry Mission 0X**—you do **not** have to replay missions you've already passed. Score and elapsed time reset to the start of that mission when retrying.
- Completing missions 01 and 02 saves the **highest unlocked level number** (0, 1, or 2) to `localStorage` in the same browser. Returning players can continue their latest unlocked mission from the intro screen, or choose to restart from level 01. This is a local checkpoint, **not cloud sync**; clearing site data erases the preference.
- The boss fight displays a dedicated red armor bar (`110 / 110`) and periodically introduces reinforcement drones at predetermined times while the Sentinel is alive.
- The earlier amber maintenance drone was removed because it was distracting and had no meaningful role. The unused network-integrity meter was replaced with a live hostile-contact count.
- When the third fragment is collected, the radar calculates a **walkable route around real walls and cover**, drawing it as a luminous dashed line from the player toward the upload computer. That route is deliberately **absent** during other objectives and missions.
- The old red full-screen damage overlay was removed. Damage feedback now pulses the health bar, and the bottom-left engineering/vitals HUD has an opaque dark background to avoid distracting red bleed-through.

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

`check` runs automated Node/TypeScript tests, TypeScript static validation, and the optimized Vite production build. GitHub Actions runs the same checks for pushes and pull requests.

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
5. **v0.6 / Combat and Clarity (current):** denser and faster Mission 01 combat; clear fragment/console interactions; collision-aware dotted minimap guidance; complete uplink-floor cleanup; mission-intel briefing screens; retired maintenance decoy and integrity meter; streamlined health-only damage feedback.
6. **Future:** device-specific performance tuning, audio/FX improvements, additional original 3D/PBR models, gamepad and accessibility polish, gameplay trailer, owner-approved privacy audit and optional public GitHub Pages launch.

## Privacy and AI disclosure

The entire game operates on **synthetic, fictional gameplay data**. There are **no real security telemetry feeds, employer systems, personal-information inputs, accounts, analytics services, tracking scripts, model API keys, or live LLM calls**. Only the unlocked mission number, optional sensitivity, and best score are saved to local browser storage.

The rogue AI antagonist is fictional; enemies are deterministic authored state machines, not trained agents. This repo demonstrates AI-assisted software development and human-directed engineering iteration, **not** a live AI integration or production cybersecurity tool. Source code and assets are to remain **private** until the repository owner explicitly approves a public release.
