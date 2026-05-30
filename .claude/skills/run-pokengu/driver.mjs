#!/usr/bin/env node
/**
 * Pokengu driver — launch, interact, screenshot.
 *
 * Usage:
 *   node driver.mjs [command] [args...]
 *
 * Commands:
 *   smoke          Full smoke run: onboarding + all routes (default)
 *   ss <name>      Navigate to <name> route and take a screenshot
 *                  name: home | battle | deck | jobs | shop
 *   onboard        Run the full onboarding flow (clears localStorage first)
 *   console        Check for JS errors after navigating to all routes
 *
 * Screenshots land in: .claude/skills/run-pokengu/screenshots/
 *
 * Requires:
 *   - Dev server running on http://localhost:5173
 *     Start with:  PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH" yarn dev
 *   - Playwright installed in this skill dir:
 *     cd .claude/skills/run-pokengu && npm install
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(SKILL_DIR, '../../..');
const SCREENSHOTS_DIR = join(SKILL_DIR, 'screenshots');
const BASE_URL = 'http://localhost:5173';

await mkdir(SCREENSHOTS_DIR, { recursive: true });

const [,, cmd = 'smoke', ...args] = process.argv;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

const ss = async (name) => {
  const path = join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path });
  console.log(`Screenshot saved: ${path}`);
  return path;
};

const goto = async (route, opts = {}) => {
  const url = route.startsWith('http') ? route : `${BASE_URL}/${route}`.replace(/\/\/+/g, '/').replace('http:/', 'http://');
  await page.goto(url, { waitUntil: 'networkidle', ...opts });
};

const onboard = async (trainerName = 'Ash', starter = 'Charmander') => {
  // Clear IndexedDB so onboarding is forced
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('pokengu');
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
  });
  await page.reload({ waitUntil: 'networkidle' });

  await page.fill('input[placeholder="Treinador"]', trainerName);
  await page.click(`text=${starter}`);
  await page.click('text=Começar aventura');
  await page.waitForLoadState('networkidle');
  console.log(`Onboarding complete: trainer=${trainerName}, starter=${starter}`);
};

if (cmd === 'smoke') {
  console.log('==> Pokengu smoke run');

  await onboard('Ash', 'Charmander');
  await ss('01-onboarding-complete');

  await goto(BASE_URL);
  await ss('02-map');

  await goto(`${BASE_URL}/deck`);
  await ss('03-deck');

  await goto(`${BASE_URL}/jobs`);
  await ss('04-jobs');

  await goto(`${BASE_URL}/shop`);
  await ss('05-shop');

  console.log('\nConsole errors:', errors.length ? errors : 'none');
  console.log('Smoke run complete.');

} else if (cmd === 'ss') {
  const route = args[0] || '';
  const routeMap = { home: '', battle: 'battle', deck: 'deck', jobs: 'jobs', shop: 'shop' };
  const path = routeMap[route] ?? route;
  await goto(`${BASE_URL}/${path}`);
  await ss(`ss-${route || 'home'}`);

} else if (cmd === 'onboard') {
  const [name = 'Ash', starter = 'Charmander'] = args;
  await onboard(name, starter);
  await ss('onboard-complete');

} else if (cmd === 'console') {
  for (const r of ['', 'deck', 'jobs', 'shop']) {
    await goto(`${BASE_URL}/${r}`);
    await page.waitForLoadState('networkidle');
  }
  if (errors.length) {
    console.error('JS errors found:');
    errors.forEach(e => console.error(' ', e));
    process.exitCode = 1;
  } else {
    console.log('No JS errors.');
  }

} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Commands: smoke | ss <route> | onboard [name] [starter] | console');
  process.exitCode = 1;
}

await browser.close();
