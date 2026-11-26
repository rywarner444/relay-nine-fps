import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACILITY_WALLS, FACILITY_START } from '../src/facility.ts';
import { pointBlocked } from '../src/combat.ts';
import { RelayNineArena } from '../src/arena.ts';
import type { Blocker } from '../src/simulation.ts';

// Reachability guard: every authored mission target must be accessible around
// real corridor walls using player-sized clearance, with the vault unlocked.
function reachable(targetX: number, targetZ: number, barriers: readonly Blocker[]): boolean {
  const width = 85;
  const depth = 107;
  const offsetX = 42;
  const offsetZ = 53;
  const start = [Math.round(FACILITY_START.x), Math.round(FACILITY_START.z)];
  const queue: Array<[number, number]> = [[start[0], start[1]]];
  const visited = new Set<string>([start.join(',')]);
  for (let i = 0; i < queue.length; i += 1) {
    const [x, z] = queue[i];
    if (Math.hypot(x - targetX, z - targetZ) < 1.6) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < -offsetX || nx >= width - offsetX || nz < -offsetZ || nz >= depth - offsetZ) continue;
      const key = `${nx},${nz}`;
      if (!visited.has(key) && !pointBlocked(nx, nz, barriers, 0.46)) {
        visited.add(key);
        queue.push([nx, nz]);
      }
    }
  }
  return false;
}

test('original base-floor carrier and computer locations are reachable through corridor openings', () => {
  const staticWalls = [...FACILITY_WALLS, { x: 0, z: -40, halfWidth: 3.3, halfDepth: 3.3 }];
  for (const [x, z] of [[-5, 25], [26, -18], [24, 25], [0, -47]]) {
    assert.ok(reachable(x, z, staticWalls), `Expected navigable route from spawn to ${x}, ${z}`);
  }
});

test('new base-floor objectives remain reachable when actual crates and server cover are included', () => {
  const arena = new RelayNineArena(0);
  for (const [x, z] of [[-5, 25], [26, -18], [24, 25], [0, -47]]) {
    assert.ok(reachable(x, z, arena.blockers), `World pickup/computer ${x}, ${z} is obstructed`);
  }
  arena.dispose();
});

test('real collision cover leaves all foundry tower charging radii accessible', () => {
  const arena = new RelayNineArena(1);
  for (const [x, z] of [[-29, 18], [27, 6], [0, -30]]) {
    assert.ok(reachable(x, z, arena.blockers), `Mission 2 tower ${x}, ${z} is obstructed`);
  }
  arena.dispose();
});

test('open boss arena has multiple unobstructed approaches to the sentinel', () => {
  const arena = new RelayNineArena(2);
  for (const [x, z] of [[0, -12], [-15, -14], [15, -14], [0, 23]]) {
    assert.ok(reachable(x, z, arena.blockers), `Boss map position ${x}, ${z} is obstructed`);
  }
  arena.dispose();
});
