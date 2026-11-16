import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block', trace: 'off' },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm --filter @tls/web dev --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173', reuseExistingServer: false,
  },
});
