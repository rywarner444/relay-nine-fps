import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RelayNineArena } from '../src/arena.ts';

test('Relay Nine creates a navigable 3D scene with a visible core and training drones', () => {
  const arena = new RelayNineArena();
  assert.ok(arena.scene.children.length > 30, 'Batched world should still contain interactive scene elements');
  assert.ok(arena.blockers.length > 3);
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
  assert.ok(meshCount < 140, `Expected fewer than 140 visible meshes, got ${meshCount}`);
  assert.ok(arena.scene.children.length < 90, 'Batched scenery should reduce scene traversal');
});

test('raycast shooting registers hostile hits and disables destroyed range drones', () => {
  const arena = new RelayNineArena();
  arena.camera.lookAt(new THREE.Vector3(-10, 2.3, -0.8));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().kind, 'hostile');
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
  arena.camera.lookAt(new THREE.Vector3(15.7, 1.8, 11.8));
  arena.camera.updateMatrixWorld(true);
  const shot = arena.fire();
  assert.equal(shot.kind, 'neutral');
  assert.equal(shot.destroyed, false);
});

test('signal-trace level lets the operator scan three different evidence beacons with distance checks', () => {
  const arena = new RelayNineArena();
  arena.setMission(1);
  assert.equal(arena.scanNearby(0, 17), null);
  assert.equal(arena.scanNearby(-14, 8), 'TRACE-A');
  assert.equal(arena.scanNearby(-14, 8), null, 'Evidence cannot be claimed twice');
  assert.equal(arena.scanNearby(14, -5), 'TRACE-B');
  assert.equal(arena.scanNearby(-7, -18), 'TRACE-C');
  assert.equal(arena.getWaypoint(0, 17), null);
});

test('rogue AI locks shield the sentinel until each has been shot, then reveal a 9-hit boss', () => {
  const arena = new RelayNineArena();
  arena.setMission(2);
  assert.equal(arena.activeHostiles, 2);
  const locks = [
    { id: 'LOCK-A', point: [-12, 3.4, -13] },
    { id: 'LOCK-B', point: [12, 3.4, -13] },
    { id: 'LOCK-C', point: [0, 5.2, -6] },
  ] as const;
  for (const { id, point } of locks) {
    arena.camera.lookAt(new THREE.Vector3(...point));
    arena.camera.updateMatrixWorld(true);
    const hit = arena.fire();
    assert.equal(hit.kind, 'objective', `Expected to hit ${id} rather than ${hit.kind}`);
    assert.equal(hit.targetId, id);
  }
  assert.equal(arena.activeHostiles, 3);
  arena.camera.lookAt(new THREE.Vector3(0, 4.3, -10.2));
  arena.camera.updateMatrixWorld(true);
  for (let i = 0; i < 9; i += 1) {
    const hit = arena.fire();
    assert.equal(hit.kind, 'hostile');
    assert.equal(hit.targetId, 'SENTINEL');
    assert.equal(hit.destroyed, i === 8);
  }
  assert.equal(arena.sentinelHealth, 0);
});
