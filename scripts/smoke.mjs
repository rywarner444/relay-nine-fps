import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const port = 5189;
const url = `http://127.0.0.1:${port}/`;
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
let browser;
const errors = [];

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Vite exited before it became ready.');
    try { const response = await fetch(url); if (response.ok) { ready = true; break; } } catch { /* Still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Vite server failed to start on local port');

  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByRole('heading', { name: /enter the unknown/i }).waitFor();
  await page.locator('#qualitySelect').selectOption('low');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/menu.png' });
  await page.getByRole('button', { name: /field manual/i }).click();
  await page.getByRole('heading', { name: /field manual/i }).waitFor();
  await page.getByRole('button', { name: /enter mission/i }).click();
  await page.locator('#hudTop').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/gameplay.png' });

  const ammo = await page.locator('#ammoValue').textContent();
  assert.equal(ammo, '30', 'Weapon HUD should initialize with a full magazine');
  assert.ok((await page.locator('#objectiveTitle').textContent())?.includes('Identify and contain'));
  assert.equal(await page.locator('#objectiveCount').textContent(), '0 / 4');
  assert.equal(await page.locator('#menuOverlay').isVisible(), false);
  assert.equal(errors.length, 0, `Browser errors: ${errors.join('; ')}`);
  process.stdout.write('Smoke test passed: loaded 3D campaign menu, field manual, first mission and weapon HUD.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
