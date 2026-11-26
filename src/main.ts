import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RelayNineArena, type GraphicsTier } from './arena';
import { RangeAudio } from './audio';
import { MISSIONS, missionProgress, recordMissionEvent, startMission, type CampaignState } from './campaign';
import {
  advancePlayer, initialPlayer, initialStats, recordShot, shotAccuracy,
  type PlayerMotion, type RangeStats,
} from './simulation';
import './styles.css';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element: ${id}`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>('gameCanvas');
const menuOverlay = element<HTMLElement>('menuOverlay');
const deployButton = element<HTMLButtonElement>('deployButton');
const restartButton = element<HTMLButtonElement>('restartButton');
const manualDeploy = element<HTMLButtonElement>('manualDeploy');
const manualDialog = element<HTMLDialogElement>('manualDialog');
const engineeringPanel = element<HTMLElement>('engineeringPanel');
const qualitySelect = element<HTMLSelectElement>('qualitySelect');
const soundButton = element<HTMLButtonElement>('soundButton');
const ammoTrack = element<HTMLElement>('ammoTrack');

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
} catch {
  menuOverlay.hidden = true;
  const status = element<HTMLElement>('statusBanner');
  status.hidden = false;
  status.textContent = 'This browser could not start WebGL. Please enable hardware acceleration or try a recent Chrome, Edge, or Firefox browser.';
  throw new Error('WebGL is unavailable on this device.');
}

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;

const arena = new RelayNineArena();
const audio = new RangeAudio();
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(arena.scene, arena.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.55, 0.89);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const keys = new Set<string>();
let player: PlayerMotion = initialPlayer();
let stats: RangeStats = initialStats();
let campaign: CampaignState = startMission(0);
let sessionStarted = false;
let paused = true;
let menuMode: 'intro' | 'pause' | 'between' | 'victory' | 'failed' = 'intro';
let yaw = 0;
let pitch = -0.03;
let fireHeld = false;
let jumpPressed = false;
let slidePressed = false;
let slideBuffer = 0;
let lastFireTime = 0;
let ammo = 30;
let reloading = 0;
let lastTime = performance.now();
let gameTime = 0;
let visibleTime = 0;
let fpsFrames = 0;
let fpsTotal = 0;
let fps = 0;
let frameMs = 0;
let strugglingSeconds = 0;
let autoTierOverride: GraphicsTier | null = null;
let notifyTimer: number | undefined;
let hitTimer: number | undefined;
let taskComplete = false;
let runTime = 0;
let waypointRefresh = 0;
let bobEye = 1.72;
let lastWalkAmount = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setVisibleGameHud(visible: boolean): void {
  for (const id of [
    'hudTop', 'objectivePanel', 'telemetryPanel', 'crosshair', 'weaponPanel', 'movementHint', 'engineeringButton', 'waypointPanel',
  ]) element<HTMLElement>(id).hidden = !visible;
  if (!visible) engineeringPanel.hidden = true;
}

function announce(message: string, kind: 'neutral' | 'success' | 'danger' = 'neutral', duration = 2900): void {
  const toast = element<HTMLElement>('toast');
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.hidden = false;
  window.clearTimeout(notifyTimer);
  notifyTimer = window.setTimeout(() => { toast.hidden = true; }, duration);
}

function showHitmarker(kind: 'hostile' | 'neutral' | 'objective'): void {
  const hit = element<HTMLElement>('hitmarker');
  hit.hidden = false;
  hit.dataset.kind = kind;
  window.clearTimeout(hitTimer);
  hitTimer = window.setTimeout(() => { hit.hidden = true; }, 115);
}

function updateStats(): void {
  element('scoreValue').textContent = String(stats.score).padStart(4, '0');
  element('accuracyValue').textContent = stats.shots === 0 ? '—' : `${shotAccuracy(stats)}%`;
  element('coreIntegrity').textContent = `${stats.integrity}%`;
  element<HTMLElement>('integrityFill').style.width = `${stats.integrity}%`;
  const progress = missionProgress(campaign);
  element('objectiveTitle').textContent = progress.title;
  element('objectiveText').textContent = progress.hint;
  element('objectiveCaption').textContent = progress.label;
  element('objectiveCount').textContent = `${progress.current} / ${progress.total}`;
  element<HTMLElement>('objectiveFill').style.width = `${progress.current / progress.total * 100}%`;
  element('bossHealth').textContent = campaign.mission === 2 && campaign.completed.length >= 3
    ? `SENTINEL ARMOR // ${Math.max(0, Math.ceil(arena.sentinelHealth / 9 * 100))}%` : '';
  if (progress.complete && !taskComplete) {
    taskComplete = true;
    announce('MISSION COMPLETE // SECURITY OBJECTIVES MET', 'success', 3500);
    audio.destroy();
    pauseGame();
    menuMode = campaign.mission === MISSIONS.length - 1 ? 'victory' : 'between';
    showMenu(menuMode);
  }
  if (stats.integrity <= 0 && menuMode !== 'failed' && !progress.complete) {
    pauseGame();
    menuMode = 'failed';
    showMenu('failed');
    announce('NETWORK INTEGRITY LOST // OPERATION FAILED', 'danger', 3500);
  }
}

