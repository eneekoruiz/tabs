import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 800 },
    headless: true,
    ...(isCI ? {} : { channel: 'msedge' }),
  },
  webServer: {
    command: 'node ./node_modules/serve/build/main.js . -p 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
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
