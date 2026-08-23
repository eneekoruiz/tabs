import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 800 },
    channel: 'msedge', // Utiliza Microsoft Edge nativo del sistema Windows sin requerir descargas pesadas
    headless: true,
  },
  webServer: {
    command: 'cmd /c npx serve . -l 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
  ],
});
