// Renders the store screenshots and promo tiles into store/screenshots.
// Uses the end-to-end build and the local test server, so every page shown
// is one of the inert replicas from tests/corpus.
//
//   npm run build:e2e && npm run screenshots

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { type BrowserContext, chromium, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'store/screenshots');
const ext = resolve(root, '.output/chrome-mv3-e2e');
const BASE = 'http://127.0.0.1:47123';
const icon = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');
mkdirSync(out, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function startServer(): ChildProcess {
  return spawn(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), resolve(root, 'tests/e2e/server.ts')], { stdio: 'ignore' });
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE + '/site.html')).ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error('test server did not start');
}

async function slide(context: BrowserContext, name: string, caption: string, shot: Buffer, wide = true): Promise<void> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const img = `data:image/png;base64,${shot.toString('base64')}`;
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;overflow:hidden;
    background:linear-gradient(160deg,#1e3a8a,#0f172a);font-family:Segoe UI,system-ui,sans-serif;color:#fff">
    <div style="display:flex;align-items:center;gap:14px;padding:30px 48px 0">
      <div style="width:44px;height:44px">${icon.replace('<svg ', '<svg width="44" height="44" ')}</div>
      <div style="font-size:30px;font-weight:700;line-height:1.2">${caption}</div>
    </div>
    <div style="position:absolute;left:0;right:0;top:112px;bottom:0;display:flex;justify-content:center;align-items:flex-start">
      <img src="${img}" style="${wide ? 'width:1088px' : 'height:640px'};border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.45)">
    </div></body></html>`);
  await page.screenshot({ path: resolve(out, name) });
  await page.close();
}

async function tile(context: BrowserContext, name: string, width: number, height: number): Promise<void> {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  const size = Math.round(height * 0.42);
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;gap:${Math.round(height * 0.08)}px;
    background:linear-gradient(160deg,#1e3a8a,#0f172a);font-family:Segoe UI,system-ui,sans-serif;color:#fff">
    <div style="width:${size}px;height:${size}px">${icon.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
    <div><div style="font-size:${Math.round(height * 0.13)}px;font-weight:700">ClickFix Warden</div>
    <div style="font-size:${Math.round(height * 0.065)}px;opacity:.85;margin-top:6px">Stops fake CAPTCHA attacks</div></div></body></html>`);
  await page.screenshot({ path: resolve(out, name) });
  await page.close();
}

async function capture(page: Page): Promise<Buffer> {
  await sleep(600);
  return page.screenshot();
}

const server = startServer();
const profile = resolve(root, '.work/pw-profiles/screenshots');
rmSync(profile, { recursive: true, force: true });
try {
  await waitForServer();
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--host-resolver-rules=MAP *.test 127.0.0.1'],
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|[^/]*\.test[:/])/, (route) => route.abort());
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  for (let i = 0; i < 50; i++) {
    if (await sw.evaluate(async () => !!(await chrome.storage.local.get('feedMeta')).feedMeta)) break;
    await sleep(300);
  }

  const page = await context.newPage();
  await page.goto(BASE + '/lures/turnstile-writetext.html');
  await page.click('#cb');
  await slide(context, '1-fake-captcha-blocked.png', 'Stops fake CAPTCHA pages before the command reaches your clipboard', await capture(page));

  await page.goto(BASE + '/lures/filefix.html');
  await page.click('#open');
  await slide(context, '2-shows-the-hidden-command.png', 'Shows exactly what the page tried to make you run', await capture(page));

  await page.goto(`http://clickfix-site.test:47123/`).catch(() => undefined);
  await page.waitForURL(/warning\.html/);
  await slide(context, '3-known-clickfix-site.png', 'Blocks known ClickFix sites before they load', await capture(page));

  await page.goto(`http://reported.test:47123/`);
  await slide(context, '4-reported-site.png', 'Warns about sites reported in public threat databases', await capture(page));

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options.html`);
  await options.locator('#protection').scrollIntoViewIfNeeded();
  await options.evaluate(() => window.scrollTo(0, 0));
  await slide(context, '5-private-by-design.png', 'Every check runs in your browser, nothing is collected', await capture(options));

  await tile(context, 'promo-440x280.png', 440, 280);
  await tile(context, 'marquee-1400x560.png', 1400, 560);
  const logo = await context.newPage();
  await logo.setViewportSize({ width: 300, height: 300 });
  await logo.setContent(`<html><body style="margin:0">${icon.replace('<svg ', '<svg width="300" height="300" ')}</body></html>`);
  await logo.locator('svg').screenshot({ path: resolve(out, 'logo-300.png'), omitBackground: true });

  await context.close();
  console.log(`Screenshots written to ${out}`);
} finally {
  server.kill();
  rmSync(profile, { recursive: true, force: true });
}