function showMenu(mode: typeof menuMode): void {
  const next = mode === 'between' ? MISSIONS[campaign.mission + 1] : MISSIONS[campaign.mission];
  const current = MISSIONS[campaign.mission];
  const completed = mode === 'victory';
  const failed = mode === 'failed';
  const between = mode === 'between';
  const pausedHere = mode === 'pause';
  element('menuHeadline').innerHTML = completed ? 'FACILITY<br><em>SECURED.</em>'
    : failed ? 'SIGNAL<br><em>LOST.</em>'
      : between ? 'MISSION<br><em>CLEARED.</em>'
        : pausedHere ? 'OPERATION<br><em>PAUSED.</em>' : 'ENTER THE<br><em>UNKNOWN.</em>';
  element('menuDescription').textContent = completed
    ? 'You classified threats, followed the evidence, and contained a fictional rogue AI. Three operations. One recovered facility.'
    : failed ? 'Friendly network integrity reached zero. Reset and try again—accuracy matters more than speed.'
      : between ? `${current.name} complete. ${next.briefing}`
        : pausedHere ? `Mission ${current.number}: ${current.briefing}`
          : 'Three short cyberpunk FPS missions. Identify a threat, follow the evidence, and shut down a rogue AI. No accounts or real security systems.';
  element('missionNumber').textContent = next.number;
  element('missionName').textContent = next.name;
  element('missionDescription').textContent = next.lesson;
  element('menuMissionNumber').textContent = `[ MISSION ${next.number} / 03 ]`;
  element('missionTag').textContent = next.codename;
  element('menuStatus').textContent = completed ? 'CAMPAIGN COMPLETE' : failed ? 'SIMULATION FAILED' : between ? 'NEXT ASSIGNMENT' : pausedHere ? 'PAUSED' : '3-MISSION MICRO CAMPAIGN';
  deployButton.innerHTML = completed || failed ? '<span>↻</span> REPLAY CAMPAIGN'
    : between ? '<span>▶</span> NEXT MISSION' : pausedHere ? '<span>▶</span> RESUME OPERATION' : '<span>▶</span> START OPERATION';
  const debrief = element<HTMLElement>('debrief');
  debrief.hidden = !(completed || failed);
  if (!debrief.hidden) {
    element('debriefStats').textContent = `SCORE ${stats.score.toLocaleString()} · ACCURACY ${stats.shots ? `${shotAccuracy(stats)}%` : '—'} · ${Math.floor(runTime / 60)}:${String(Math.floor(runTime % 60)).padStart(2, '0')} · ${stats.falsePositives} FALSE POSITIVES`;
    element('debriefRank').textContent = failed ? 'RETRY' : stats.falsePositives === 0 && shotAccuracy(stats) >= 60 ? 'S // CLEAN RESPONSE' : 'A // MISSION COMPLETE';
    if (completed) {
      try {
        const prior = Number(localStorage.getItem('relay-nine-campaign-best') ?? 0);
        if (stats.score > prior) localStorage.setItem('relay-nine-campaign-best', String(stats.score));
      } catch { /* Browser local storage is optional. */ }
    }
  }
  restartButton.hidden = mode === 'intro' || completed || failed;
  menuOverlay.hidden = false;
}

function updateAmmo(): void {
  element('ammoValue').textContent = reloading > 0 ? '↻' : String(ammo).padStart(2, '0');
  ammoTrack.innerHTML = '';
  const lit = Math.round(ammo / 30 * 15);
  for (let i = 0; i < 15; i += 1) {
    const cell = document.createElement('span');
    cell.className = i < lit ? 'charged' : '';
    ammoTrack.append(cell);
  }
}

