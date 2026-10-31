import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { type BrowserContext, chromium, test as base, expect, type Page, type Worker } from '@playwright/test';

const root = resolve(import.meta.dirname, '..', '..');
export const EXT_PATH = resolve(root, '.output/chrome-mv3-e2e');
export const BASE = 'http://127.0.0.1:47123';
export const site = (host: string, path = '/') => `http://${host}:47123${path}`;

let profileCounter = 0;

export const test = base.extend<{ context: BrowserContext; sw: Worker; extId: string }>({
  context: async ({}, use) => {
    const profile = resolve(root, '.work/pw-profiles', `p${process.pid}-${profileCounter++}`);
    rmSync(profile, { recursive: true, force: true });
    mkdirSync(profile, { recursive: true });
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, '--host-resolver-rules=MAP *.test 127.0.0.1'],
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await use(context);
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    // Wait until the extension has downloaded and verified the test feed.
    await expect
      .poll(async () => sw.evaluate(async () => !!(await chrome.storage.local.get('feedMeta')).feedMeta), { timeout: 20_000 })
      .toBe(true);
    await use(sw);
  },
  extId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host);
  },
});

export { expect };

export async function grant(context: BrowserContext, origin: string): Promise<void> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
}

export async function readClipboard(page: Page): Promise<string> {
  await page.bringToFront();
  return page.evaluate(() => navigator.clipboard.readText());
}

export async function writeClipboard(page: Page, text: string): Promise<void> {
  await page.bringToFront();
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

/** The overlay lives in a closed shadow root, so tests look for its host element and use the extension's own log. */
export async function overlayShown(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.querySelector('cfw-warden'));
}

export async function lastDetection(sw: Worker): Promise<{ kind: string; action: string; host: string } | undefined> {
  return sw.evaluate(async () => {
    const { log } = (await chrome.storage.local.get('log')) as { log?: { kind: string; action: string; host: string }[] };
    return log?.[0];
  });
}

export async function detectionCount(sw: Worker): Promise<number> {
  return sw.evaluate(async () => {
    const { log } = (await chrome.storage.local.get('log')) as { log?: unknown[] };
    return log?.length ?? 0;
  });
}
