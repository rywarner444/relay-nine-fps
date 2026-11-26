import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RelayNineArena } from '../src/arena.ts';

test('the three mission maps have distinct navigable collision layouts and threat counts', () => {
  const levels = [new RelayNineArena(0), new RelayNineArena(1), new RelayNineArena(2)];
  assert.deepEqual(levels.map((arena) => arena.activeHostiles), [18, 8, 5]);
  const mapSignature = (arena: RelayNineArena): string => arena.blockers
    .map((b) => `${b.x},${b.z},${b.halfWidth}`).join('|');
  assert.equal(new Set(levels.map(mapSignature)).size, 3);
  for (const arena of levels) {
    assert.ok(arena.scene.children.length > 30);
    assert.ok(arena.camera.parent === arena.scene);
    arena.setGraphicsTier('low');
    arena.update(0.016, 1, 0, false);
    arena.dispose();
  }
});

test('batched environments keep the first mission GPU mesh footprint controlled', () => {
  const arena = new RelayNineArena();
  let meshCount = 0;
  arena.scene.traverseVisible((object) => { if (object instanceof THREE.Mesh) meshCount += 1; });
  assert.ok(meshCount < 260, `Expected fewer than 260 visible meshes, got ${meshCount}`);
  assert.ok(arena.scene.children.length < 100, 'Batched scenery should reduce scene traversal');
  arena.dispose();
});

test('the ARC-7 has opaque depth-tested geometry and a timed reload motion', () => {
  const arena = new RelayNineArena(0);
  const body = arena.weapon.children.filter((child) => child instanceof THREE.Mesh && child !== arena.muzzleFlash) as THREE.Mesh[];
  assert.ok(body.length >= 4, 'Carbine retains visually distinct batched materials');
  for (const part of body) {
    const material = part.material as THREE.Material;
    assert.equal(material.depthTest, true, 'Weapon layers must obey surface occlusion');
    assert.equal(material.depthWrite, true, 'Weapon parts must conceal geometry behind them');
    assert.equal(material.transparent, false, 'Carbine body must be opaque');
  }
  arena.setReloadProgress(0.5);
  arena.update(0.1, 1, 0, false);
  assert.ok(arena.weapon.position.y < -0.42, 'Reload motion lowers the carbine');
  assert.ok(Math.abs(arena.weapon.rotation.z) > 0.15, 'Reload motion visibly tilts the carbine');
  arena.setReloadProgress(null);
  arena.update(0.5, 2, 0, false);
  assert.ok(Math.abs(arena.weapon.rotation.z) < 0.001, 'Carbine recovers its normal stance');
  arena.dispose();
});

test('carrier combat creates a world drop that needs proximity and E interaction', () => {
  const arena = new RelayNineArena(0);
  arena.camera.lookAt(new THREE.Vector3(-5, 2.8, 25));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().kind, 'hostile');
  const last = arena.fire();
  assert.equal(last.targetId, 'I-01');
  assert.equal(last.destroyed, true);
  assert.equal(arena.activeHostiles, 17);
  assert.deepEqual(arena.getInteraction(-5, 25), { kind: 'fragment', id: 'FRAG-A' });
  assert.equal(arena.scanNearby(0, 42), null, 'Pickup cannot be collected remotely');
  assert.equal(arena.scanNearby(-5, 25), 'FRAG-A');
  assert.equal(arena.scanNearby(-5, 25), null, 'Pickup cannot be collected twice');
  assert.equal(arena.getWaypoint(-5, 25)?.id, 'CARRIER FRAG-C');
  arena.update(8, 8, 0, false);
  assert.equal(arena.activeHostiles, 17, 'Initial mission enemies do not respawn');
  arena.dispose();
});

test('mission 1 is fully hostile-only, with no unnecessary maintenance decoy', () => {
  const arena = new RelayNineArena(0);
  assert.equal(arena.tacticalBlips.filter((blip) => blip.type === 'friendly').length, 0);
  assert.equal(arena.activeHostiles, 18);
  arena.dispose();
});

test('computer upload becomes interactable only after all three carrier fragments are recovered', () => {
  const arena = new RelayNineArena(0);
  assert.equal(arena.getInteraction(0, -47), null);
  const carriers = [
    { id: 'FRAG-A', camera: [0, 1.72, 42], target: [-5, 2.8, 25], pickup: [-5, 25] },
    { id: 'FRAG-B', camera: [26, 1.72, -10], target: [26, 3, -18], pickup: [26, -18] },
    { id: 'FRAG-C', camera: [24, 1.72, 35], target: [24, 2.8, 25], pickup: [24, 25] },
  ];
  for (const carrier of carriers) {
    arena.camera.position.set(...carrier.camera as [number, number, number]);
    arena.camera.lookAt(new THREE.Vector3(...carrier.target as [number, number, number]));
    arena.camera.updateMatrixWorld(true);
    const first = arena.fire();
    assert.equal(first.kind, 'hostile', `Carrier ${carrier.id} must be hittable`);
    const second = arena.fire();
    assert.equal(second.destroyed, true);
    assert.equal(arena.scanNearby(...carrier.pickup as [number, number]), carrier.id);
  }
  assert.deepEqual(arena.getInteraction(0, -47), { kind: 'upload', id: 'UPLOAD' });
  assert.equal(arena.scanNearby(0, -47), 'UPLOAD');
  assert.equal(arena.getInteraction(0, -47), null, 'Upload cannot be claimed twice');
  arena.dispose();
});

