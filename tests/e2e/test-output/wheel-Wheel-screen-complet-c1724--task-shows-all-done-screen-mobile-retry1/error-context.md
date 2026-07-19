# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wheel.spec.ts >> Wheel screen >> completing last task shows all-done screen
- Location: tests/e2e/wheel.spec.ts:77:3

# Error details

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('[data-testid="task-card"]')
Expected: hidden
Received: visible
Timeout:  5000ms

Call log:
  - Expect "toBeHidden" with timeout 5000ms
  - waiting for locator('[data-testid="task-card"]')
    14 × locator resolved to <div data-testid="task-card">…</div>
       - unexpected value "visible"

```

```yaml
- button "Back to task dump":
  - img
  - text: Dump
- img
- paragraph: The wheel chose
- paragraph: Second task
- button "Mark task complete"
- paragraph: Got it? Check it off!
- button "skip for now →"
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test'
  2   | 
  3   | // Helper: get app to WHEEL_IDLE state with N tasks via window helpers
  4   | async function goToWheel(page: Page, taskTexts: string[]) {
  5   |   await page.goto('/')
  6   |   // Use window helpers to skip the dump/parse flow
  7   |   await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 15000 })
  8   |   await page.evaluate((texts: string[]) => {
  9   |     const tasks = texts.map((text, i) => ({
  10  |       id: String(i + 1),
  11  |       text,
  12  |       position: i,
  13  |       completed: false,
  14  |     }))
  15  |     window.__setTasks(tasks)
  16  |     window.__setAppState('WHEEL_IDLE')
  17  |   }, taskTexts)
  18  |   // Wait for wheel screen to appear
  19  |   await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 8000 })
  20  | }
  21  | 
  22  | test.describe('Wheel screen', () => {
  23  |   test('wheel renders with tasks', async ({ page }) => {
  24  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  25  |     // Canvas should be present
  26  |     const canvas = page.locator('canvas')
  27  |     await expect(canvas).toBeVisible()
  28  |     // Spin button should be present and enabled
  29  |     const spinBtn = page.getByRole('button', { name: /spin/i })
  30  |     await expect(spinBtn).toBeEnabled()
  31  |     // Take screenshot
  32  |     await page.screenshot({ path: 'tests/e2e/screenshots/wheel-idle-mobile.png' })
  33  |   })
  34  | 
  35  |   test('wheel renders with 15 tasks', async ({ page }) => {
  36  |     const tasks = Array.from({ length: 15 }, (_, i) => `Task ${i + 1}: Do the thing`)
  37  |     await goToWheel(page, tasks)
  38  |     const canvas = page.locator('canvas')
  39  |     await expect(canvas).toBeVisible()
  40  |     await page.screenshot({ path: 'tests/e2e/screenshots/wheel-idle-15tasks-mobile.png' })
  41  |   })
  42  | 
  43  |   test('spin button triggers spin and disables during spin', async ({ page }) => {
  44  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  45  |     const spinBtn = page.getByRole('button', { name: /spin/i })
  46  |     await spinBtn.click()
  47  |     // Button should become disabled during spin
  48  |     await expect(spinBtn).toBeDisabled()
  49  |   })
  50  | 
  51  |   test('spin completes and shows task card', async ({ page }) => {
  52  |     test.setTimeout(15000)
  53  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  54  |     const spinBtn = page.getByRole('button', { name: /spin/i })
  55  |     await spinBtn.click()
  56  |     // Wait for task card to appear (max 8s for spin + transition)
  57  |     const taskCard = page.locator('[data-testid="task-card"]')
  58  |     await expect(taskCard).toBeVisible({ timeout: 8000 })
  59  |     // Screenshot
  60  |     await page.screenshot({ path: 'tests/e2e/screenshots/task-card-mobile.png' })
  61  |   })
  62  | 
  63  |   test('task card has working checkbox', async ({ page }) => {
  64  |     test.setTimeout(15000)
  65  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  66  |     await page.getByRole('button', { name: /spin/i }).click()
  67  |     const taskCard = page.locator('[data-testid="task-card"]')
  68  |     await expect(taskCard).toBeVisible({ timeout: 8000 })
  69  |     // Check off the task
  70  |     const checkbox = page.locator('[data-testid="task-checkbox"]')
  71  |     await checkbox.click()
  72  |     // Should return to wheel (task removed) — wheel screen visible again
  73  |     // Use wheel-screen testid since confetti also creates a canvas element
  74  |     await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 3000 })
  75  |   })
  76  | 
  77  |   test('completing last task shows all-done screen', async ({ page }) => {
  78  |     test.setTimeout(30000)
  79  |     // Use 2 tasks so the wheel actually renders, then complete both
  80  |     await goToWheel(page, ['Only task', 'Second task'])
  81  |     // Spin and complete first task
  82  |     await page.getByRole('button', { name: /spin/i }).click()
  83  |     const taskCard = page.locator('[data-testid="task-card"]')
  84  |     await expect(taskCard).toBeVisible({ timeout: 10000 })
  85  |     await page.locator('[data-testid="task-checkbox"]').click()
  86  |     // Wait for first completion animation (800ms) + transition to next task card
> 87  |     await expect(taskCard).toBeHidden({ timeout: 5000 })
      |                            ^ Error: expect(locator).toBeHidden() failed
  88  |     // With 1 task remaining, app auto-shows task card (no spin needed)
  89  |     await expect(taskCard).toBeVisible({ timeout: 10000 })
  90  |     await page.locator('[data-testid="task-checkbox"]').click()
  91  |     // All done screen — allow extra time for 800ms completing animation + confetti + transition
  92  |     const allDone = page.locator('[data-testid="all-done-screen"]')
  93  |     await expect(allDone).toBeVisible({ timeout: 8000 })
  94  |     await page.screenshot({ path: 'tests/e2e/screenshots/all-done-mobile.png' })
  95  |   })
  96  | 
  97  |   test('spin again returns to wheel and auto-spins', async ({ page }) => {
  98  |     test.setTimeout(40000)
  99  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  100 |     await page.getByRole('button', { name: /spin/i }).click()
  101 |     const taskCard = page.locator('[data-testid="task-card"]')
  102 |     await expect(taskCard).toBeVisible({ timeout: 10000 })
  103 |     // Click skip/spin again
  104 |     const skipBtn = page.locator('[data-testid="spin-again-btn"]')
  105 |     await skipBtn.click()
  106 |     // Auto-spin fires immediately — the wheel spins and lands on a new task card.
  107 |     // We verify by waiting for another task card to appear (the auto-spin completed).
  108 |     await expect(page.locator('[data-testid="task-card"]')).toBeVisible({ timeout: 15000 })
  109 |   })
  110 | 
  111 |   test('edit modal opens and closes from wheel', async ({ page }) => {
  112 |     await goToWheel(page, ['Call dentist', 'Buy groceries'])
  113 |     const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
  114 |     await editBtn.click()
  115 |     const modal = page.locator('[data-testid="edit-modal"]')
  116 |     await expect(modal).toBeVisible()
  117 |     await page.screenshot({ path: 'tests/e2e/screenshots/edit-modal-mobile.png' })
  118 |     // Close by clicking Done
  119 |     const doneBtn = page.getByRole('button', { name: /done/i })
  120 |     await doneBtn.click()
  121 |     await expect(modal).not.toBeVisible()
  122 |   })
  123 | })
  124 | 
```