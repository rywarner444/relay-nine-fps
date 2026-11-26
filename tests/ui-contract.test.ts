import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('every UI reference in the game controller exists in the HTML', () => {
  const referenced = [...controller.matchAll(/element(?:<[^>]+>)?\('([a-zA-Z][a-zA-Z0-9]*)'\)/g)].map((m) => m[1]);
  const declared = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const ids = new Set(declared);
  assert.equal(ids.size, declared.length, 'All HTML ids must be unique');
  for (const id of referenced) assert.ok(ids.has(id), `UI element '${id}' is missing`);
});

test('field manual and three-mission campaign have discoverable instructions', () => {
  assert.match(html, /FIELD MANUAL/);
  assert.match(html, /START OPERATION/);
  assert.match(html, /id="qualitySelect"/);
  assert.match(html, /id="restartButton"/);
  assert.match(html, /press Esc/i);
  assert.match(html, /E<\/kbd>/);
  assert.match(html, /MISSION 01 \/ 03/);
});

test('Relay Nine uses a distinct combat HUD identity and visible slide cue', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /--lime:\s*#e6ff7b/i);
  assert.match(css, /--violet:\s*#aa8dff/i);
  assert.match(html, /id="slideStatus"/);
  assert.match(html, /id="fpsChip"/);
  assert.match(html, /id="waypointPanel"/);
  assert.match(html, /id="debrief"/);
});

test('the campaign distinguishes scripted game rules from real AI or security telemetry', () => {
  assert.match(readme, /adaptive AI.*not implemented/i);
  assert.match(readme, /three levels/i);
  assert.match(readme, /no real security telemetry/i);
  assert.match(readme, /private/i);
});
