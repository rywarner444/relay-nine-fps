import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_RADIUS, CAPTURE_SECONDS, advanceCapture } from '../src/objectives.ts';

test('a tower charges only while inside its radius, and retains partial progress', () => {
  let state = { charge: 0, complete: false };
  for (let i = 0; i < 20; i += 1) state = advanceCapture(state, CAPTURE_RADIUS + 0.01, 0.05);
  assert.equal(state.charge, 0);
  for (let i = 0; i < 90; i += 1) state = advanceCapture(state, CAPTURE_RADIUS, 0.05);
  assert.ok(state.charge > 0.45 && state.charge < 0.55);
  const paused = advanceCapture(state, CAPTURE_RADIUS + 5, 3);
  assert.deepEqual(paused, state);
  for (let i = 0; i < CAPTURE_SECONDS * 20; i += 1) state = advanceCapture(state, 0, 0.05);
  assert.equal(state.charge, 1);
  assert.equal(state.complete, true);
  assert.strictEqual(advanceCapture(state, 0, 1), state, 'Completed towers cannot recharge');
});

test('large frame spikes never grant more than a quarter-second of charge', () => {
  const state = advanceCapture({ charge: 0, complete: false }, 1, 12);
  assert.ok(state.charge <= 0.25 / CAPTURE_SECONDS);
  assert.deepEqual(advanceCapture(state, NaN, 1), state);
});
