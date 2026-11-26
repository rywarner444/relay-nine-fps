import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RelayNineArena } from '../src/arena.ts';

test('Relay Nine creates a large navigable facility with corridors, cover and drones', () => {
  const arena = new RelayNineArena();
  assert.ok(arena.scene.children.length > 30, 'Batched world should still contain interactive scene elements');
  assert.ok(arena.blockers.length > 20);
  assert.equal(arena.activeHostiles, 4);
  assert.ok(arena.scene.fog);
  assert.ok(arena.camera.parent === arena.scene);
  arena.setGraphicsTier('low');
  arena.update(0.016, 1, 0, false);
});

test('static geometry batching reduces GPU draw calls without reducing world detail', () => {
  const arena = new RelayNineArena();
  let meshCount = 0;
  arena.scene.traverseVisible((object) => { if (object instanceof THREE.Mesh) meshCount += 1; });
  assert.ok(meshCount < 165, `Expected fewer than 165 visible meshes, got ${meshCount}`);
  assert.ok(arena.scene.children.length < 90, 'Batched scenery should reduce scene traversal');
});

test('raycast shooting registers hostile hits and disables destroyed range drones', () => {
  const arena = new RelayNineArena();
  arena.camera.lookAt(new THREE.Vector3(-5, 2.8, 25));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().kind, 'hostile');
  const last = arena.fire();
  assert.equal(last.kind, 'hostile');
  assert.equal(last.destroyed, true);
  assert.equal(last.targetId, 'I-01');
  assert.equal(arena.activeHostiles, 3);
  arena.update(4.1, 4.1, 0, false);
  assert.equal(arena.activeHostiles, 3, 'Campaign threats remain contained and do not respawn');
});

test('neutral maintenance targets register separately from hostile drones', () => {
  const arena = new RelayNineArena();
  arena.camera.lookAt(new THREE.Vector3(8, 1.8, 36));
  arena.camera.updateMatrixWorld(true);
  const shot = arena.fire();
  assert.equal(shot.kind, 'neutral');
  assert.equal(shot.destroyed, false);
});

test('signal-trace level lets the operator scan three different evidence beacons with distance checks', () => {
  const arena = new RelayNineArena();
  arena.setMission(1);
  assert.equal(arena.scanNearby(0, 42), null);
  assert.equal(arena.scanNearby(-29, 14), 'TRACE-A');
  assert.equal(arena.scanNearby(-29, 14), null, 'Evidence cannot be claimed twice');
  assert.equal(arena.scanNearby(29, -15), 'TRACE-B');
  assert.equal(arena.scanNearby(-11, -48), 'TRACE-C');
  assert.equal(arena.getWaypoint(0, 42), null);
});

test('rogue AI locks open the vault, expose a 42-hit mech boss, then activate the shutdown console', () => {
  const arena = new RelayNineArena();
  arena.setMission(2);
  assert.equal(arena.activeHostiles, 2);
  const locks = [
    { id: 'LOCK-A', point: [-30, 3.4, -18], camera: [-30, 1.72, -10] },
    { id: 'LOCK-B', point: [30, 3.4, -18], camera: [30, 1.72, -10] },
    { id: 'LOCK-C', point: [0, 5.2, -27], camera: [0, 1.72, -17] },
  ] as const;
  assert.equal(arena.blockers.some((blocker) => blocker.z === -34 && blocker.x === 0), true);
  for (const { id, point, camera } of locks) {
    arena.camera.position.set(...camera);
    arena.camera.lookAt(new THREE.Vector3(...point));
    arena.camera.updateMatrixWorld(true);
    const hit = arena.fire();
    assert.equal(hit.kind, 'objective', `Expected to hit ${id} rather than ${hit.kind}`);
    assert.equal(hit.targetId, id);
  }
  assert.equal(arena.activeHostiles, 3);
  assert.equal(arena.blockers.some((blocker) => blocker.z === -34 && blocker.x === 0), false);
  arena.camera.position.set(7, 1.72, -42);
  arena.camera.lookAt(new THREE.Vector3(0, 5, -48));
  arena.camera.updateMatrixWorld(true);
  for (let i = 0; i < arena.sentinelMaxHealth; i += 1) {
    const hit = arena.fire();
    assert.equal(hit.kind, 'hostile');
    assert.equal(hit.targetId, 'SENTINEL');
    assert.equal(hit.destroyed, i === arena.sentinelMaxHealth - 1);
  }
  assert.equal(arena.sentinelHealth, 0);
  assert.equal(arena.getWaypoint(0, -45)?.id, 'SHUTDOWN');
  assert.equal(arena.scanNearby(0, -51), 'SHUTDOWN');
  assert.equal(arena.scanNearby(0, -51), null, 'Network shutdown can happen only once');
});

test('patrolling guards move and eventually hit an exposed stationary operator with projectiles', () => {
  const arena = new RelayNineArena();
  const initial = arena.tacticalBlips.find((blip) => blip.type === 'hostile');
  assert.ok(initial);
  let incoming = 0;
  for (let i = 0; i < 200; i += 1) incoming += arena.update(0.05, i * 0.05, 0, false, { x: 0, y: 1.3, z: 31 });
  const after = arena.tacticalBlips.find((blip) => blip.type === 'hostile');
  assert.ok(after);
  assert.ok(Math.hypot(after.x - initial.x, after.z - initial.z) > 2, 'Guard should visibly patrol');
  assert.ok(incoming > 0, 'Uncovered player should receive damage');
});

test('corridor walls stop shots until players navigate to the correct side-wing opening', () => {
  const arena = new RelayNineArena();
  arena.camera.position.set(0, 1.72, 35);
  arena.camera.lookAt(new THREE.Vector3(-26, 2.8, 13));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().kind, 'miss', 'Solid corridor walls must protect enemies behind them');
  arena.camera.position.set(-26, 1.72, 19);
  arena.camera.lookAt(new THREE.Vector3(-26, 2.8, 13));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().targetId, 'I-03');
});
