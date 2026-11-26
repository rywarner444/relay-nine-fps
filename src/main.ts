import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RelayNineArena, type GraphicsTier } from './arena';
import { RangeAudio } from './audio';
import { CHECKPOINT_KEY, MISSIONS, missionProgress, recordMissionEvent, safeCheckpoint, startMission, type CampaignState } from './campaign';
import { applyPlayerDamage } from './combat';
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
const minimapCanvas = element<HTMLCanvasElement>('minimapCanvas');
const minimapContext = minimapCanvas.getContext('2d');
const sensitivityRange = element<HTMLInputElement>('sensitivityRange');

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

let arena = new RelayNineArena();
const audio = new RangeAudio();
const composer = new EffectComposer(renderer);
const scenePass = new RenderPass(arena.scene, arena.camera);
composer.addPass(scenePass);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.55, 0.89);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const keys = new Set<string>();
let player: PlayerMotion = initialPlayer();
let stats: RangeStats = initialStats();
let playerHealth = 100;
let damageCooldown = 0;
let failureReason = '';
let sensitivity = 1;
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
let unlockedLevel = 0;
let stageStartStats: RangeStats = initialStats();
let stageStartTime = 0;
let runTime = 0;
let waypointRefresh = 0;
let minimapRefresh = 0;
let bobEye = 1.72;
let lastWalkAmount = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setVisibleGameHud(visible: boolean): void {
  for (const id of [
    'hudTop', 'objectivePanel', 'telemetryPanel', 'crosshair', 'weaponPanel', 'movementHint', 'engineeringButton', 'waypointPanel', 'minimapPanel',
  ]) element<HTMLElement>(id).hidden = !visible;
  element<HTMLElement>('capturePanel').hidden = !visible || campaign.mission !== 1;
  element<HTMLElement>('bossPanel').hidden = !visible || campaign.mission !== 2;
  if (!visible) engineeringPanel.hidden = true;
}

function readCheckpoint(): number {
  try { return safeCheckpoint(localStorage.getItem(CHECKPOINT_KEY)); } catch { return 0; }
}

function unlockLevel(index: number): void {
  if (index <= unlockedLevel) return;
  unlockedLevel = index;
  try { localStorage.setItem(CHECKPOINT_KEY, String(unlockedLevel)); } catch { /* Optional local-only storage. */ }
}

function updateBossHud(): void {
  if (campaign.mission !== 2) return;
  const remaining = Math.max(0, arena.sentinelHealth);
  element('bossHpText').textContent = `${remaining} / ${arena.sentinelMaxHealth} ARMOR`;
  element<HTMLElement>('bossFill').style.width = `${remaining / arena.sentinelMaxHealth * 100}%`;
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
  updateBossHud();
  if (progress.complete && !taskComplete) {
    taskComplete = true;
    unlockLevel(Math.min(MISSIONS.length - 1, campaign.mission + 1));
    announce(campaign.mission === 2 ? 'SENTINEL DESTROYED // ACHIEVEMENT UNLOCKED' : 'MISSION COMPLETE // CHECKPOINT SAVED', 'success', 3500);
    audio.destroy();
    pauseGame();
    menuMode = campaign.mission === MISSIONS.length - 1 ? 'victory' : 'between';
    showMenu(menuMode);
  }
  if (stats.integrity <= 0 && menuMode !== 'failed' && !progress.complete) {
    pauseGame();
    menuMode = 'failed';
    failureReason = 'Friendly network integrity reached zero. Be more selective about what you shoot.';
    showMenu('failed');
    announce('NETWORK INTEGRITY LOST // OPERATION FAILED', 'danger', 3500);
  }
}

