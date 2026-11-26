import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RelayNineArena } from '../src/arena.ts';
import { segmentBlocked } from '../src/combat.ts';
import { routeToComputer } from '../src/navigation.ts';

test('the minimap route navigates real base-floor corridors and cover to the upload computer', () => {
  const arena = new RelayNineArena(0);
  const start = { x: 0, z: 42 };
  const computer = { x: 0, z: -47 };
  const route = routeToComputer(start, computer, arena.blockers);
  assert.ok(route.length >= 3, 'Computer route should navigate around the reactor and partitions');
  assert.deepEqual(route[0], start);
  assert.deepEqual(route[route.length - 1], computer);
  for (let i = 1; i < route.length; i += 1) {
    const from = route[i - 1];
    const to = route[i];
    assert.equal(segmentBlocked(from.x, from.z, to.x, to.z, arena.blockers, 0.48), false,
      `Route segment ${i} must not cut through walls or cover`);
  }
  arena.dispose();
});

test('an impossible enclosure returns no route rather than misleading direct navigation', () => {
  const impossible = [{ x: 0, z: 0, halfWidth: 50, halfDepth: 1.5 }];
  assert.deepEqual(routeToComputer({ x: 0, z: 42 }, { x: 0, z: -47 }, impossible), []);
});
