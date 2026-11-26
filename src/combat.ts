/** Deterministic combat math; this is an authored game AI, not an LLM. */
import type { Blocker } from './simulation';

export interface Position3 { x: number; y: number; z: number; }

export interface EnemyTuning {
  health: number;
  speed: number;
  fireInterval: number;
  projectileSpeed: number;
  damage: number;
  range: number;
}

export const ENEMY_TIERS: readonly EnemyTuning[] = [
  { health: 2, speed: 1.8, fireInterval: 3.4, projectileSpeed: 11, damage: 7, range: 21 },
  { health: 3, speed: 2.3, fireInterval: 2.65, projectileSpeed: 13, damage: 9, range: 24 },
  { health: 4, speed: 2.8, fireInterval: 2.1, projectileSpeed: 16, damage: 11, range: 28 },
];

export const BOSS_TUNING: EnemyTuning = {
  health: 42, speed: 1.3, fireInterval: 1.5, projectileSpeed: 18, damage: 14, range: 30,
};

export function pointBlocked(x: number, z: number, blocks: readonly Blocker[], radius = 0.7): boolean {
  return blocks.some((b) => Math.abs(x - b.x) < b.halfWidth + radius && Math.abs(z - b.z) < b.halfDepth + radius);
}

/** Segment/AABB intersection, used for both line-of-sight and projectile cover. */
export function segmentBlocked(x0: number, z0: number, x1: number, z1: number, blocks: readonly Blocker[], padding = 0): boolean {
  return blocks.some((b) => {
    const xmin = b.x - b.halfWidth - padding;
    const xmax = b.x + b.halfWidth + padding;
    const zmin = b.z - b.halfDepth - padding;
    const zmax = b.z + b.halfDepth + padding;
    let near = 0;
    let far = 1;
    for (const [start, direction, low, high] of [[x0, x1 - x0, xmin, xmax], [z0, z1 - z0, zmin, zmax]]) {
      if (Math.abs(direction) < 1e-8) {
        if (start < low || start > high) return false;
      } else {
        const a = (low - start) / direction;
        const c = (high - start) / direction;
        near = Math.max(near, Math.min(a, c));
        far = Math.min(far, Math.max(a, c));
        if (near > far) return false;
      }
    }
    return true;
  });
}

export function advanceBolt(
  start: Position3, velocity: Position3, dt: number, player: Position3, blocks: readonly Blocker[],
): { position: Position3; result: 'flying' | 'hit' | 'blocked' } {
  const t = Math.min(0.05, Math.max(0, dt));
  const position = { x: start.x + velocity.x * t, y: start.y + velocity.y * t, z: start.z + velocity.z * t };
  if (segmentBlocked(start.x, start.z, position.x, position.z, blocks, 0.08)) return { position, result: 'blocked' };
  const dx = position.x - start.x;
  const dy = position.y - start.y;
  const dz = position.z - start.z;
  const denominator = dx * dx + dy * dy + dz * dz;
  const u = denominator < 1e-9 ? 0 : Math.max(0, Math.min(1, (
    (player.x - start.x) * dx + (player.y - start.y) * dy + (player.z - start.z) * dz
  ) / denominator));
  const distance = Math.hypot(start.x + u * dx - player.x, start.y + u * dy - player.y, start.z + u * dz - player.z);
  return { position, result: distance < 0.82 ? 'hit' : 'flying' };
}

export function applyPlayerDamage(health: number, damage: number): number {
  return Math.max(0, Math.min(100, health - Math.max(0, damage)));
}
