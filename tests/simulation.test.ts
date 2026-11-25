import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  advancePlayer, initialPlayer, initialStats, movementDirection,
  recordShot, shotAccuracy, RANGE_GOAL,
} from '../src/simulation.ts';

const forward = { forward: 1, right: 0, sprint: false, jumpPressed: false, slidePressed: false };

test('forward movement follows the first-person yaw orientation', () => {
  assert.deepEqual(movementDirection(1, 0, 0), { x: 0, z: -1 });
  for (const yaw of [-Math.PI / 2, 0, Math.PI / 4, Math.PI / 2]) {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.y = yaw;
    camera.updateMatrixWorld(true);
    const look = camera.getWorldDirection(new THREE.Vector3());
    const direction = movementDirection(1, 0, yaw);
    assert.ok(Math.abs(direction.x - look.x) < 1e-10, `X direction mismatch at yaw ${yaw}`);
    assert.ok(Math.abs(direction.z - look.z) < 1e-10, `Z direction mismatch at yaw ${yaw}`);
  }
});

test('diagonal inputs are normalized to prevent speed exploits', () => {
  const direction = movementDirection(1, 1, 0);
  assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 1e-10);
});

test('sprinting travels farther than walking over the same interval', () => {
  const player = initialPlayer();
  const walking = advancePlayer(player, forward, 0, 0.05, []);
  const sprinting = advancePlayer(player, { ...forward, sprint: true }, 0, 0.05, []);
  assert.ok(sprinting.z < walking.z);
});

test('slide requires forward motion, sprint, and grounding', () => {
  const player = initialPlayer();
  const sliding = advancePlayer(player, { ...forward, sprint: true, slidePressed: true }, 0, 0.016, []);
  assert.ok(sliding.slideRemaining > 0);
  assert.ok(sliding.z < player.z);
  const idle = advancePlayer(player, { ...forward, forward: 0, sprint: true, slidePressed: true }, 0, 0.016, []);
  assert.equal(idle.slideRemaining, 0);
});

test('jump lifts the player and gravity eventually returns them to the ground', () => {
  let player = advancePlayer(initialPlayer(), { ...forward, forward: 0, jumpPressed: true }, 0, 0.016, []);
  assert.ok(player.lift > 0);
  assert.equal(player.grounded, false);
  for (let i = 0; i < 120; i += 1) player = advancePlayer(player, { ...forward, forward: 0 }, 0, 0.016, []);
  assert.equal(player.grounded, true);
  assert.equal(player.lift, 0);
});

test('blockers prevent passage without preventing wall sliding', () => {
  const blocker = [{ x: 0, z: 16, halfWidth: 1, halfDepth: 0.25 }];
  let player = initialPlayer();
  for (let i = 0; i < 20; i += 1) player = advancePlayer(player, forward, 0, 0.05, blocker);
  assert.ok(player.z >= 16.25 + 0.46);
  const strafed = advancePlayer(player, { ...forward, forward: 0, right: 1 }, 0, 0.05, blocker);
  assert.ok(strafed.x > player.x);
});

test('movement steps are clamped after background tab stalls', () => {
  const player = initialPlayer();
  const moved = advancePlayer(player, forward, 0, 10, []);
  assert.ok(player.z - moved.z <= 0.3);
});

test('scoring rewards verified hostile hits and tracks range progress', () => {
  let stats = initialStats();
  stats = recordShot(stats, 'hostile');
  stats = recordShot(stats, 'hostile', true);
  stats = recordShot(stats, 'miss');
  assert.equal(stats.score, 200);
  assert.equal(stats.eliminations, 1);
  assert.equal(shotAccuracy(stats), 67);
  assert.equal(RANGE_GOAL, 6);
});

test('false positives damage network integrity and can never make score negative', () => {
  const result = recordShot(initialStats(), 'neutral');
  assert.equal(result.integrity, 90);
  assert.equal(result.falsePositives, 1);
  assert.equal(result.score, 0);
});

test('no shots means no artificial accuracy percentage', () => {
  assert.equal(shotAccuracy(initialStats()), 0);
});
