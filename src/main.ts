import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RelayNineArena, type GraphicsTier } from './arena';
import { RangeAudio } from './audio';
import {
  advancePlayer, initialPlayer, initialStats, recordShot, shotAccuracy, RANGE_GOAL,
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
let sessionStarted = false;
let paused = true;
let yaw = 0;
let pitch = -0.03;
let fireHeld = false;
let jumpPressed = false;
let slidePressed = false;
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
let notifyTimer: number | undefined;
let hitTimer: number | undefined;
let taskComplete = false;
let bobEye = 1.72;
let lastWalkAmount = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setVisibleGameHud(visible: boolean): void {
  for (const id of [
    'hudTop', 'objectivePanel', 'telemetryPanel', 'crosshair', 'weaponPanel', 'movementHint', 'engineeringButton',
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

function showHitmarker(kind: 'hostile' | 'neutral'): void {
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
  element('objectiveCount').textContent = `${Math.min(stats.eliminations, RANGE_GOAL)} / ${RANGE_GOAL}`;
  element<HTMLElement>('objectiveFill').style.width = `${Math.min(100, stats.eliminations / RANGE_GOAL * 100)}%`;
  if (stats.eliminations >= RANGE_GOAL && !taskComplete) {
    taskComplete = true;
    element('objectiveTitle').textContent = 'Training objective complete';
    element('objectiveText').textContent = 'Range secured. Continue practicing or press Esc to pause.';
    announce('DIRECTIVE COMPLETE // RANGE SECURED', 'success', 5000);
    audio.destroy();
    try {
      const prior = Number(localStorage.getItem('relay-nine-best-score') ?? 0);
      if (stats.score > prior) localStorage.setItem('relay-nine-best-score', String(stats.score));
    } catch { /* Local storage is optional. */ }
  }
  if (stats.integrity <= 0) {
    element('objectiveTitle').textContent = 'Simulation integrity lost';
    element('objectiveText').textContent = 'You destroyed too many friendly processes. Restart the range to try again.';
    announce('NETWORK INTEGRITY CRITICAL // RESET RECOMMENDED', 'danger', 5500);
    pauseGame();
  }
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
  return navigator.hardwareConcurrency >= 8 && window.innerWidth > 1080 ? 'high' : 'medium';
}

let tier: GraphicsTier = resolveTier();

function resize(): void {
  tier = resolveTier();
  const ratio = tier === 'high' ? Math.min(window.devicePixelRatio, 1.65) : tier === 'medium' ? Math.min(window.devicePixelRatio, 1.2) : 0.85;
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  arena.camera.aspect = window.innerWidth / window.innerHeight;
  arena.camera.updateProjectionMatrix();
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.enabled = tier !== 'low' && !reducedMotion.matches;
  bloom.strength = tier === 'high' ? 0.44 : 0.23;
  arena.setGraphicsTier(tier);
}

function resetRange(): void {
  player = initialPlayer();
  stats = initialStats();
  arena.resetDrones();
  ammo = 30;
  reloading = 0;
  taskComplete = false;
  yaw = 0;
  pitch = -0.03;
  element('objectiveTitle').textContent = 'Clear the hostile drone signatures';
  element('objectiveText').textContent = 'Aim at magenta drones and fire. Avoid the amber maintenance unit.';
  updateStats();
  updateAmmo();
}

async function requestLock(): Promise<void> {
  try {
    await canvas.requestPointerLock();
  } catch {
    announce('Click the 3D scene to capture your mouse.', 'neutral');
  }
}

async function deploy(): Promise<void> {
  if (!sessionStarted || stats.integrity <= 0) resetRange();
  sessionStarted = true;
  paused = false;
  keys.clear();
  fireHeld = false;
  menuOverlay.hidden = true;
  setVisibleGameHud(true);
  restartButton.hidden = false;
  lastTime = performance.now();
  await requestLock();
  announce('FIRST CONTACT // TARGET RANGE ONLINE');
}

function pauseGame(): void {
  if (!sessionStarted || paused) return;
  paused = true;
  keys.clear();
  fireHeld = false;
  menuOverlay.hidden = false;
  deployButton.innerHTML = '<span>▶</span> RESUME TRAINING';
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
  audio.fire();
  if (hit.kind !== 'miss') {
    showHitmarker(hit.kind);
    if (hit.kind === 'neutral') {
      audio.warning();
      announce('FALSE POSITIVE // FRIENDLY MAINTENANCE UNIT', 'danger', 2800);
      element<HTMLElement>('damageFlash').classList.remove('pulse');
      void element<HTMLElement>('damageFlash').offsetWidth;
      element<HTMLElement>('damageFlash').classList.add('pulse');
    } else if (hit.destroyed) {
      audio.destroy();
      announce('HOSTILE SIGNATURE NEUTRALIZED', 'success', 1200);
    } else audio.hit();
  }
  if (ammo === 0) reload();
  updateAmmo();
  updateStats();
}

function updateMetrics(delta: number): void {
  fpsTotal += delta;
  fpsFrames += 1;
  if (fpsTotal >= 0.6) {
    fps = Math.round(fpsFrames / fpsTotal);
    frameMs = (fpsTotal / fpsFrames) * 1000;
    fpsTotal = 0;
    fpsFrames = 0;
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
  const elapsed = Math.max(0, Math.min((timeMs - lastTime) / 1000, 0.05));
  lastTime = timeMs;
  visibleTime += elapsed;
  if (!paused) {
    gameTime += elapsed;
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const prior = player;
    player = advancePlayer(player, { forward, right, sprint, jumpPressed, slidePressed }, yaw, elapsed, arena.blockers);
    jumpPressed = false;
    slidePressed = false;
    lastWalkAmount = Math.hypot(player.x - prior.x, player.z - prior.z) / Math.max(elapsed, 0.001) / 6;
    const eyeTarget = player.slideRemaining > 0 ? 1.13 : 1.72;
    bobEye += (eyeTarget - bobEye) * Math.min(elapsed * 12, 1);
    arena.camera.position.set(player.x, bobEye + player.lift, player.z);
    arena.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (fireHeld) shoot(timeMs / 1000);
    if (reloading > 0) {
      reloading -= elapsed;
      if (reloading <= 0) { ammo = 30; reloading = 0; updateAmmo(); }
    }
  }
  arena.update(paused ? elapsed * 0.18 : elapsed, paused ? visibleTime * 0.16 : gameTime, lastWalkAmount, player.slideRemaining > 0);
  if (bloom.enabled) composer.render();
  else renderer.render(arena.scene, arena.camera);
  updateMetrics(elapsed);
}

deployButton.addEventListener('click', () => { void deploy(); });
restartButton.addEventListener('click', () => { resetRange(); void deploy(); });
manualDeploy.addEventListener('click', () => { manualDialog.close(); void deploy(); });
element('tutorialButton').addEventListener('click', openManual);
element('closeManual').addEventListener('click', () => manualDialog.close());
element('pauseButton').addEventListener('click', pauseGame);
element('engineeringButton').addEventListener('click', toggleEngineering);
qualitySelect.addEventListener('change', () => { resize(); });
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
  if ((event.code === 'KeyC' || event.code === 'ControlLeft') && !event.repeat) slidePressed = true;
  if (event.code === 'KeyR' && !event.repeat) reload();
  keys.add(event.code);
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('resize', resize);
reducedMotion.addEventListener('change', resize);

resize();
resetRange();
setVisibleGameHud(false);
renderer.setAnimationLoop(loop);
