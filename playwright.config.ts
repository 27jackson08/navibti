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
  /*
   * Cross-browser coverage is for rendering, layout and platform APIs — the
   * things that actually differ between engines. The journeys exercise
   * server-side logic that is identical everywhere, and running them three
   * times over one shared in-memory store had them racing each other: every
   * browser passed alone, the combined run failed, and the signature looked
   * like a rendering difference for four rounds before it turned out to be a
   * race against ourselves.
   *
   * So the journeys run once, and the accessibility and layout checks run
   * everywhere. That is also the split each kind of test was worth.
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /accessibility\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /accessibility\.spec\.ts/,
    },
  ],
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