function showMenu(mode: typeof menuMode): void {
  const next = mode === 'between' ? MISSIONS[campaign.mission + 1] : mode === 'intro' ? MISSIONS[unlockedLevel] : MISSIONS[campaign.mission];
  const current = MISSIONS[campaign.mission];
  const completed = mode === 'victory';
  const failed = mode === 'failed';
  const between = mode === 'between';
  const pausedHere = mode === 'pause';
  element('menuHeadline').innerHTML = completed ? 'SIGNAL<br><em>SECURED.</em>'
    : failed ? 'SIGNAL<br><em>LOST.</em>'
      : between ? 'MISSION<br><em>CLEARED.</em>'
        : pausedHere ? 'OPERATION<br><em>PAUSED.</em>' : 'ENTER THE<br><em>UNKNOWN.</em>';
  element('menuDescription').textContent = completed
    ? 'Aegis-9 neutralized. You recovered the network fragments, secured three uplinks under fire, and survived the Sentinel arena. Your achievement is unlocked.'
    : failed ? `${failureReason} Progress saved: retry Mission ${MISSIONS[campaign.mission].number} without replaying earlier levels.`
      : between ? `${current.name} complete. ${next.briefing}`
        : pausedHere ? `Mission ${current.number}: ${current.briefing}`
          : unlockedLevel > 0 ? `Checkpoint detected! Continue at Mission ${next.number}: ${next.briefing}`
            : 'Three unique maps: recover network fragments, hold three uplink zones under fire, and defeat a giant mobile mech with endless drone reinforcements. Fictional and offline.';
  element('missionNumber').textContent = next.number;
  element('missionName').textContent = next.name;
  element('missionDescription').textContent = next.lesson;
  element('menuMissionNumber').textContent = `[ MISSION ${next.number} / 03 ]`;
  element('missionTag').textContent = next.codename;
  element('menuStatus').textContent = completed ? 'CAMPAIGN COMPLETE' : failed ? 'OPERATOR DOWN / CHECKPOINT SAVED' : between ? 'NEW MAP UNLOCKED' : pausedHere ? 'PAUSED' : unlockedLevel > 0 ? 'SAVED CHECKPOINT' : '3-MISSION CAMPAIGN';
  deployButton.innerHTML = completed ? '<span>↻</span> REPLAY CAMPAIGN'
    : failed ? `<span>↻</span> RETRY MISSION ${current.number}`
      : between ? '<span>▶</span> NEXT MISSION' : pausedHere ? '<span>▶</span> RESUME OPERATION'
        : unlockedLevel > 0 ? `<span>▶</span> CONTINUE MISSION ${next.number}` : '<span>▶</span> START OPERATION';
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
  element<HTMLElement>('achievementPanel').hidden = !completed;
  restartButton.hidden = completed || mode === 'intro' && unlockedLevel === 0;
  restartButton.textContent = '↻ RESTART FROM MISSION 01';
  menuOverlay.hidden = false;
}

function updatePlayerHealth(): void {
  element('healthValue').textContent = `${playerHealth} / 100`;
  element<HTMLElement>('healthFill').style.width = `${playerHealth}%`;
  element<HTMLElement>('healthFill').classList.toggle('critical', playerHealth <= 30);
  element('healthState').textContent = playerHealth <= 30 ? 'CRITICAL // SEEK COVER' : playerHealth <= 65 ? 'ARMOR DAMAGED' : 'OPERATOR READY';
}

function receiveDamage(amount: number): void {
  if (paused || amount <= 0 || damageCooldown > 0) return;
  damageCooldown = 0.6;
  playerHealth = applyPlayerDamage(playerHealth, amount);
  updatePlayerHealth();
  audio.warning();
  const flash = element<HTMLElement>('damageFlash');
  flash.classList.remove('pulse');
  void flash.offsetWidth;
  flash.classList.add('pulse');
  if (playerHealth <= 0) {
    failureReason = 'Your armor was depleted by hostile fire. Use cover, keep moving, and slide through incoming projectiles.';
    announce('OPERATOR DOWN // SIGNAL LOST', 'danger', 3500);
    pauseGame();
    menuMode = 'failed';
    showMenu('failed');
  } else if (playerHealth <= 30) announce('CRITICAL HEALTH // FIND COVER', 'danger', 2100);
}

