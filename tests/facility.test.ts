import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACILITY_WALLS, FACILITY_START, VAULT_DOOR } from '../src/facility.ts';
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

test('every mission objective is reachable through an authored hallway or door', () => {
  const staticWalls = [...FACILITY_WALLS, { x: 0, z: -40, halfWidth: 3.3, halfDepth: 3.3 }];
  for (const [x, z] of [[-29, 14], [29, -15], [-11, -48], [-30, -18], [30, -18], [0, -27], [0, -51]]) {
    assert.ok(reachable(x, z, staticWalls), `Expected navigable route from spawn to ${x}, ${z}`);
  }
});

test('the north vault is closed until its three security locks are disabled', () => {
  const barriers = [...FACILITY_WALLS, VAULT_DOOR];
  assert.equal(reachable(0, -49, barriers), false);
  assert.equal(reachable(0, -27, barriers), true);
});

test('real in-game cover does not accidentally block the side wing or vault objectives', () => {
  const arena = new RelayNineArena();
  arena.setMission(1);
  for (const [x, z] of [[-29, 14], [29, -15], [-11, -48]]) {
    assert.ok(reachable(x, z, arena.blockers), `Mission 2 location ${x}, ${z} is obstructed`);
  }
  arena.setMission(2);
  for (const [x, z] of [[-30, -18], [30, -18], [0, -27]]) {
    assert.ok(reachable(x, z, arena.blockers), `Mission 3 lock ${x}, ${z} is obstructed`);
  }
});
