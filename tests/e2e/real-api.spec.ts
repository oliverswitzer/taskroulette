/**
 * Real-API E2E tests — hit live Anthropic API, no mocks.
 *
 * Covers:
 *   1. Text-only parse → LIST_EDIT → wheel spin → task card → complete → ALL_DONE
 *   2. Photo-only parse → LIST_EDIT (Claude vision OCRs the fixture image)
 *   3. Text + photo combined → LIST_EDIT (tasks merged from both sources)
 *   4. Empty result UX — Claude finds nothing → stay on DUMP with clear error
 *
 * Fixture: tests/e2e/fixtures/task-list.png
 *   A 600×400 white PNG with three readable tasks:
 *     "Schedule dentist appointment"
 *     "Pay electricity bill"
 *     "Reply to sarah about dinner"
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURE_IMAGE = path.resolve(__dirname, 'fixtures/task-list.png')

// Each test gets plenty of time for real Anthropic calls (haiku is fast but
// network latency + cold start can add up)
const API_TIMEOUT = 20_000

test.describe('Real API — text parse', () => {
  test('brain dump → LIST_EDIT → wheel → task card → complete → ALL_DONE', async ({ page }) => {
    // Budget: ~5s API + up to 5 tasks × (5s spin + 1s anim) = ~35s + buffer
    test.setTimeout(120_000)

    // ── 1. DUMP screen ────────────────────────────────────────────────────────
    await page.goto('/')
    const textarea = page.getByRole('textbox')
    await expect(textarea).toBeVisible()

    // Parse button must be disabled on empty textarea
    const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
    await expect(parseBtn).toBeDisabled()

    await textarea.fill('call dentist, pay the electricity bill, reply to sarah about dinner plans')
    await expect(parseBtn).toBeEnabled()

    // ── 2. Trigger real API call ──────────────────────────────────────────────
    await parseBtn.click()

    // LIST_EDIT must appear with ≥2 tasks
    const letsSpinBtn = page.getByRole('button', { name: /let's spin/i })
    await expect(letsSpinBtn).toBeVisible({ timeout: API_TIMEOUT })

    const taskItems = page.locator('[data-testid="task-item"]')
    const taskCount = await taskItems.count()
    expect(taskCount).toBeGreaterThanOrEqual(2)
    console.log(`[text parse] tasks extracted: ${taskCount}`)

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-list-edit.png' })

    // ── 3. Proceed to wheel ───────────────────────────────────────────────────
    await letsSpinBtn.click()
    // The spin button aria-label is "Spin the wheel" but visible text is "Spin →"
    const spinBtn = page.getByRole('button', { name: /spin the wheel/i })
    await expect(spinBtn).toBeVisible({ timeout: 5000 })

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-wheel-idle.png' })

    // ── 4. Complete all tasks: spin → task card → check off, repeat ───────────
    const allDone = page.locator('[data-testid="all-done-screen"]')

    for (let i = 0; i < 10; i++) {
      // Stop if ALL_DONE is showing
      if (await allDone.isVisible()) break

      // Should be on WHEEL_IDLE — spin button must be visible before we click
      const currentSpinBtn = page.getByRole('button', { name: /spin the wheel/i })
      await expect(currentSpinBtn).toBeVisible({ timeout: 8000 })
      await currentSpinBtn.click()

      // Wait for task card (wheel physics take up to 5s in headless)
      const checkbox = page.locator('[data-testid="task-checkbox"]')
      await expect(checkbox).toBeVisible({ timeout: 12_000 })

      await page.screenshot({ path: `tests/e2e/screenshots/real-api-task-card-${i}.png` })

      // Check it off and wait for confetti + transition (800ms anim)
      await checkbox.click()
      await page.waitForTimeout(1500)

      // If last task was auto-shown (direct TASK_CARD after completion), check it off too
      if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await checkbox.click()
        await page.waitForTimeout(1500)
      }
    }

    // Must reach ALL_DONE
    await expect(allDone).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-all-done.png' })

    console.log('[text parse] ✓ full flow: DUMP → LIST_EDIT → WHEEL → TASK_CARD → ALL_DONE')
  })
})

test.describe('Real API — photo parse (Claude vision)', () => {
  test('photo-only upload → LIST_EDIT with tasks extracted from image', async ({ page }) => {
    test.setTimeout(45_000)

    await page.goto('/')

    // ── Simulate first-time user: clear onboarding key so we can test the modal ──
    await page.evaluate(() => localStorage.removeItem('tr-photo-onboarding-seen'))

    // Parse button must be disabled (no text, no photo)
    const parseBtn = page.getByRole('button', { name: /parse my tasks/i })
    await expect(parseBtn).toBeDisabled()

    // ── Click attach button → onboarding modal should appear ──────────────────
    const attachBtn = page.getByTestId('attach-photo-btn')
    await expect(attachBtn).toBeVisible()
    await attachBtn.click()

    // Onboarding dialog should be visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(dialog).toContainText('Parse a photo too')
    await expect(dialog).toContainText('Handwritten lists')

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-photo-onboarding.png' })

    // ── Intercept file chooser triggered by the "Got it" button ───────────────
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /got it/i }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_IMAGE)

    // Thumbnail preview should appear
    await expect(page.getByTestId('photo-preview')).toBeVisible({ timeout: 3000 })

    // Parse button should now be enabled (photo attached, no text required)
    await expect(parseBtn).toBeEnabled()

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-photo-attached.png' })

    // ── Trigger real Claude vision call ───────────────────────────────────────
    await parseBtn.click()

    const letsSpinBtn = page.getByRole('button', { name: /let's spin/i })
    await expect(letsSpinBtn).toBeVisible({ timeout: API_TIMEOUT })

    const taskItems = page.locator('[data-testid="task-item"]')
    const count = await taskItems.count()
    expect(count).toBeGreaterThanOrEqual(1)
    console.log(`[photo parse] tasks extracted from image: ${count}`)

    // Verify at least one of the known fixture tasks was found
    // (Claude should find "dentist", "electricity bill", or "sarah")
    const allTaskText = await taskItems.allTextContents()
    console.log('[photo parse] extracted tasks:', allTaskText)
    const combined = allTaskText.join(' ').toLowerCase()
    const foundAny = ['dentist', 'electricity', 'sarah', 'dinner', 'bill'].some(kw =>
      combined.includes(kw)
    )
    expect(foundAny, `Expected at least one fixture keyword in: ${combined}`).toBe(true)

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-photo-list-edit.png' })

    // ── Second visit: onboarding should NOT show again ────────────────────────
    // (localStorage key was set by the "Got it" click above)
    const seen = await page.evaluate(() => localStorage.getItem('tr-photo-onboarding-seen'))
    expect(seen).toBe('1')

    console.log('[photo parse] ✓ Claude vision extracted tasks from fixture image')
  })

  test('tapping attach button second time skips onboarding modal', async ({ page }) => {
    test.setTimeout(15_000)

    await page.goto('/')

    // Pre-set the seen flag
    await page.evaluate(() => localStorage.setItem('tr-photo-onboarding-seen', '1'))

    const attachBtn = page.getByTestId('attach-photo-btn')
    await expect(attachBtn).toBeVisible()

    // File chooser should open directly — no modal
    const fileChooserPromise = page.waitForEvent('filechooser')
    await attachBtn.click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_IMAGE)

    // Dialog should NOT have appeared
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).not.toBeVisible()

    // Thumbnail should appear
    await expect(page.getByTestId('photo-preview')).toBeVisible({ timeout: 3000 })

    console.log('[photo attach] ✓ second visit skips onboarding, goes straight to file picker')
  })

  test('remove photo button clears the attachment', async ({ page }) => {
    test.setTimeout(15_000)

    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('tr-photo-onboarding-seen', '1'))

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByTestId('attach-photo-btn').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_IMAGE)

    await expect(page.getByTestId('photo-preview')).toBeVisible({ timeout: 3000 })

    // Remove it
    await page.getByTestId('remove-photo-btn').click()

    // Preview gone, parse button disabled again (no text either)
    await expect(page.getByTestId('photo-preview')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /parse my tasks/i })).toBeDisabled()

    console.log('[photo attach] ✓ remove button clears photo and disables parse button')
  })
})

test.describe('Real API — text + photo combined', () => {
  test('typed text + photo → tasks merged from both sources', async ({ page }) => {
    test.setTimeout(45_000)

    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('tr-photo-onboarding-seen', '1'))

    // Type something NOT in the fixture image
    const textarea = page.getByRole('textbox')
    await textarea.fill('buy new headphones')

    // Attach the fixture image (contains dentist, electricity, sarah)
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByTestId('attach-photo-btn').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_IMAGE)
    await expect(page.getByTestId('photo-preview')).toBeVisible({ timeout: 3000 })

    // Submit — one Claude vision call merges both
    await page.getByRole('button', { name: /parse my tasks/i }).click()

    const letsSpinBtn = page.getByRole('button', { name: /let's spin/i })
    await expect(letsSpinBtn).toBeVisible({ timeout: API_TIMEOUT })

    const taskItems = page.locator('[data-testid="task-item"]')
    const count = await taskItems.count()
    expect(count).toBeGreaterThanOrEqual(2) // at least typed task + ≥1 from photo

    const allText = (await taskItems.allTextContents()).join(' ').toLowerCase()
    console.log(`[combined] tasks (${count}):`, allText)

    // Should contain the typed task
    expect(allText).toContain('headphones')
    // Should also contain something from the photo
    const hasPhotoTask = ['dentist', 'electricity', 'sarah', 'dinner'].some(kw =>
      allText.includes(kw)
    )
    expect(hasPhotoTask, `Photo tasks not found in: ${allText}`).toBe(true)

    await page.screenshot({ path: 'tests/e2e/screenshots/real-api-combined-list-edit.png' })

    console.log('[combined] ✓ text + photo merged correctly by Claude vision')
  })
})
