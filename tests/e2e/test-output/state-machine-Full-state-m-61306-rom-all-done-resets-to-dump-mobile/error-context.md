# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: state-machine.spec.ts >> Full state machine >> start fresh from all-done resets to dump
- Location: tests/e2e/state-machine.spec.ts:25:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /spin again tomorrow/i })

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - img "Star" [ref=e7]: ⭐
  - generic [ref=e8]:
    - heading "The wheel picked, you delivered. 3 tasks. Clean sweep." [level=1] [ref=e9]
    - paragraph [ref=e10]: 3 tasks done. Not bad for a brain that wasn't sure where to start.
  - button "Task dump & spin again →" [ref=e12] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Full state machine', () => {
  4  |   test('localStorage persists state across reload', async ({ page }) => {
  5  |     await page.goto('/')
  6  |     await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
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
  27 |     await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
  28 |     await page.evaluate(() => {
  29 |       window.__setAppState('ALL_DONE')
  30 |       ;(window as Window & typeof globalThis & { __setCompletedCount?: (n: number) => void }).__setCompletedCount?.(3)
  31 |     })
  32 |     const allDone = page.locator('[data-testid="all-done-screen"]')
  33 |     await expect(allDone).toBeVisible({ timeout: 2000 })
  34 |     const startFresh = page.getByRole('button', { name: /spin again tomorrow/i })
> 35 |     await startFresh.click()
     |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  36 |     // Should be on dump screen
  37 |     const textarea = page.getByRole('textbox')
  38 |     await expect(textarea).toBeVisible({ timeout: 2000 })
  39 |   })
  40 | })
  41 | 
```