import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  outputDir: '.work/test-results',
  webServer: {
    command: 'npx tsx tests/e2e/server.ts',
    port: 47123,
    reuseExistingServer: !process.env.CI,
  },
});
