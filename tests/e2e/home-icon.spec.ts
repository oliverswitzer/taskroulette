import { test, expect, type Page } from '@playwright/test'

// Seed to a given app state with N tasks via the window helpers.
async function seedTo(page: Page, appState: string, taskTexts: string[]) {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 15000 })
  await page.evaluate(
    ({ appState, texts }: { appState: string; texts: string[] }) => {
      const tasks = texts.map((text, i) => ({ id: String(i + 1), text, position: i, completed: false }))
      window.__setTasks(tasks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.__setAppState(appState as any)
    },
    { appState, texts: taskTexts }
  )
}

test.describe('Global home icon + reset confirm', () => {
  test('icon is visible on LIST_EDIT and opens the confirm dialog (does not reset immediately)', async ({ page }) => {
    await seedTo(page, 'LIST_EDIT', ['Task one', 'Task two'])
    await expect(page.getByRole('button', { name: /let's spin/i })).toBeVisible({ timeout: 8000 })

    const icon = page.getByTestId('app-home-icon')
    await expect(icon).toBeVisible()
    await icon.click()

    // Confirm dialog appears — tasks NOT cleared yet.
    await expect(page.getByTestId('back-confirm-btn')).toBeVisible()
    await expect(page.getByText('Task one')).toBeVisible()
  })

  test('confirm → resets to the dump screen (tasks cleared)', async ({ page }) => {
    await seedTo(page, 'WHEEL_IDLE', ['Task one', 'Task two'])
    await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('app-home-icon').click()
    await page.getByTestId('back-confirm-btn').click()

    // Back on the dump screen (textarea present), storage cleared.
    await expect(page.getByRole('textbox')).toBeVisible({ timeout: 5000 })
    const remaining = await page.evaluate(() => localStorage.getItem('tr-tasks'))
    expect(remaining === null || remaining === '[]').toBe(true)
  })

  test('cancel → stays put, tasks preserved', async ({ page }) => {
    await seedTo(page, 'WHEEL_IDLE', ['Keep me', 'And me'])
    await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('app-home-icon').click()
    // Cancel button in the confirm dialog
    await page.getByRole('button', { name: /^cancel$/i }).click()

    // Still on the wheel, tasks intact.
    await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible()
    const count = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      return raw ? (JSON.parse(raw) as unknown[]).length : 0
    })
    expect(count).toBe(2)
  })

  test('icon is HIDDEN on the dump screen (already home) and on all-done', async ({ page }) => {
    // Dump screen — fresh load.
    await page.goto('/')
    await expect(page.getByRole('textbox')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('app-home-icon')).toHaveCount(0)

    // All-done screen.
    await page.evaluate(() => {
      window.__setAppState('ALL_DONE')
      ;(window as Window & typeof globalThis & { __setCompletedCount?: (n: number) => void }).__setCompletedCount?.(3)
    })
    await expect(page.locator('[data-testid="all-done-screen"]')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('app-home-icon')).toHaveCount(0)
  })
})
