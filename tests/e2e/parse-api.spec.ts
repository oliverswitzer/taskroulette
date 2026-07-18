import { test, expect } from '@playwright/test'

test.describe('Parse API — real Anthropic call', () => {
  test('brain dump is parsed into a task list', async ({ page }) => {
    // Allow more time for real API call
    test.setTimeout(30000)

    await page.goto('/')

    // Should land on DumpScreen
    const textarea = page.getByRole('textbox')
    await expect(textarea).toBeVisible()

    // Enter a simple, obvious brain dump
    await textarea.fill(
      'call dentist, email the landlord about the leak, buy groceries, finish the presentation for tomorrow'
    )

    // CTA should now be enabled
    const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
    await expect(parseBtn).toBeEnabled()

    // Click — this triggers a real Anthropic API call via Hono
    await parseBtn.click()

    // Should see parsing/loading state briefly
    // Then list should appear — wait up to 15s for real API
    const letsSpinBtn = page.getByRole('button', { name: /let's spin/i })
    await expect(letsSpinBtn).toBeVisible({ timeout: 15000 })

    // At least 2 tasks should have been extracted
    const taskItems = page.locator('[data-testid="task-item"]')
    const count = await taskItems.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Let's spin CTA should be enabled (tasks exist)
    await expect(letsSpinBtn).toBeEnabled()

    // Screenshot the result
    await page.screenshot({
      path: 'tests/e2e/screenshots/parse-api-result-mobile.png',
      fullPage: false
    })

    console.log('Task count:', count)
  })

  test('empty dump shows error, does not proceed', async ({ page }) => {
    test.setTimeout(10000)
    await page.goto('/')

    const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
    // Button disabled on empty textarea
    await expect(parseBtn).toBeDisabled()
  })
})