function resolveTier(): GraphicsTier {
  const selected = qualitySelect.value;
  if (selected === 'low' || selected === 'medium' || selected === 'high') return selected;
  // Device thread count is not a reliable proxy for GPU power (especially in VMs).
  return autoTierOverride ?? 'medium';
}

let tier: GraphicsTier = resolveTier();

function resize(): void {
  tier = resolveTier();
  // Render-pixel budgets matter more than UI resolution for integrated/software GPUs.
  const maxPixels = tier === 'high' ? 2_300_000 : tier === 'medium' ? 1_200_000 : 650_000;
  const ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(maxPixels / (window.innerWidth * window.innerHeight)));
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  arena.camera.aspect = window.innerWidth / window.innerHeight;
  arena.camera.updateProjectionMatrix();
  composer.setPixelRatio(ratio);
  composer.setSize(window.innerWidth, window.innerHeight);
  // Postprocessing is a premium preset effect, never needed for standard gameplay.
  bloom.enabled = tier === 'high' && !reducedMotion.matches;
  bloom.strength = 0.32;
  arena.setGraphicsTier(tier);
}

function enterMission(index: number): void {
  campaign = startMission(index);
  arena.setMission(index);
  player = initialPlayer();
  ammo = 30;
  reloading = 0;
  taskComplete = false;
  yaw = 0;
  pitch = -0.03;
  slideBuffer = 0;
  slidePressed = false;
  element<HTMLElement>('slideStatus').hidden = true;
  element<HTMLElement>('speedLines').classList.remove('active');
  element('hudMission').textContent = `${MISSIONS[index].name} / ${String(index + 1).padStart(2, '0')} OF 03`;
  element('objectiveStep').textContent = `0${index + 1} / 03`;
  element('missionStrip').textContent = MISSIONS.map((_, i) => i < index ? '◆' : i === index ? '◈' : '◇').join('  ');
  document.body.dataset.mission = String(index + 1);
  updateStats();
  updateAmmo();
}

function resetCampaign(): void {
  stats = initialStats();
  runTime = 0;
  sessionStarted = false;
  enterMission(0);
}

async function requestLock(): Promise<void> {
  try {
    await canvas.requestPointerLock();
  } catch {
    announce('Click the 3D scene to capture your mouse.', 'neutral');
  }
}

async function deploy(): Promise<void> {
  if (menuMode === 'victory' || menuMode === 'failed') resetCampaign();
  else if (menuMode === 'between') enterMission(campaign.mission + 1);
  else if (!sessionStarted) enterMission(0);
  menuMode = 'pause';
  sessionStarted = true;
  paused = false;
  keys.clear();
  fireHeld = false;
  menuOverlay.hidden = true;
  setVisibleGameHud(true);
  restartButton.hidden = false;
  lastTime = performance.now();
  await requestLock();
  announce(`${MISSIONS[campaign.mission].number} // ${MISSIONS[campaign.mission].name}`, 'neutral', 3400);
}

function pauseGame(): void {
  if (!sessionStarted || paused) return;
  paused = true;
  keys.clear();
  fireHeld = false;
  slideBuffer = 0;
  element<HTMLElement>('slideStatus').hidden = true;
  element<HTMLElement>('speedLines').classList.remove('active');
  if (menuMode !== 'between' && menuMode !== 'victory' && menuMode !== 'failed') {
    menuMode = 'pause';
    showMenu('pause');
  }
  if (document.pointerLockElement === canvas) void document.exitPointerLock();
}

function openManual(): void {
  if (!paused) pauseGame();
  if (!manualDialog.open) manualDialog.showModal();
}

function toggleEngineering(): void {
  engineeringPanel.hidden = !engineeringPanel.hidden;
  element<HTMLButtonElement>('engineeringButton').setAttribute('aria-pressed', String(!engineeringPanel.hidden));
}

function reload(): void {
  if (reloading > 0 || ammo === 30) return;
  reloading = 1.35;
  audio.reload();
  updateAmmo();
}

