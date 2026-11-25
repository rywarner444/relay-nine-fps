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

test('field manual and initial range have discoverable instructions', () => {
  assert.match(html, /FIELD MANUAL/);
  assert.match(html, /DEPLOY INTO ARENA/);
  assert.match(html, /id="qualitySelect"/);
  assert.match(html, /id="restartButton"/);
  assert.match(html, /press Esc/i);
});

test('the prototype distinguishes shipped mechanics from future work', () => {
  assert.match(readme, /adaptive director.*planned/i);
  assert.match(readme, /no real security telemetry/i);
  assert.match(readme, /private/i);
});
