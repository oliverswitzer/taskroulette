# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: parse-api.spec.ts >> Parse API — real Anthropic call >> brain dump is parsed into a task list
- Location: tests/e2e/parse-api.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /let's spin/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('button', { name: /let's spin/i })

```

```yaml
- button "file upload"
- text: TaskRoulette
- heading "What's swirling around in your head?" [level=1]
- paragraph: No lists, no formats, no pressure. Just let it all out. We'll sort it for you.
- textbox "Just type it all out.. emails to send, calls to make, things you've been avoiding.. all of it. Don't worry about order or categories.": call dentist, email the landlord about the leak, buy groceries, finish the presentation for tomorrow
- button "Attach a photo of a task list":
  - img
  - text: Add photo
- alert: You've hit your limit of 3 sessions today. Come back tomorrow 💪
- button "Parse my tasks": Parse my tasks →
- button "reset"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Parse API — real Anthropic call', () => {
  4  |   test('brain dump is parsed into a task list', async ({ page }) => {
  5  |     // Allow more time for real API call
  6  |     test.setTimeout(30000)
  7  | 
  8  |     await page.goto('/')
  9  | 
  10 |     // Should land on DumpScreen
  11 |     const textarea = page.getByRole('textbox')
  12 |     await expect(textarea).toBeVisible()
  13 | 
  14 |     // Enter a simple, obvious brain dump
  15 |     await textarea.fill(
  16 |       'call dentist, email the landlord about the leak, buy groceries, finish the presentation for tomorrow'
  17 |     )
  18 | 
  19 |     // CTA should now be enabled
  20 |     const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
  21 |     await expect(parseBtn).toBeEnabled()
  22 | 
  23 |     // Click — this triggers a real Anthropic API call via Hono
  24 |     await parseBtn.click()
  25 | 
  26 |     // Should see parsing/loading state briefly
  27 |     // Then list should appear — wait up to 15s for real API
  28 |     const letsSpinBtn = page.getByRole('button', { name: /let's spin/i })
> 29 |     await expect(letsSpinBtn).toBeVisible({ timeout: 15000 })
     |                               ^ Error: expect(locator).toBeVisible() failed
  30 | 
  31 |     // At least 2 tasks should have been extracted
  32 |     const taskItems = page.locator('[data-testid="task-item"]')
  33 |     const count = await taskItems.count()
  34 |     expect(count).toBeGreaterThanOrEqual(2)
  35 | 
  36 |     // Let's spin CTA should be enabled (tasks exist)
  37 |     await expect(letsSpinBtn).toBeEnabled()
  38 | 
  39 |     // Screenshot the result
  40 |     await page.screenshot({
  41 |       path: 'tests/e2e/screenshots/parse-api-result-mobile.png',
  42 |       fullPage: false
  43 |     })
  44 | 
  45 |     console.log('Task count:', count)
  46 |   })
  47 | 
  48 |   test('empty dump shows error, does not proceed', async ({ page }) => {
  49 |     test.setTimeout(10000)
  50 |     await page.goto('/')
  51 | 
  52 |     const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
  53 |     // Button disabled on empty textarea
  54 |     await expect(parseBtn).toBeDisabled()
  55 |   })
  56 | })
  57 | 
```