# RELAY NINE — The Signal Campaign

**A finishable three-mission cyberpunk browser FPS, built to demonstrate AI-assisted game engineering and cybersecurity-themed interaction design.**

> **Status:** Private development milestone **0.4 — Facility Assault**. Three playable missions now share a much larger, navigable facility with corridors, side wings, cover, a gated north vault, patrolling hostiles that shoot back, 100-point player health, radar, sensitivity settings, a detailed carbine, and a towering multi-part mech boss. The enemy behavior is deterministic and scripted. Trained/adaptive AI, real security evidence analysis, and online LLM integration are **not implemented**.

The internal design codename is *Ghost Signal*, but a different public-facing title will be selected before launch because a commercial game uses that name.

## Quick start

Requires Node.js **22.12+** and a recent desktop browser with WebGL 2. No API keys, accounts, databases, or paid services.

```bash
npm ci
npm run dev
```

Open the local address shown by Vite (normally **http://localhost:5173/**). In GitHub Codespaces, open the forwarded **5173** port. Click **Start Operation** to capture the mouse; press **Esc** to pause and release it. Choose **Field Manual** for a concise control reference and mission walkthrough.

## Three short levels

| Mission | What you do | Security/engineering concept |
|---|---|---|
| **01 / Perimeter Breach** | Fight through the central corridor and side wings; defeat four patrolling magenta drones while avoiding the amber friendly. | Threat classification; false-positive penalties |
| **02 / Signal Trace** | Navigate east/west wings and reach three glowing violet evidence terminals; press **E** close to each to scan while guards fire back. | Investigation; evidence-first response |
| **03 / Ghost Protocol** | Shoot three crimson security locks; enter the opened north vault, defeat the 42-hit giant mech boss, then press **E** at the green shutdown console. | Layered containment; objective-gated enemy state and incident recovery |

An on-screen objective tracker and **direction-and-distance guidance** show what to do next. The new local tactical minimap shows nearby wall layout, the player heading, hostile contacts, the friendly drone, and active objectives. The map is larger than the former range and the north vault has a physical blast door that opens only after the final security locks are destroyed. Each mission has its own hostile difficulty, lighting, and win conditions. Completing a level unlocks the next briefing; the final debrief shows score, accuracy, time, and false positives. Everything works without an account or online API.

### Enemy combat and health

- Hostiles follow authored patrol circuits and fire visible energy projectiles at players they can see. Corridors, walls, crates, and the vault door block shots; sliding and repositioning can evade projectiles.
- Player health starts at **100 per mission**. Taking fire decreases the health bar. Reaching zero ends the mission and offers a campaign replay. *Network integrity* is separate: shooting a friendly decreases integrity instead.
- Mission difficulty rises through tuned enemy speed, health, projectile velocity, attack frequency, and damage. The final mech is a larger, detailed model with **42 hit points** and its own faster projectile pattern.
- This is an explainable deterministic game AI (scripted patrols, visibility checks, projectiles), not a model that learns or calls a service.

### Controls

| Key | Action |
|---|---|
| WASD / mouse | Move / look |
| Left mouse | Fire the ARC-7 Pulse Carbine |
| Shift | Sprint |
| Space | Jump |
| C or Ctrl while moving | Slide (Shift not required) |
| E near a violet beacon or green console | Scan fictional evidence (mission 02) / shut down the mainframe (mission 03) |
| R | Reload |
| Tab | Toggle local engineering metrics |
| Esc | Pause and release mouse |

**Settings:** Pause with Esc to change the graphics preset or move the **mouse sensitivity slider** between 50% and 250%. The setting is stored only in your own browser.

**Important:** Targets are fictional scripted drones. Hostiles stay eliminated for the duration of a mission. Shooting the amber maintenance unit damages network integrity, and reaching zero ends the run. Progress is session-based; after completion you can replay the full campaign.

### Quality and accessibility

- Graphics presets: Auto, High, Medium, Low. Auto defaults to a lightweight mode and steps down automatically after sustained low FPS. Bloom is only enabled on High; Low removes bloom and ambient particles. Render resolution is budgeted to avoid overwhelming high-DPI screens.
- Architecture is batched by material and the detailed, multi-part carbine is merged into only a few material batches. The expanded map uses approximately **140 visible meshes** in the first mission before temporary effects, keeping the FPS draw-call footprint modest even as the traversable space has grown. Performance still depends on the browser and GPU.
- Materials use an original generated metal-grunge texture, physically based highlights, beveled weapon armor, detailed server-rack fronts, doorway trims, and a larger articulated mech silhouette. This is a **higher-detail stylized presentation**, not photorealistic AAA asset quality; professional authored PBR models and texture sets would be a separate art-production pass.
- The menu and combat HUD have an independent violet/lime visual identity instead of the BREACHWAVE-inspired SOC card layout. Sliding includes a visible camera drop, field-of-view change, and on-screen feedback. Mission 02 introduces violet signal architecture; mission 03 shifts toward an urgent crimson containment palette.
- Browser audio is **off by default** and only synthesized locally when switched on.
- Respects `prefers-reduced-motion` (no bloom in reduced-motion mode).
- The starting menu, tutorial, settings, next-mission transition, result debrief, and notifications use accessible HTML controls and text cues.
- The minimap uses a small, independently drawn 2D canvas instead of a second 3D camera render; its update rate is deliberately limited to reduce GPU load.
- The core FPS controls are designed for a desktop mouse and keyboard. Mobile play is out of scope for this milestone.

## Engineering architecture

| Module | Role |
|---|---|
| `src/simulation.ts` | Pure, deterministic player movement, collision checks, scoring, and false-positive consequences |
| `src/campaign.ts` | Pure event-driven mission state machine, progression guards, and objectives |
| `src/facility.ts` | Single source of truth for corridor wall coordinates, doorway layout, and vault door collision |
| `src/combat.ts` | Pure combat difficulty tables, projectile collision, cover/visibility and health math |
| `src/arena.ts` | Procedural Three.js facility, rounded high-detail carbine, patrol drones, boss mech, projectile visuals, raycast shooting |
| `src/main.ts` | FPS input, player health, tactical minimap, sensitivity, mission states and graphics presets |
| `src/audio.ts` | Optional original synthesized sound feedback using Web Audio |
| `src/styles.css` | Responsive menu, manual, and combat overlays |
| `tests/*.test.ts` | Automated progression, mission interactions, arena raycasts, movement, scoring, and UI contract tests |

Run verification before committing:

```bash
npm run check
```

The check executes deterministic unit tests, TypeScript typechecking, and a production Vite build. GitHub Actions runs it for every push to `main` and for pull requests.

Optional desktop-browser smoke test (requires an installed Chromium browser):

```bash
npm run smoke
```

The smoke test starts Vite, checks the menu and deployment flow, captures local screenshots under `artifacts/`, and reports browser errors. It uses an installed Google Chrome browser by default; set `CHROMIUM_PATH` to use a specific Chrome/Chromium executable instead. This optional check requires a browser installed outside Node dependencies.

## Roadmap

1. **First Contact / Performance & Identity (shipped v0.2):** Core 3D scene, responsive movement/sprint/jump/slide, pulse carbine, batched geometry, graphics options, distinct combat HUD.
2. **The Signal Campaign (shipped v0.3):** Three levels, evidence-beacon interaction, objective tracking and wayfinding, AI-themed security locks, sentinel encounter, stage briefs and debrief.
3. **Facility Assault (shipped v0.4):** Expanded corridor/wing/vault map, live enemy patrols and incoming fire, player health, minimap, configurable sensitivity, fortified gated vault, larger boss mech and higher-detail procedural weapon/environment materials.
4. **Presentation (future):** Professionally authored 3D/PBR asset packs, dynamic soundscapes, improved enemy animations and cinematic mission transitions; optimize and profile on actual GPUs.
5. **Portfolio Release (future):** Full browser playtesting across machines, security/privacy audit, verified asset licenses, public GitHub Pages, short gameplay video, technical write-up.

## Privacy and security boundaries

Everything displayed is fictional and rendered locally. This prototype contains **no real security telemetry, credentials, employer systems, analytics, backend, third-party trackers, or model API calls**. Optional personal-best score and mouse sensitivity preferences stay in browser local storage. Source geometry and textures are generated by code rather than downloaded from external asset libraries.

This is a videogame simulation, not an intrusion detection or response product. The “AI” is a fictional boss and authored state rules; no model is trained, called, or billed. AI assistance was used for software creation, while the product direction and playtesting priorities were defined by the owner.

The repo remains **private** until the owner reviews and explicitly approves public release.
