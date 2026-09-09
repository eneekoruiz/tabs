import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
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
    ...(isCI ? {} : { channel: 'msedge' }),
  },
  webServer: {
    command: `node ./node_modules/serve/build/main.js . -l tcp://127.0.0.1:${port} --no-clipboard`,
    url: baseURL,
    reuseExistingServer: Boolean(process.env.PLAYWRIGHT_BASE_URL),
    timeout: 120000,
  },
  projects: [
    {
      name: isCI ? 'chromium' : 'msedge',
      use: {
        ...(isCI ? devices['Desktop Chrome'] : { ...devices['Desktop Edge'], channel: 'msedge' }),
      },
    },
  ],
});
