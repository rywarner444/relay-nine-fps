import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, missionProgress, recordMissionEvent, startMission } from '../src/campaign.ts';

test('three missions teach containment, evidence collection, and rogue AI recovery', () => {
  assert.equal(MISSIONS.length, 3);
  assert.deepEqual(MISSIONS.map((m) => m.number), ['01', '02', '03']);
  assert.ok(MISSIONS.every((m) => m.briefing.length > 20 && m.lesson.length > 20));
});

test('mission 1 requires four distinct hostile eliminations, not false positives', () => {
  let state = startMission(0);
  assert.equal(missionProgress(state).total, 4);
  state = recordMissionEvent(state, { type: 'elimination', id: 'I-01' });
  state = recordMissionEvent(state, { type: 'elimination', id: 'I-01' });
  state = recordMissionEvent(state, { type: 'elimination', id: 'M-01' });
  assert.equal(missionProgress(state).current, 1);
  for (const id of ['I-02', 'I-03', 'I-04']) state = recordMissionEvent(state, { type: 'elimination', id });
  assert.equal(missionProgress(state).complete, true);
});

test('mission 2 is evidence-first and does not require combat', () => {
  let state = startMission(1);
  state = recordMissionEvent(state, { type: 'elimination', id: 'I-01' });
  assert.equal(missionProgress(state).current, 0);
  for (const id of ['TRACE-A', 'TRACE-B', 'TRACE-C']) state = recordMissionEvent(state, { type: 'evidence', id });
  assert.equal(missionProgress(state).complete, true);
});

test('mission 3 requires all three locks before sentinel defeat counts', () => {
  let state = startMission(2);
  const premature = recordMissionEvent(state, { type: 'sentinel', id: 'SENTINEL' });
  assert.equal(premature, state);
  for (const id of ['LOCK-A', 'LOCK-B', 'LOCK-C']) state = recordMissionEvent(state, { type: 'lock', id });
  assert.match(missionProgress(state).title, /sentinel/i);
  assert.equal(missionProgress(state).complete, false);
  state = recordMissionEvent(state, { type: 'sentinel', id: 'SENTINEL' });
  assert.equal(missionProgress(state).complete, false, 'Network still requires a manual shutdown');
  assert.match(missionProgress(state).title, /shut down/i);
  state = recordMissionEvent(state, { type: 'shutdown', id: 'SHUTDOWN' });
  assert.equal(missionProgress(state).complete, true);
  assert.throws(() => startMission(3), RangeError);
});
