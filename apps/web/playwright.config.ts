import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the dev servers (API + web).
 * Start them with `pnpm dev` (and a migrated database) or let Playwright start them.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    locale: 'es-PE',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --dir ../.. dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
