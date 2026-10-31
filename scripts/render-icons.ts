// Renders assets/icon.svg into the PNG sizes the browsers and stores need.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 96, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: resolve(root, `public/icon/${size}.png`), omitBackground: true });
}
await browser.close();
console.log('Icons written to public/icon');
