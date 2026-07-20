import { test, expect, type Page } from '@playwright/test'

// Helper: get app to WHEEL_IDLE state with N tasks via window helpers
async function goToWheel(page: Page, taskTexts: string[]) {
  await page.goto('/')
  // Use window helpers to skip the dump/parse flow
  await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 15000 })
  await page.evaluate((texts: string[]) => {
    const tasks = texts.map((text, i) => ({
      id: String(i + 1),
      text,
      position: i,
      completed: false,
    }))
    window.__setTasks(tasks)
    window.__setAppState('WHEEL_IDLE')
  }, taskTexts)
  // Wait for wheel screen to appear
  await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 8000 })
}

test.describe('Wheel screen', () => {
  test('wheel renders with tasks', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    // Canvas should be present
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    // Spin button should be present and enabled
    const spinBtn = page.getByRole('button', { name: /spin/i })
    await expect(spinBtn).toBeEnabled()
    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/wheel-idle-mobile.png' })
  })

  test('wheel renders with 15 tasks', async ({ page }) => {
    const tasks = Array.from({ length: 15 }, (_, i) => `Task ${i + 1}: Do the thing`)
    await goToWheel(page, tasks)
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/screenshots/wheel-idle-15tasks-mobile.png' })
  })

  test('spin button triggers spin and disables during spin', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const spinBtn = page.getByRole('button', { name: /spin/i })
    await spinBtn.click()
    // Button should become disabled during spin
    await expect(spinBtn).toBeDisabled()
  })

  test('spin completes and shows task card', async ({ page }) => {
    test.setTimeout(15000)
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const spinBtn = page.getByRole('button', { name: /spin/i })
    await spinBtn.click()
    // Wait for task card to appear (max 8s for spin + transition)
    const taskCard = page.locator('[data-testid="task-card"]')
    await expect(taskCard).toBeVisible({ timeout: 8000 })
    // Screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/task-card-mobile.png' })
  })

  test('task card has working checkbox', async ({ page }) => {
    test.setTimeout(15000)
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    await page.getByRole('button', { name: /spin/i }).click()
    const taskCard = page.locator('[data-testid="task-card"]')
    await expect(taskCard).toBeVisible({ timeout: 8000 })
    // Check off the task
    const checkbox = page.locator('[data-testid="task-checkbox"]')
    await checkbox.click()
    // Should return to wheel (task removed) — wheel screen visible again
    // Use wheel-screen testid since confetti also creates a canvas element
    await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 3000 })
  })

  test('completing last task shows all-done screen', async ({ page }) => {
    test.setTimeout(30000)
    // Use 2 tasks so the wheel actually renders, then complete both
    await goToWheel(page, ['Only task', 'Second task'])
    // Spin and complete first task
    await page.getByRole('button', { name: /spin/i }).click()
    // Use .first() — during AnimatePresence exit two task-card divs can coexist briefly
    const taskCard = page.locator('[data-testid="task-card"]').first()
    await expect(taskCard).toBeVisible({ timeout: 10000 })
    const checkbox = page.locator('[data-testid="task-checkbox"]').first()
    // Capture whatever task the wheel picked first — could be either task
    const firstText = await taskCard.innerText()
    await checkbox.click()
    // After completing task 1, app auto-selects the remaining task.
    // Card stays mounted but its content changes — wait for that change.
    await expect.poll(async () => await taskCard.innerText(), { timeout: 10000 }).not.toBe(firstText)
    // Ensure checkbox is interactive before clicking
    await expect(checkbox).toBeEnabled({ timeout: 5000 })
    await checkbox.click()
    // All done screen — fires after 0 remaining + confetti burst (~800ms total)
    const allDone = page.locator('[data-testid="all-done-screen"]')
    await expect(allDone).toBeVisible({ timeout: 8000 })
    await page.screenshot({ path: 'tests/e2e/screenshots/all-done-mobile.png' })
  })

  test('spin again returns to wheel and auto-spins', async ({ page }) => {
    test.setTimeout(40000)
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    await page.getByRole('button', { name: /spin/i }).click()
    const taskCard = page.locator('[data-testid="task-card"]')
    await expect(taskCard).toBeVisible({ timeout: 10000 })
    // Click skip/spin again
    const skipBtn = page.locator('[data-testid="spin-again-btn"]')
    await skipBtn.click()
    // Auto-spin fires immediately — the wheel spins and lands on a new task card.
    // We verify by waiting for another task card to appear (the auto-spin completed).
    await expect(page.locator('[data-testid="task-card"]')).toBeVisible({ timeout: 15000 })
  })

  test('edit modal opens and closes from wheel', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries'])
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
    await editBtn.click()
    const modal = page.locator('[data-testid="edit-modal"]')
    await expect(modal).toBeVisible()
    await page.screenshot({ path: 'tests/e2e/screenshots/edit-modal-mobile.png' })
    // Close by clicking Done
    const doneBtn = page.getByRole('button', { name: /done/i })
    await doneBtn.click()
    await expect(modal).not.toBeVisible()
  })
})
