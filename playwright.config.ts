import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the running Docker stack:
 *   docker compose up -d && npm run test:e2e
 * or fully inside Docker: docker compose --profile test run --rm e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    viewport: { width: 1600, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } }],
});
