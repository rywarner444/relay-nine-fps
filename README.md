# RELAY NINE — Cyberpunk FPS Prototype

**A playable first-person 3D target range built as the foundation for a tactical cyberpunk FPS.**

> **Status:** Private development milestone **0.2 — Performance & Identity**. This is a movement, environment, and shooting prototype. The Cyber Scanner, defensive shield, enemy attacks, adaptive director, boss, and full campaign are *planned*, not implemented.

The internal design codename is *Ghost Signal*, but a different public-facing title will be selected before launch because a commercial game uses that name.

## Quick start

Requires Node.js **22.12+** and a recent desktop browser with WebGL 2. No API keys, accounts, databases, or paid services.

```bash
npm ci
npm run dev
```

Open the local address shown by Vite (normally **http://localhost:5173/**). In GitHub Codespaces, open the forwarded **5173** port. Click **Start Operation** to capture the mouse; press **Esc** to pause and release it. Choose **Field Manual** for a control reference.

### Controls

| Key | Action |
|---|---|
| WASD / mouse | Move / look |
| Left mouse | Fire the ARC-7 Pulse Carbine |
| Shift | Sprint |
| Space | Jump |
| C or Ctrl while moving | Slide (Shift not required) |
| R | Reload |
| Tab | Toggle local engineering metrics |
| Esc | Pause and release mouse |

**Range objective:** Destroy six magenta hostile training drones. Do not fire on the amber maintenance unit: it is a legitimate process, and hitting it reduces network integrity. Drones are scripted and respawn so players can practice repeatedly. This is a training range, not a finished campaign.

### Quality and accessibility

- Graphics presets: Auto, High, Medium, Low. Auto defaults to a lightweight mode and steps down automatically after sustained low FPS. Bloom is only enabled on High; Low removes bloom and ambient particles. Render resolution is budgeted to avoid overwhelming high-DPI screens.
- Static environment meshes are batched by material, cutting the arena from **431 to 121 meshes** and preserving its original geometry. This targets GPU draw-call overhead; performance will still depend on the browser and hardware acceleration.
- The menu and combat HUD have an independent violet/lime visual identity instead of the BREACHWAVE-inspired SOC card layout. Sliding includes a visible camera drop, field-of-view change, and on-screen feedback.
- Browser audio is **off by default** and only synthesized locally when switched on.
- Respects `prefers-reduced-motion` (no bloom in reduced-motion mode).
- The starting menu, tutorial, settings, and result notifications use accessible HTML controls and text cues.
- The core FPS controls are designed for a desktop mouse and keyboard. Mobile play is out of scope for this milestone.

## Engineering architecture

| Module | Role |
|---|---|
| `src/simulation.ts` | Pure, deterministic player movement, collision checks, scoring, and risk consequences |
| `src/arena.ts` | Procedural Three.js world, target meshes, raycast shooting, weapon model, effects |
| `src/main.ts` | FPS camera/input, game loop, pointer lock, HUD, game state, graphic quality |
| `src/audio.ts` | Optional original synthesized sound feedback using Web Audio |
| `src/styles.css` | Responsive menu, manual, and combat overlays |
| `tests/simulation.test.ts` | Automated movement and scoring tests |

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

1. **First Contact / Performance & Identity (current):** Core 3D scene, responsive movement/sprint/jump/slide, pulse carbine, range targets, metrics, manual, batched geometry, distinctive in-game HUD.
2. **Threat Response:** Cyber Scanner, evidence-based classification, shield ability, mission objectives.
3. **AI Director:** Explainable state machines, hostile behaviors, tactical adaptation, reproducible test seeds.
4. **Visual Overhaul:** Optimized original models and textures, upgraded lighting/animation, enhanced audio.
5. **Mission Complete:** Mini-boss, polished tutorial, score/rank screen, accessibility and performance QA.
6. **Portfolio Release:** Security/privacy review, verified asset licenses, public GitHub Pages, video and technical write-up.

## Privacy and security boundaries

Everything displayed is fictional and rendered locally. This prototype contains **no real security telemetry, credentials, employer systems, analytics, backend, third-party trackers, or model API calls**. The optional personal-best score stays in browser local storage. Source assets are currently generated by code rather than downloaded from external asset libraries.

This is a videogame simulation, not an intrusion detection or response product. Game AI has **not** been implemented in milestone 0.1; target behavior is scripted. AI assistance was used for software creation, while the product direction and playtesting priorities were defined by the owner.

The repo remains **private** until the owner reviews and explicitly approves public release.
