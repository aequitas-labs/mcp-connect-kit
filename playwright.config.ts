import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  reporter: [['list']],
  // CI installs Playwright's Chromium; locally, the installed Chrome is enough.
  use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
});
