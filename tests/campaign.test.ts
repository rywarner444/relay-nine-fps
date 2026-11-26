import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKPOINT_KEY, MISSIONS, missionProgress, recordMissionEvent, safeCheckpoint, startMission } from '../src/campaign.ts';

test('three unique assignments are clearly documented', () => {
  assert.equal(MISSIONS.length, 3);
  assert.deepEqual(MISSIONS.map((mission) => mission.number), ['01', '02', '03']);
  assert.match(MISSIONS[0].briefing, /fragments/i);
  assert.match(MISSIONS[1].briefing, /radius|ring/i);
  assert.match(MISSIONS[2].briefing, /sentinel|mech/i);
  assert.ok(MISSIONS.every((mission) => mission.lesson.length > 25));
});

test('base floor requires three distinct pickups before computer insertion', () => {
  let state = startMission(0);
  assert.equal(missionProgress(state).total, 4);
  state = recordMissionEvent(state, { type: 'upload', id: 'UPLOAD' });
  assert.equal(missionProgress(state).current, 0, 'Cannot insert before collecting');
  state = recordMissionEvent(state, { type: 'fragment', id: 'FRAG-A' });
  state = recordMissionEvent(state, { type: 'fragment', id: 'FRAG-A' });
  state = recordMissionEvent(state, { type: 'fragment', id: 'BOGUS' });
  assert.equal(missionProgress(state).current, 1);
  for (const id of ['FRAG-B', 'FRAG-C']) state = recordMissionEvent(state, { type: 'fragment', id });
  assert.match(missionProgress(state).title, /upload computer/i);
  assert.match(missionProgress(state).hint, /dotted lime route/i);
  assert.equal(missionProgress(state).complete, false);
  state = recordMissionEvent(state, { type: 'upload', id: 'UPLOAD' });
  assert.equal(missionProgress(state).complete, true);
});

test('foundry only counts charged uplinks; shooting guards cannot skip zones', () => {
  let state = startMission(1);
  state = recordMissionEvent(state, { type: 'fragment', id: 'FRAG-A' });
  assert.equal(missionProgress(state).current, 0);
  for (const id of ['TRACE-A', 'TRACE-B', 'TRACE-C']) state = recordMissionEvent(state, { type: 'charged', id });
  assert.equal(missionProgress(state).complete, true);
});

test('boss defeat is final mission only objective', () => {
  let state = startMission(2);
  assert.equal(missionProgress(state).total, 1);
  state = recordMissionEvent(state, { type: 'boss', id: 'SENTINEL' });
  assert.equal(missionProgress(state).complete, true);
  assert.throws(() => startMission(3), RangeError);
});

test('local browser checkpoint values are bounded to unlocked mission numbers', () => {
  assert.equal(CHECKPOINT_KEY, 'relay-nine-unlocked-level');
  assert.equal(safeCheckpoint(null), 0);
  assert.equal(safeCheckpoint('1'), 1);
  assert.equal(safeCheckpoint('2'), 2);
  assert.equal(safeCheckpoint('3'), 0);
  assert.equal(safeCheckpoint(-7), 0);
  assert.equal(safeCheckpoint('foo'), 0);
});
