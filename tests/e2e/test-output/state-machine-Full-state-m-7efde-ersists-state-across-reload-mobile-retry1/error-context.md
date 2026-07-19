# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: state-machine.spec.ts >> Full state machine >> localStorage persists state across reload
- Location: tests/e2e/state-machine.spec.ts:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - main [ref=e3]:
    - paragraph [ref=e4]: Failed to verify your browser
    - paragraph [ref=e5]: Code 21
  - contentinfo [ref=e6]:
    - generic [ref=e7]:
      - paragraph [ref=e8]: Vercel Security Checkpoint
      - paragraph [ref=e9]: iad1::1784478491-itVF1inltU5kZ63zKkwwC7Za8PxmEF8Q
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Full state machine', () => {
  4  |   test('localStorage persists state across reload', async ({ page }) => {
  5  |     await page.goto('/')
> 6  |     await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
     |                ^ Error: page.waitForFunction: Test timeout of 30000ms exceeded.
  7  |     // Set tasks and go to wheel
  8  |     await page.evaluate(() => {
  9  |       const tasks = [
  10 |         { id: '1', text: 'Persistent task', position: 0, completed: false }
  11 |       ]
  12 |       window.__setTasks(tasks)
  13 |       window.__setAppState('WHEEL_IDLE')
  14 |       // Also save to localStorage directly as the real app would
  15 |       localStorage.setItem('tr-tasks', JSON.stringify(tasks))
  16 |       localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
  17 |     })
  18 |     // Reload
  19 |     await page.reload()
  20 |     // Should still be on wheel
  21 |     const canvas = page.locator('canvas')
  22 |     await expect(canvas).toBeVisible({ timeout: 3000 })
  23 |   })
  24 | 
  25 |   test('start fresh from all-done resets to dump', async ({ page }) => {
  26 |     await page.goto('/')
  27 |     await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 10000 })
  28 |     await page.evaluate(() => {
  29 |       window.__setAppState('ALL_DONE')
  30 |       ;(window as Window & typeof globalThis & { __setCompletedCount?: (n: number) => void }).__setCompletedCount?.(3)
  31 |     })
  32 |     // Small wait for React to re-render after state mutation
  33 |     await page.waitForTimeout(300)
  34 |     const allDone = page.locator('[data-testid="all-done-screen"]')
  35 |     await expect(allDone).toBeVisible({ timeout: 5000 })
  36 |     const startFresh = page.getByRole('button', { name: /task dump|spin again/i })
  37 |     await startFresh.click()
  38 |     // Should be on dump screen
  39 |     const textarea = page.getByRole('textbox')
  40 |     await expect(textarea).toBeVisible({ timeout: 5000 })
  41 |   })
  42 | })
  43 | 
```