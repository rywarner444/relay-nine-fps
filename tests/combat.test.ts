import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_TIERS, BOSS_TUNING, advanceBolt, applyPlayerDamage, pointBlocked, segmentBlocked } from '../src/combat.ts';

test('three difficulty tiers keep or increase durability, patrol speed, fire rate and damage', () => {
  assert.equal(ENEMY_TIERS.length, 3);
  for (let i = 1; i < ENEMY_TIERS.length; i += 1) {
    assert.ok(ENEMY_TIERS[i].health >= ENEMY_TIERS[i - 1].health);
    assert.ok(ENEMY_TIERS[i].speed > ENEMY_TIERS[i - 1].speed);
    assert.ok(ENEMY_TIERS[i].fireInterval < ENEMY_TIERS[i - 1].fireInterval);
    assert.ok(ENEMY_TIERS[i].damage >= ENEMY_TIERS[i - 1].damage);
  }
  assert.ok(BOSS_TUNING.health >= 100, 'Final mobile boss takes a substantial number of hits');
});

test('cover and walls block lines of sight and projectile trajectories', () => {
  const walls = [{ x: 0, z: 5, halfWidth: 1, halfDepth: 0.5 }];
  assert.equal(segmentBlocked(0, 0, 0, 10, walls), true);
  assert.equal(segmentBlocked(4, 0, 4, 10, walls), false);
  assert.equal(pointBlocked(0, 5, walls), true);
  const bolt = advanceBolt({ x: 0, y: 1.3, z: 4.7 }, { x: 0, y: 0, z: 20 }, 0.05, { x: 0, y: 1.3, z: 7 }, walls);
  assert.equal(bolt.result, 'blocked');
});

test('moving bolts hit a player in the open and cannot tunnel through them', () => {
  const bolt = advanceBolt({ x: 0, y: 1.3, z: 0 }, { x: 0, y: 0, z: 22 }, 0.05, { x: 0.1, y: 1.3, z: 0.8 }, []);
  assert.equal(bolt.result, 'hit');
  const dodge = advanceBolt({ x: 0, y: 1.3, z: 0 }, { x: 0, y: 0, z: 22 }, 0.05, { x: 2.5, y: 1.3, z: 0.8 }, []);
  assert.equal(dodge.result, 'flying');
});

test('health decreases deterministically and never falls below zero', () => {
  assert.equal(applyPlayerDamage(100, 14), 86);
  assert.equal(applyPlayerDamage(5, 100), 0);
  assert.equal(applyPlayerDamage(98, -40), 98);
});
