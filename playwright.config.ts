import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end and accessibility checks.
 *
 * Runs against a production build rather than the dev server, because the
 * things being measured here — contrast, focus order, layout at narrow widths —
 * are properties of what actually ships.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    // Never reuse. A stale `next start` left over from another task serves the
    // previous build's HTML against a rebuilt .next, so every stylesheet 404s
    // and the suite silently measures an unstyled page. That cost an hour once.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
