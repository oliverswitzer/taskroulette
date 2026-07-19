import { defineConfig } from '@playwright/test'

// Run the full E2E suite against the deployed Vercel production URL.
// No local servers needed — webServer block is omitted intentionally.
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-output',
  fullyParallel: false,
  forbidOnly: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'https://taskroulette.vercel.app',
    ignoreHTTPSErrors: false,
    trace: 'on-first-retry',
    screenshot: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        channel: 'chromium',
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      }
    },
    {
      name: 'desktop',
      use: {
        channel: 'chromium',
        viewport: { width: 1280, height: 800 }
      }
    }
  ],
  // No webServer — Vercel is already running
})