function drawMinimap(): void {
  if (!minimapContext) return;
  const ctx = minimapContext;
  const size = minimapCanvas.width;
  const center = size / 2;
  const scale = 5.0; // Local 23m radius: clear walls, doors, and nearby contacts.
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#070c1b';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#53528047';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i += 1) {
    const v = center + i * 25;
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(size, v); ctx.stroke();
  }
  const xAt = (worldX: number): number => center + (worldX - player.x) * scale;
  const yAt = (worldZ: number): number => center + (worldZ - player.z) * scale;
  for (const block of arena.blockers) {
    const width = block.halfWidth * 2 * scale;
    const depth = block.halfDepth * 2 * scale;
    const x = xAt(block.x) - width / 2;
    const y = yAt(block.z) - depth / 2;
    if (x > size || y > size || x + width < 0 || y + depth < 0) continue;
    ctx.fillStyle = width > 20 || depth > 20 ? '#4d567b' : '#38485d';
    ctx.fillRect(x, y, width, depth);
    ctx.strokeStyle = '#7d96b790';
    ctx.strokeRect(x, y, width, depth);
  }
  for (const blip of arena.tacticalBlips) {
    const x = xAt(blip.x);
    const y = yAt(blip.z);
    if (x < 3 || y < 3 || x > size - 3 || y > size - 3) continue;
    ctx.fillStyle = blip.type === 'friendly' ? '#ffcc71' : blip.type === 'objective' ? '#b396ff' : blip.type === 'boss' ? '#ff4a78' : '#ff607e';
    ctx.beginPath(); ctx.arc(x, y, blip.type === 'boss' ? 6 : blip.type === 'objective' ? 5 : 3.8, 0, Math.PI * 2); ctx.fill();
    if (blip.type === 'objective' || blip.type === 'boss') {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 8, y - 8, 16, 16);
    }
  }
  // North-up local radar. A rotating triangular operator marker indicates facing.
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(-yaw);
  ctx.fillStyle = '#e6ff7b';
  ctx.strokeStyle = '#061018';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(-6, 8); ctx.lineTo(0, 4); ctx.lineTo(6, 8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#c4baffb0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
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
  const priorArena = arena;
  arena = new RelayNineArena(index);
  scenePass.scene = arena.scene;
  scenePass.camera = arena.camera;
  priorArena.dispose();
  player = initialPlayer();
  if (index === 2) player = { ...player, z: 36 };
  playerHealth = 100;
  damageCooldown = 0;
  failureReason = '';
  ammo = 30;
  reloading = 0;
  taskComplete = false;
  yaw = 0;
  pitch = -0.03;
  slideBuffer = 0;
  slidePressed = false;
  stageStartStats = { ...stats };
  stageStartTime = runTime;
  element<HTMLElement>('capturePanel').hidden = index !== 1;
  element<HTMLElement>('bossPanel').hidden = index !== 2;
  element<HTMLElement>('slideStatus').hidden = true;
  element<HTMLElement>('speedLines').classList.remove('active');
  element('hudMission').textContent = `${MISSIONS[index].name} / ${String(index + 1).padStart(2, '0')} OF 03`;
  element('objectiveStep').textContent = `0${index + 1} / 03`;
  element('missionStrip').textContent = MISSIONS.map((_, i) => i < index ? '◆' : i === index ? '◈' : '◇').join('  ');
  document.body.dataset.mission = String(index + 1);
  resize();
  updateStats();
  updateAmmo();
  updatePlayerHealth();
  drawMinimap();
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
  if (menuMode === 'victory') resetCampaign();
  else if (menuMode === 'failed') {
    stats = { ...stageStartStats };
    runTime = stageStartTime;
    enterMission(campaign.mission);
  } else if (menuMode === 'between') enterMission(campaign.mission + 1);
  else if (!sessionStarted) enterMission(unlockedLevel);
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
    if (hit.targetId === 'SENTINEL') campaign = recordMissionEvent(campaign, { type: 'boss', id: 'SENTINEL' });
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
    } else if (hit.destroyed) {
      audio.destroy();
      announce(campaign.mission === 0 && ['I-01', 'I-04', 'I-07'].includes(hit.targetId ?? '')
        ? 'CARRIER DOWN // COLLECT GREEN NETWORK FRAGMENT WITH E' : 'HOSTILE SIGNATURE NEUTRALIZED', 'success', 2100);
    } else audio.hit();
  }
  if (ammo === 0) reload();
  updateAmmo();
  updateStats();
}

