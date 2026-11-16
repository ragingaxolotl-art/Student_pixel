import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/pages',
  outputDir: './test-results',
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PAGES_TEST_URL || 'http://127.0.0.1:8772/Student_pixel/',
    browserName: 'chromium',
    channel: process.env.PAGES_BROWSER_CHANNEL || undefined,
    viewport: { width: 1280, height: 800 },
  },
  webServer: process.env.PAGES_TEST_URL ? undefined : {
    command: 'node scripts/serve-pages.cjs',
    url: 'http://127.0.0.1:8772/Student_pixel/',
    reuseExistingServer: !process.env.CI,
  },
});
