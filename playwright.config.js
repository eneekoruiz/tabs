import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const port = Number(process.env.PLAYWRIGHT_PORT || (process.env.PLAYWRIGHT_BASE_URL ? new URL(process.env.PLAYWRIGHT_BASE_URL).port : 4173) || 4173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    headless: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: `node ./node_modules/serve/build/main.js . -l tcp://127.0.0.1:${port} --no-clipboard --no-request-logging`,
    url: baseURL,
    reuseExistingServer: Boolean(process.env.PLAYWRIGHT_BASE_URL),
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
