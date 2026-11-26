# RELAY NINE — The Signal Campaign

**A finishable three-mission cyberpunk browser FPS, built to demonstrate AI-assisted game engineering and cybersecurity-themed interaction design.**

> **Status:** Private development milestone **0.3 — The Signal Campaign**. Three playable missions, a proximity-based evidence scan, mission transitions, a scripted rogue-AI sentinel, and a final score debrief are implemented. Enemy attacks, adaptive AI, real evidence analysis, and online LLM integration are **not implemented**.

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
| **01 / Perimeter Breach** | Find and eliminate four magenta rogue drones, avoiding the friendly amber unit. | Threat classification; false-positive penalties |
| **02 / Signal Trace** | Follow the directional HUD to three tall violet evidence beacons; approach and press **E** to extract each signal. | Investigation; evidence-first response |
| **03 / Ghost Protocol** | Shoot three crimson security locks to expose the larger sentinel, then defeat it with the pulse carbine. | Layered containment; objective-gated enemy state |

An on-screen objective tracker shows progress and a **direction-and-distance beacon** guides the player. Missions have different lighting, highlighted geometry, and win conditions within one connected facility. A completion screen unlocks the next assignment; the final debrief shows score, accuracy, time, and false positives. A campaign replay button lets employers see the complete experience without creating an account. Typical playtime depends on FPS experience.

### Controls

| Key | Action |
|---|---|
| WASD / mouse | Move / look |
| Left mouse | Fire the ARC-7 Pulse Carbine |
| Shift | Sprint |
| Space | Jump |
| C or Ctrl while moving | Slide (Shift not required) |
| E when close to a violet beacon | Scan and collect fictional evidence (mission 02) |
| R | Reload |
| Tab | Toggle local engineering metrics |
| Esc | Pause and release mouse |

**Important:** Targets are fictional scripted drones. Hostiles stay eliminated for the duration of a mission. Shooting the amber maintenance unit damages network integrity, and reaching zero ends the run. Progress is session-based; after completion you can replay the full campaign.

### Quality and accessibility

- Graphics presets: Auto, High, Medium, Low. Auto defaults to a lightweight mode and steps down automatically after sustained low FPS. Bloom is only enabled on High; Low removes bloom and ambient particles. Render resolution is budgeted to avoid overwhelming high-DPI screens.
- Static environment meshes are batched by material, cutting the arena from **431 to 121 meshes** and preserving its original geometry. This targets GPU draw-call overhead; performance will still depend on the browser and hardware acceleration.
- The menu and combat HUD have an independent violet/lime visual identity instead of the BREACHWAVE-inspired SOC card layout. Sliding includes a visible camera drop, field-of-view change, and on-screen feedback. Mission 02 introduces violet signal architecture; mission 03 shifts toward an urgent crimson containment palette.
- Browser audio is **off by default** and only synthesized locally when switched on.
- Respects `prefers-reduced-motion` (no bloom in reduced-motion mode).
- The starting menu, tutorial, settings, next-mission transition, result debrief, and notifications use accessible HTML controls and text cues.
- The core FPS controls are designed for a desktop mouse and keyboard. Mobile play is out of scope for this milestone.

## Engineering architecture

| Module | Role |
|---|---|
| `src/simulation.ts` | Pure, deterministic player movement, collision checks, scoring, and false-positive consequences |
| `src/campaign.ts` | Pure event-driven mission state machine, progression guards, and objectives |
| `src/arena.ts` | Procedural Three.js world, level-specific markers/lighting, raycast shooting, scripted sentinel, effects |
| `src/main.ts` | FPS camera/input, game loop, pointer lock, HUD, game state, graphic quality |
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
3. **Adversary Behaviors (future):** Telegraphable hostile attacks and an explainable, deterministic enemy-behavior state machine.
4. **Presentation (future):** More dramatic environment differences, original optimized character models, enhanced audio, cinematic stage transitions.
5. **Portfolio Release (future):** Browser QA across machines, security/privacy audit, verified asset licenses, public GitHub Pages, short gameplay video, technical write-up.

## Privacy and security boundaries

Everything displayed is fictional and rendered locally. This prototype contains **no real security telemetry, credentials, employer systems, analytics, backend, third-party trackers, or model API calls**. The optional personal-best score stays in browser local storage. Source assets are currently generated by code rather than downloaded from external asset libraries.

This is a videogame simulation, not an intrusion detection or response product. The “AI” is a fictional boss and authored state rules; no model is trained, called, or billed. AI assistance was used for software creation, while the product direction and playtesting priorities were defined by the owner.

The repo remains **private** until the owner reviews and explicitly approves public release.
