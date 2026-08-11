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

  test('"skip for now" link stays within the mobile viewport when the task card is showing', async ({ page }) => {
    test.setTimeout(15000)
    // Regression test: WheelScreen used to reserve a hardcoded 300px for the
    // task card and center the wheel in the remaining space, which drifted
    // from the real card height (longer task text = taller card) and pushed
    // the "skip for now" link off the bottom of the screen on real devices.
    // The wheel's reserved bottom space is now driven by a ResizeObserver
    // measuring the actual TaskCard height, so this must hold regardless of
    // task text length.
    await goToWheel(page, [
      'A pretty long task title that will wrap onto two lines in the card',
      'Another task',
    ])
    await page.getByRole('button', { name: /spin/i }).click()
    const taskCard = page.locator('[data-testid="task-card"]')
    await expect(taskCard).toBeVisible({ timeout: 10000 })

    const skipBtn = page.locator('[data-testid="spin-again-btn"]')
    await expect(skipBtn).toBeVisible({ timeout: 5000 })
    // The task card slides in via a spring animation — wait for its transform
    // to settle before reading pixel positions, otherwise this can flake by
    // reading a mid-animation frame (spring damping/stiffness settle time).
    await page.waitForTimeout(700)

    const box = await skipBtn.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    // The button's full bounding box must fit inside the viewport height —
    // not just be "attached" to the DOM off-screen.
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
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

test.describe('Wheel slice click popover', () => {
  test('clicking a slice while idle opens a popover with 3 options', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    // Click near the top of the wheel (inside the rim, above center) — lands
    // in a slice since the wheel starts unrotated with slice 0 at 12 o'clock.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)

    const popover = page.locator('[data-testid="slice-popover"]')
    await expect(popover).toBeVisible()
    await expect(page.locator('[data-testid="slice-popover-set-active"]')).toBeVisible()
    await expect(page.locator('[data-testid="slice-popover-mark-complete"]')).toBeVisible()
    await expect(page.locator('[data-testid="slice-popover-delete"]')).toBeVisible()
  })

  test('popover dismisses when tapping outside', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)
    await expect(page.locator('[data-testid="slice-popover"]')).toBeVisible()

    // Click far outside the wheel/popover
    await page.mouse.click(10, 10)
    await expect(page.locator('[data-testid="slice-popover"]')).not.toBeVisible()
  })

  test('popover stays fully within the viewport when clicking a slice on the right side', async ({ page }) => {
    // Regression test: framer-motion's own `transform` (driven by the
    // popover's initial/animate scale+y values) silently overwrote a CSS
    // `transform: translate(-50%, 0)` that was being used to center the
    // popover horizontally on the click point. The clamp math looked
    // correct on paper but the actual rendered position ignored the -50%
    // shift entirely, so clicking a slice on the right half of the wheel
    // (any x position, but especially with a long task name) rendered the
    // popover clipped off the right edge on mobile viewports.
    await goToWheel(page, [
      'Set up Oddly Good profile on Postiz',
      'Create Postiz app account',
    ])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    // Right side of the wheel, roughly mid-height
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.55)

    const popover = page.locator('[data-testid="slice-popover"]')
    await expect(popover).toBeVisible({ timeout: 3000 })
    await page.waitForTimeout(400) // let the spring animation settle

    const popoverBox = await popover.boundingBox()
    const viewport = page.viewportSize()
    expect(popoverBox).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(popoverBox!.x).toBeGreaterThanOrEqual(0)
    expect(popoverBox!.x + popoverBox!.width).toBeLessThanOrEqual(viewport!.width)
  })

  test('"Set as active task" jumps straight to the task card, skipping the spin', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)
    await page.locator('[data-testid="slice-popover-set-active"]').click()

    const taskCard = page.locator('[data-testid="task-card"]')
    await expect(taskCard).toBeVisible({ timeout: 3000 })
  })

  test('"Mark as complete" removes the task from the wheel without opening the task card', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)
    await page.locator('[data-testid="slice-popover-mark-complete"]').click()

    // Popover closes, wheel stays idle with one fewer task, no task card shown
    await expect(page.locator('[data-testid="slice-popover"]')).not.toBeVisible()
    const remainingTasks = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      return raw ? (JSON.parse(raw) as { completed: boolean }[]).filter(t => !t.completed).length : null
    })
    expect(remainingTasks).toBe(2)
  })

  test('"Delete" permanently removes the task', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)
    await page.locator('[data-testid="slice-popover-delete"]').click()

    await expect(page.locator('[data-testid="slice-popover"]')).not.toBeVisible()
    const totalTasks = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      return raw ? (JSON.parse(raw) as unknown[]).length : null
    })
    expect(totalTasks).toBe(2)
  })

  test('slice clicks are ignored while the wheel is spinning', async ({ page }) => {
    await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
    await page.getByRole('button', { name: /spin/i }).click()
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25)
    await expect(page.locator('[data-testid="slice-popover"]')).not.toBeVisible()
  })
})
