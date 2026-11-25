import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RelayNineArena } from '../src/arena.ts';

test('Relay Nine creates a navigable 3D scene with a visible core and training drones', () => {
  const arena = new RelayNineArena();
  assert.ok(arena.scene.children.length > 50);
  assert.ok(arena.blockers.length > 3);
  assert.equal(arena.activeHostiles, 4);
  assert.ok(arena.scene.fog);
  assert.ok(arena.camera.parent === arena.scene);
  arena.setGraphicsTier('low');
  arena.update(0.016, 1, 0, false);
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
  assert.equal(arena.activeHostiles, 3);
  arena.update(4.1, 4.1, 0, false);
  assert.equal(arena.activeHostiles, 4);
});

test('neutral maintenance targets register separately from hostile drones', () => {
  const arena = new RelayNineArena();
  arena.camera.lookAt(new THREE.Vector3(15.7, 1.8, 11.8));
  arena.camera.updateMatrixWorld(true);
  const shot = arena.fire();
  assert.equal(shot.kind, 'neutral');
  assert.equal(shot.destroyed, false);
});