function shoot(now: number): void {
  if (paused || document.pointerLockElement !== canvas || reloading > 0 || now - lastFireTime < 0.135) return;
  if (ammo <= 0) { reload(); return; }
  lastFireTime = now;
  ammo -= 1;
  const hit = arena.fire();
  stats = recordShot(stats, hit.kind, hit.destroyed);
  if (hit.destroyed && hit.targetId) {
    if (hit.kind === 'objective') campaign = recordMissionEvent(campaign, { type: 'lock', id: hit.targetId });
    else if (hit.targetId === 'SENTINEL') campaign = recordMissionEvent(campaign, { type: 'sentinel', id: hit.targetId });
    else if (hit.kind === 'hostile') campaign = recordMissionEvent(campaign, { type: 'elimination', id: hit.targetId });
  }
  audio.fire();
  if (hit.kind !== 'miss') {
    showHitmarker(hit.kind);
    if (hit.kind === 'neutral') {
      audio.warning();
      announce('FALSE POSITIVE // FRIENDLY MAINTENANCE UNIT', 'danger', 2800);
      element<HTMLElement>('damageFlash').classList.remove('pulse');
      void element<HTMLElement>('damageFlash').offsetWidth;
      element<HTMLElement>('damageFlash').classList.add('pulse');
    } else if (hit.kind === 'objective') {
      audio.destroy();
      announce(campaign.completed.length === 3 ? 'FIREWALL DOWN // SENTINEL EXPOSED' : 'AI SECURITY LOCK DISABLED', 'success', 2300);
    } else if (hit.destroyed) {
      audio.destroy();
      announce('HOSTILE SIGNATURE NEUTRALIZED', 'success', 1200);
    } else audio.hit();
  }
  if (ammo === 0) reload();
  updateAmmo();
  updateStats();
}

function collectEvidence(): void {
  if (campaign.mission !== 1 || paused) return;
  const id = arena.scanNearby(player.x, player.z);
  if (!id) { announce('MOVE CLOSER TO A VIOLET EVIDENCE BEACON', 'neutral', 1800); return; }
  campaign = recordMissionEvent(campaign, { type: 'evidence', id });
  stats = { ...stats, score: stats.score + 300 };
  audio.destroy();
  announce(`EVIDENCE VERIFIED // ${id} CAPTURED`, 'success', 2200);
  updateStats();
}

function updateWaypoint(): void {
  const panel = element<HTMLElement>('waypointPanel');
  const nearby = arena.getWaypoint(player.x, player.z);
  if (!nearby) { panel.textContent = 'SECTOR SECURED'; return; }
  const { dx, dz } = nearby;
  const ahead = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
  const side = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  const angle = Math.atan2(side, ahead);
  const direction = Math.abs(angle) > 2.4 ? 'BEHIND' : angle < -0.48 ? '◀ LEFT' : angle > 0.48 ? 'RIGHT ▶' : '▲ AHEAD';
  const action = campaign.mission === 1 && nearby.distance <= 3.1 ? ' · PRESS E TO SCAN' : '';
  panel.textContent = `◈ ${nearby.id}  /  ${Math.round(nearby.distance)}M  /  ${direction}${action}`;
  panel.classList.toggle('interact-ready', action.length > 0);
}

function updateMetrics(delta: number): void {
  fpsTotal += delta;
  fpsFrames += 1;
  if (fpsTotal >= 0.6) {
    fps = Math.round(fpsFrames / fpsTotal);
    frameMs = (fpsTotal / fpsFrames) * 1000;
    fpsTotal = 0;
    fpsFrames = 0;
    element('fpsChip').textContent = `${fps} FPS`;
    if (!paused && qualitySelect.value === 'auto' && tier === 'medium' && fps > 0 && fps < 35) {
      strugglingSeconds += 0.6;
      if (strugglingSeconds >= 2.4) {
        autoTierOverride = 'low';
        strugglingSeconds = 0;
        resize();
        announce('PERFORMANCE MODE ENABLED // PRESS ESC FOR SETTINGS', 'neutral', 4000);
      }
    } else strugglingSeconds = 0;
  }
  if (!engineeringPanel.hidden) {
    element('metricFps').textContent = `${fps} FPS`;
    element('metricFrame').textContent = `${frameMs.toFixed(1)} ms`;
    element('metricDraw').textContent = String(renderer.info.render.calls);
    element('metricPosition').textContent = `${player.x.toFixed(1)}, ${player.z.toFixed(1)}`;
    element('metricTargets').textContent = String(arena.activeHostiles);
    element('metricQuality').textContent = tier.toUpperCase();
  }
}

