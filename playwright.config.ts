import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-output',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        // Chromium with iPhone 14 dimensions — webkit not installed
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
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000
    },
    {
      command: 'npx tsx server.ts',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 15000,
      env: { NODE_ENV: 'development' }
    }
  ]
})
