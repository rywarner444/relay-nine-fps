/** Deterministic FPS movement and range scoring; no DOM or Three.js dependencies. */

export interface Blocker {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export interface PlayerMotion {
  x: number;
  z: number;
  lift: number;
  verticalSpeed: number;
  grounded: boolean;
  slideRemaining: number;
  slideCooldown: number;
  slideX: number;
  slideZ: number;
}

export interface MoveInput {
  forward: number;
  right: number;
  sprint: boolean;
  jumpPressed: boolean;
  slidePressed: boolean;
}

export interface RangeStats {
  shots: number;
  hits: number;
  eliminations: number;
  falsePositives: number;
  score: number;
  integrity: number;
}

export const RANGE_GOAL = 6;
export const PLAYER_RADIUS = 0.46;
export const ARENA_HALF_WIDTH = 21.5;
export const ARENA_HALF_DEPTH = 25;

export function initialPlayer(): PlayerMotion {
  return {
    x: 0, z: 17, lift: 0, verticalSpeed: 0, grounded: true,
    slideRemaining: 0, slideCooldown: 0, slideX: 0, slideZ: 0,
  };
}

export function initialStats(): RangeStats {
  return { shots: 0, hits: 0, eliminations: 0, falsePositives: 0, score: 0, integrity: 100 };
}

export function movementDirection(forward: number, right: number, yaw: number): { x: number; z: number } {
  // Zero yaw looks toward -Z. Strafe-right maps to +X.
  const magnitude = Math.hypot(forward, right);
  if (magnitude < 0.001) return { x: 0, z: 0 };
  const f = forward / magnitude;
  const r = right / magnitude;
  // Match Three.js camera yaw: positive yaw turns the camera toward -X.
  return { x: -Math.sin(yaw) * f + Math.cos(yaw) * r, z: -Math.cos(yaw) * f - Math.sin(yaw) * r };
}

function collides(x: number, z: number, blockers: readonly Blocker[]): boolean {
  return blockers.some((blocker) =>
    Math.abs(x - blocker.x) < blocker.halfWidth + PLAYER_RADIUS &&
    Math.abs(z - blocker.z) < blocker.halfDepth + PLAYER_RADIUS,
  );
}

export function advancePlayer(
  previous: PlayerMotion,
  input: MoveInput,
  yaw: number,
  deltaSeconds: number,
  blockers: readonly Blocker[],
): PlayerMotion {
  // Clamp one step so tab-switching cannot tunnel the player through geometry.
  const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
  const next = { ...previous };
  next.slideCooldown = Math.max(0, next.slideCooldown - dt);
  const direction = movementDirection(input.forward, input.right, yaw);

  if (input.slidePressed && input.sprint && next.grounded && next.slideCooldown === 0 &&
      Math.hypot(direction.x, direction.z) > 0.1) {
    next.slideRemaining = 0.72;
    next.slideCooldown = 1.4;
    next.slideX = direction.x;
    next.slideZ = direction.z;
  }

  const sliding = next.slideRemaining > 0;
  const speed = sliding ? 11.8 : input.sprint ? 8.8 : 5.8;
  const dx = (sliding ? next.slideX : direction.x) * speed * dt;
  const dz = (sliding ? next.slideZ : direction.z) * speed * dt;

  // Resolve axes separately so the player glides along crates and walls.
  const tryX = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, next.x + dx));
  if (!collides(tryX, next.z, blockers)) next.x = tryX;
  const tryZ = Math.max(-ARENA_HALF_DEPTH, Math.min(ARENA_HALF_DEPTH, next.z + dz));
  if (!collides(next.x, tryZ, blockers)) next.z = tryZ;

  if (input.jumpPressed && next.grounded && !sliding) {
    next.verticalSpeed = 7.5;
    next.grounded = false;
  }
  if (!next.grounded) {
    next.lift += next.verticalSpeed * dt - 0.5 * 19 * dt * dt;
    next.verticalSpeed -= 19 * dt;
    if (next.lift <= 0) {
      next.lift = 0;
      next.verticalSpeed = 0;
      next.grounded = true;
    }
  }

  next.slideRemaining = Math.max(0, next.slideRemaining - dt);
  return next;
}

export type ShotClassification = 'hostile' | 'neutral' | 'miss';

export function recordShot(previous: RangeStats, classification: ShotClassification, destroyed = false): RangeStats {
  const next = { ...previous, shots: previous.shots + 1 };
  if (classification === 'hostile') {
    next.hits += 1;
    next.score += destroyed ? 160 : 40;
    if (destroyed) next.eliminations += 1;
  } else if (classification === 'neutral') {
    next.falsePositives += 1;
    next.integrity = Math.max(0, next.integrity - 10);
    next.score = Math.max(0, next.score - 150);
  }
  return next;
}

export function shotAccuracy(stats: RangeStats): number {
  return stats.shots === 0 ? 0 : Math.round((stats.hits / stats.shots) * 100);
}
