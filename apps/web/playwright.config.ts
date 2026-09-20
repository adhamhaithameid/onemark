import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173/',
    // Chromium only: the 3-engine matrix already runs for security; these are
    // product-flow tests and Chromium is the reference engine for them.
    browserName: 'chromium',
  },
  webServer: {
    command: 'pnpm dev:preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
