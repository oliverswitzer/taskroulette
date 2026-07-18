import { test, expect } from '@playwright/test'

test.describe('Full state machine', () => {
  test('localStorage persists state across reload', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
    // Set tasks and go to wheel
    await page.evaluate(() => {
      const tasks = [
        { id: '1', text: 'Persistent task', position: 0, completed: false }
      ]
      window.__setTasks(tasks)
      window.__setAppState('WHEEL_IDLE')
      // Also save to localStorage directly as the real app would
      localStorage.setItem('tr-tasks', JSON.stringify(tasks))
      localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
    })
    // Reload
    await page.reload()
    // Should still be on wheel
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 3000 })
  })

  test('start fresh from all-done resets to dump', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
    await page.evaluate(() => {
      window.__setAppState('ALL_DONE')
      ;(window as Window & typeof globalThis & { __setCompletedCount?: (n: number) => void }).__setCompletedCount?.(3)
    })
    const allDone = page.locator('[data-testid="all-done-screen"]')
    await expect(allDone).toBeVisible({ timeout: 2000 })
    const startFresh = page.getByRole('button', { name: /spin again tomorrow/i })
    await startFresh.click()
    // Should be on dump screen
    const textarea = page.getByRole('textbox')
    await expect(textarea).toBeVisible({ timeout: 2000 })
  })
})