function loop(timeMs: number): void {
  const rawElapsed = Math.max(0, Math.min((timeMs - lastTime) / 1000, 0.5));
  const elapsed = Math.min(rawElapsed, 0.05);
  lastTime = timeMs;
  visibleTime += elapsed;
  if (!paused) {
    gameTime += elapsed;
    runTime += elapsed;
    waypointRefresh -= elapsed;
    if (waypointRefresh <= 0) { waypointRefresh = 0.16; updateWaypoint(); }
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const prior = player;
    player = advancePlayer(player, { forward, right, sprint, jumpPressed, slidePressed: slidePressed || slideBuffer > 0 }, yaw, elapsed, arena.blockers);
    jumpPressed = false;
    slidePressed = false;
    slideBuffer = Math.max(0, slideBuffer - rawElapsed);
    if (prior.slideRemaining === 0 && player.slideRemaining > 0) slideBuffer = 0;
    const isSliding = player.slideRemaining > 0;
    element<HTMLElement>('slideStatus').hidden = !isSliding;
    element<HTMLElement>('speedLines').classList.toggle('active', isSliding && !reducedMotion.matches);
    lastWalkAmount = Math.hypot(player.x - prior.x, player.z - prior.z) / Math.max(elapsed, 0.001) / 6;
    const eyeTarget = isSliding ? 1.02 : 1.72;
    bobEye += (eyeTarget - bobEye) * Math.min(elapsed * 19, 1);
    arena.camera.position.set(player.x, bobEye + player.lift, player.z);
    arena.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    const targetFov = isSliding ? 82 : sprint && (forward !== 0 || right !== 0) ? 78 : 74;
    const nextFov = arena.camera.fov + (targetFov - arena.camera.fov) * Math.min(elapsed * 8, 1);
    if (Math.abs(nextFov - arena.camera.fov) > 0.02) {
      arena.camera.fov = nextFov;
      arena.camera.updateProjectionMatrix();
    }
    if (fireHeld) shoot(timeMs / 1000);
    if (reloading > 0) {
      reloading -= elapsed;
      if (reloading <= 0) { ammo = 30; reloading = 0; updateAmmo(); }
    }
  }
  arena.update(paused ? elapsed * 0.18 : elapsed, paused ? visibleTime * 0.16 : gameTime, lastWalkAmount, player.slideRemaining > 0);
  if (bloom.enabled) composer.render();
  else renderer.render(arena.scene, arena.camera);
  updateMetrics(rawElapsed);
}

deployButton.addEventListener('click', () => { void deploy(); });
restartButton.addEventListener('click', () => { resetCampaign(); menuMode = 'intro'; void deploy(); });
manualDeploy.addEventListener('click', () => { manualDialog.close(); void deploy(); });
element('tutorialButton').addEventListener('click', openManual);
element('closeManual').addEventListener('click', () => manualDialog.close());
element('pauseButton').addEventListener('click', pauseGame);
element('engineeringButton').addEventListener('click', toggleEngineering);
qualitySelect.addEventListener('change', () => { autoTierOverride = null; strugglingSeconds = 0; resize(); });
soundButton.addEventListener('click', () => {
  void audio.setEnabled(!audio.enabled).then(() => {
    soundButton.textContent = audio.enabled ? '♫ SOUND ON' : '♫ SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(audio.enabled));
  });
});
canvas.addEventListener('click', () => { if (sessionStarted && !paused && document.pointerLockElement !== canvas) void requestLock(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && sessionStarted && !paused) pauseGame();
});
document.addEventListener('mousemove', (event) => {
  if (paused || document.pointerLockElement !== canvas) return;
  const sensitivity = 0.00195;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});
document.addEventListener('mousedown', (event) => { if (event.button === 0 && document.pointerLockElement === canvas) fireHeld = true; });
document.addEventListener('mouseup', (event) => { if (event.button === 0) fireHeld = false; });
window.addEventListener('blur', () => { if (!paused) pauseGame(); });
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && document.pointerLockElement === canvas) { pauseGame(); return; }
  if (event.code === 'Tab' && sessionStarted && !paused) { event.preventDefault(); toggleEngineering(); return; }
  if (paused) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Space' && !event.repeat) jumpPressed = true;
  if ((event.code === 'KeyC' || event.code === 'ControlLeft') && !event.repeat) {
    slidePressed = true;
    slideBuffer = 0.2;
  }
  if (event.code === 'KeyR' && !event.repeat) reload();
  if (event.code === 'KeyE' && !event.repeat) collectEvidence();
  keys.add(event.code);
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', resize);
reducedMotion.addEventListener('change', resize);

resize();
resetCampaign();
showMenu('intro');
setVisibleGameHud(false);
renderer.setAnimationLoop(loop);
