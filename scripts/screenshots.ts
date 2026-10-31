// Renders the store screenshots and promo tiles from the e2e build and the inert test replicas, run npm run build:e2e first.

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { type BrowserContext, chromium, type Page } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'store/screenshots');
const ext = resolve(root, '.output/chrome-mv3-e2e');
const BASE = 'http://127.0.0.1:47123';
const icon = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');
const font = (file: string) => readFileSync(resolve(root, 'public/fonts', file)).toString('base64');
const FONTS = `<style>
@font-face { font-family: 'Jakarta'; font-weight: 400 800; src: url(data:font/woff2;base64,${font('plus-jakarta-sans-latin.woff2')}) format('woff2'); }
body { margin: 0; font-family: Jakarta, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
</style>`;
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
  await page.setContent(`<!doctype html><html><head>${FONTS}</head><body style="width:1280px;height:800px;overflow:hidden;background:#111214;color:#F3F3F4">
    <div style="display:flex;align-items:center;gap:14px;padding:30px 48px 0">
      <div style="width:40px;height:40px">${icon.replace('<svg ', '<svg width="40" height="40" ')}</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:-0.015em;line-height:1.2">${caption}</div>
    </div>
    <div style="position:absolute;left:0;right:0;top:108px;bottom:0;display:flex;justify-content:center;align-items:flex-start">
      <img src="${img}" style="${wide ? 'width:1088px' : 'height:640px'};border-radius:16px;border:1px solid #2A2B30">
    </div></body></html>`);
  await page.screenshot({ path: resolve(out, name) });
  await page.close();
}

async function tile(context: BrowserContext, name: string, width: number, height: number): Promise<void> {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  const size = Math.round(height * 0.42);
  await page.setContent(`<!doctype html><html><head>${FONTS}</head><body style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;gap:${Math.round(height * 0.08)}px;background:#111214;color:#F3F3F4">
    <div style="width:${size}px;height:${size}px">${icon.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>
    <div><div style="font-size:${Math.round(height * 0.13)}px;font-weight:800;letter-spacing:-0.015em">ClickFix Warden</div>
    <div style="font-size:${Math.round(height * 0.065)}px;color:#C4C6CC;margin-top:6px">Stops fake CAPTCHA attacks</div></div></body></html>`);
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

  await page.goto(BASE + '/lures/macos-terminal.html');
  await page.click('#copy');
  await slide(context, '2-says-what-and-why.png', 'Says in plain words what was blocked and why', await capture(page));

  await page.goto(`http://clickfix-site.test:47123/`).catch(() => undefined);
  // The site is stopped mid-load and replaced, so watch the address instead of waiting for a load event.
  for (let i = 0; i < 50 && !page.url().includes('warning.html'); i++) await sleep(200);
  await page.waitForLoadState('load');
  await slide(context, '3-known-clickfix-site.png', 'Blocks known ClickFix sites before they load', await capture(page));

  // The banner is what a site reported by its server address shows, so this slide turns off blocking before load.
  await sw.evaluate(async () => chrome.storage.local.set({ settings: { blockPage: false } }));
  await sleep(800);
  await page.goto(`http://reported.test:47123/`);
  await slide(context, '4-reported-site.png', 'Warns about sites reported in public threat databases', await capture(page));
  await sw.evaluate(async () => chrome.storage.local.set({ settings: {} }));
  await sleep(800);

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
  // Windows can hold the profile for a moment after a crash, leaving it must not hide the real error.
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // removed on the next run
  }
}
