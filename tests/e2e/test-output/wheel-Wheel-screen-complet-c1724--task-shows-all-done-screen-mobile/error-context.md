# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wheel.spec.ts >> Wheel screen >> completing last task shows all-done screen
- Location: tests/e2e/wheel.spec.ts:77:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="wheel-screen"]')
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 3000ms
  - waiting for locator('[data-testid="wheel-screen"]')

```

```yaml
- button "Back to task dump":
  - img
  - text: Dump
- img
- paragraph: The wheel chose
- paragraph: Only task
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
  7   |   await page.waitForFunction(() => typeof window.__setAppState !== 'undefined')
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
> 19  |   await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 3000 })
      |                                                              ^ Error: expect(locator).toBeVisible() failed
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
  78  |     test.setTimeout(15000)
  79  |     await goToWheel(page, ['Only task'])
  80  |     await page.getByRole('button', { name: /spin/i }).click()
  81  |     const taskCard = page.locator('[data-testid="task-card"]')
  82  |     await expect(taskCard).toBeVisible({ timeout: 8000 })
  83  |     await page.locator('[data-testid="task-checkbox"]').click()
  84  |     // All done screen
  85  |     const allDone = page.locator('[data-testid="all-done-screen"]')
  86  |     await expect(allDone).toBeVisible({ timeout: 3000 })
  87  |     await page.screenshot({ path: 'tests/e2e/screenshots/all-done-mobile.png' })
  88  |   })
  89  | 
  90  |   test('spin again returns to wheel and auto-spins', async ({ page }) => {
  91  |     test.setTimeout(20000)
  92  |     await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  93  |     await page.getByRole('button', { name: /spin/i }).click()
  94  |     const taskCard = page.locator('[data-testid="task-card"]')
  95  |     await expect(taskCard).toBeVisible({ timeout: 8000 })
  96  |     // Click skip/spin again
  97  |     const skipBtn = page.locator('[data-testid="spin-again-btn"]')
  98  |     await skipBtn.click()
  99  |     // Wait for wheel screen to appear first, then check spinning state
  100 |     await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 3000 })
  101 |     // Wheel should be spinning again (spin button disabled) — auto-spin fires after 200ms delay
  102 |     const spinBtn = page.getByRole('button', { name: /spin/i })
  103 |     await expect(spinBtn).toBeDisabled({ timeout: 4000 })
  104 |   })
  105 | 
  106 |   test('edit modal opens and closes from wheel', async ({ page }) => {
  107 |     await goToWheel(page, ['Call dentist', 'Buy groceries'])
  108 |     const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
  109 |     await editBtn.click()
  110 |     const modal = page.locator('[data-testid="edit-modal"]')
  111 |     await expect(modal).toBeVisible()
  112 |     await page.screenshot({ path: 'tests/e2e/screenshots/edit-modal-mobile.png' })
  113 |     // Close by clicking Done
  114 |     const doneBtn = page.getByRole('button', { name: /done/i })
  115 |     await doneBtn.click()
  116 |     await expect(modal).not.toBeVisible()
  117 |   })
  118 | })
  119 | 
```