test('tower capture needs nine seconds in each of three distinct world-space radii', () => {
  const arena = new RelayNineArena(1);
  assert.equal(arena.activeCaptureZones, 3);
  assert.equal(arena.scanNearby(-29, 18), null, 'Cannot press E to bypass tower charging');
  const outside = arena.updateCapture(0, 42, 0.05);
  assert.equal(outside?.inRange, false);
  assert.equal(outside?.percent, 0);
  const sites = [
    { id: 'TRACE-A', x: -29, z: 18 },
    { id: 'TRACE-B', x: 27, z: 6 },
    { id: 'TRACE-C', x: 0, z: -30 },
  ];
  for (const site of sites) {
    let capture = arena.updateCapture(site.x, site.z, 0.05);
    assert.equal(capture?.id, site.id);
    assert.equal(capture?.inRange, true);
    for (let i = 0; i < 182 && !capture?.completed; i += 1) capture = arena.updateCapture(site.x, site.z, 0.05);
    assert.equal(capture?.completed, true);
    assert.equal(arena.activeCaptureZones, 3 - (sites.indexOf(site) + 1), 'Captured ring and tower must both disappear');
  }
  assert.equal(arena.getWaypoint(0, 42), null);
  arena.dispose();
});

test('mobile 110-hit mech is immediately active; its destruction alone ends the boss objective', () => {
  const arena = new RelayNineArena(2);
  assert.equal(arena.sentinelHealth, 110);
  assert.equal(arena.getWaypoint(0, 35)?.id, 'SENTINEL');
  arena.camera.position.set(0, 1.72, 24);
  arena.camera.lookAt(new THREE.Vector3(0, 5.1, -12));
  arena.camera.updateMatrixWorld(true);
  for (let i = 0; i < arena.sentinelMaxHealth; i += 1) {
    const hit = arena.fire();
    assert.equal(hit.kind, 'hostile');
    assert.equal(hit.targetId, 'SENTINEL');
    assert.equal(hit.destroyed, i === arena.sentinelMaxHealth - 1);
  }
  assert.equal(arena.sentinelHealth, 0);
  assert.equal(arena.getWaypoint(0, 35), null);
  assert.equal(arena.scanNearby(0, -12), null, 'No console or other final requirement');
  arena.dispose();
});

test('boss patrols while defeated drone escorts return as timed reinforcements', () => {
  const arena = new RelayNineArena(2);
  const original = arena.tacticalBlips.find((blip) => blip.type === 'boss');
  assert.ok(original);
  arena.camera.position.set(-18, 1.72, 35);
  arena.camera.lookAt(new THREE.Vector3(-18, 3, 19));
  arena.camera.updateMatrixWorld(true);
  for (let i = 0; i < 3; i += 1) assert.equal(arena.fire().targetId, 'I-23');
  assert.equal(arena.activeHostiles, 4);
  for (let i = 0; i < 220; i += 1) arena.update(0.05, i * 0.05, 0, false, { x: 0, y: 1.3, z: 36 });
  assert.ok(arena.activeHostiles >= 6, 'Escort should respawn and a fresh reinforcement should join the battle');
  const moved = arena.tacticalBlips.find((blip) => blip.type === 'boss');
  assert.ok(moved);
  assert.ok(Math.hypot(moved.x - original.x, moved.z - original.z) > 7, 'Sentinel should change world position');
  arena.dispose();
});

test('base-floor guards patrol and shoot an exposed operator', () => {
  const arena = new RelayNineArena(0);
  const original = arena.tacticalBlips.find((blip) => blip.type === 'hostile');
  assert.ok(original);
  let damage = 0;
  for (let i = 0; i < 240; i += 1) damage += arena.update(0.05, i * 0.05, 0, false, { x: 0, y: 1.3, z: 31 });
  assert.ok(damage > 0, 'Hostiles should fire incoming projectiles');
  const after = arena.tacticalBlips.find((blip) => blip.type === 'hostile');
  assert.ok(after);
  assert.ok(Math.hypot(after.x - original.x, after.z - original.z) > 2);
  arena.dispose();
});

test('facility walls still block gunfire until player navigates through the wing', () => {
  const arena = new RelayNineArena(0);
  arena.camera.position.set(0, 1.72, 35);
  arena.camera.lookAt(new THREE.Vector3(-26, 2.8, 13));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().kind, 'miss');
  arena.camera.position.set(-26, 1.72, 19);
  arena.camera.lookAt(new THREE.Vector3(-26, 2.8, 13));
  arena.camera.updateMatrixWorld(true);
  assert.equal(arena.fire().targetId, 'I-03');
  arena.dispose();
});