function collectEvidence(): void {
  if (campaign.mission !== 0 || paused) return;
  const id = arena.scanNearby(player.x, player.z);
  if (!id) {
    return;
  }
  campaign = id === 'UPLOAD' ? recordMissionEvent(campaign, { type: 'upload', id: 'UPLOAD' })
    : recordMissionEvent(campaign, { type: 'fragment', id });
  stats = { ...stats, score: stats.score + (id === 'UPLOAD' ? 600 : 250) };
  audio.destroy();
  announce(id === 'UPLOAD' ? 'NETWORK FRAGMENTS INSERTED // BASE FLOOR CLEARED'
    : `NETWORK FRAGMENT ${id} RECOVERED`, 'success', 2700);
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
  const action = campaign.mission === 0 && nearby.distance <= 3.5
    ? nearby.id === 'UPLOAD' ? ' · PRESS E TO INSERT' : nearby.id.startsWith('FRAG') ? ' · PRESS E TO PICK UP' : ''
      : campaign.mission === 1 && nearby.distance <= 7.5 ? ' · HOLD THIS ZONE' : '';
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
    damageCooldown = Math.max(0, damageCooldown - elapsed);
    waypointRefresh -= elapsed;
    if (waypointRefresh <= 0) { waypointRefresh = 0.16; updateWaypoint(); }
    minimapRefresh -= elapsed;
    if (minimapRefresh <= 0) { minimapRefresh = 0.12; drawMinimap(); }
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
    if (campaign.mission === 1) {
      const capture = arena.updateCapture(player.x, player.z, elapsed);
      if (capture) {
        const capturePanel = element<HTMLElement>('capturePanel');
        capturePanel.hidden = false;
        capturePanel.dataset.inRange = String(capture.inRange);
        element('captureName').textContent = capture.id;
        element('captureText').textContent = capture.inRange ? `${capture.percent}% // CAPTURING` : 'ENTER VIOLET RING TO CHARGE';
        element<HTMLElement>('captureFill').style.width = `${capture.percent}%`;
        if (capture.completed) {
          campaign = recordMissionEvent(campaign, { type: 'charged', id: capture.id });
          stats = { ...stats, score: stats.score + 450 };
          audio.destroy();
          announce(`${capture.id} SECURED // ${missionProgress(campaign).current} OF 3 UPLINKS`, 'success', 2400);
          updateStats();
        }
      }
    }
    if (fireHeld) shoot(timeMs / 1000);
    if (reloading > 0) {
      reloading -= elapsed;
      if (reloading <= 0) { ammo = 30; reloading = 0; updateAmmo(); }
    }
  }
  const incomingDamage = arena.update(paused ? elapsed * 0.18 : elapsed, paused ? visibleTime * 0.16 : gameTime,
    lastWalkAmount, player.slideRemaining > 0, paused ? undefined : { x: player.x, y: bobEye + player.lift - 0.4, z: player.z });
  if (incomingDamage) receiveDamage(incomingDamage);
  if (bloom.enabled) composer.render();
  else renderer.render(arena.scene, arena.camera);
  updateMetrics(rawElapsed);
}

deployButton.addEventListener('click', () => { void deploy(); });
restartButton.addEventListener('click', () => { resetCampaign(); sessionStarted = true; menuMode = 'pause'; void deploy(); });
manualDeploy.addEventListener('click', () => { manualDialog.close(); void deploy(); });
element('tutorialButton').addEventListener('click', openManual);
element('closeManual').addEventListener('click', () => manualDialog.close());
element('pauseButton').addEventListener('click', pauseGame);
element('engineeringButton').addEventListener('click', toggleEngineering);
qualitySelect.addEventListener('change', () => { autoTierOverride = null; strugglingSeconds = 0; resize(); });
sensitivityRange.addEventListener('input', () => {
  sensitivity = Number(sensitivityRange.value);
  element('sensitivityValue').textContent = `${Math.round(sensitivity * 100)}%`;
  try { localStorage.setItem('relay-nine-mouse-sensitivity', String(sensitivity)); } catch { /* Optional */ }
});
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
  const turnRate = 0.00195 * sensitivity;
  yaw -= event.movementX * turnRate;
  pitch -= event.movementY * turnRate;
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
try {
  const saved = Number(localStorage.getItem('relay-nine-mouse-sensitivity'));
  if (saved >= 0.5 && saved <= 2.5) sensitivity = saved;
} catch { /* Storage access may be unavailable. */ }
sensitivityRange.value = String(sensitivity);
element('sensitivityValue').textContent = `${Math.round(sensitivity * 100)}%`;
resetCampaign();
unlockedLevel = readCheckpoint();
showMenu('intro');
setVisibleGameHud(false);
renderer.setAnimationLoop(loop);
