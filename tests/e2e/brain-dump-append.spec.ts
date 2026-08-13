/**
 * Mid-session brain dump — E2E for the "add more tasks while spinning the
 * wheel" feature. Covers the append (NOT replace) semantics, the overflow
 * messaging near the 20-task cap, and a 20-slice wheel screenshot so slice
 * label sizing at max capacity can be eyeballed.
 *
 * Hits the real Anthropic parse endpoint per project convention (real-api).
 */
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const API_TIMEOUT = 20_000
const OUT = path.resolve(process.cwd(), 'tests/e2e/screenshots')

// Seed straight to WHEEL_IDLE with N tasks via the window helpers.
async function goToWheel(page: Page, taskTexts: string[]) {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 15000 })
  await page.evaluate((texts: string[]) => {
    const tasks = texts.map((text, i) => ({ id: String(i + 1), text, position: i, completed: false }))
    window.__setTasks(tasks)
    window.__setAppState('WHEEL_IDLE')
  }, taskTexts)
  await expect(page.locator('[data-testid="wheel-screen"]')).toBeVisible({ timeout: 8000 })
}

// Seed straight to the initial "Your tasks" LIST_EDIT page with N tasks.
async function goToListEdit(page: Page, taskTexts: string[]) {
  await page.goto('/')
  await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 15000 })
  await page.evaluate((texts: string[]) => {
    const tasks = texts.map((text, i) => ({ id: String(i + 1), text, position: i, completed: false }))
    window.__setTasks(tasks)
    window.__setAppState('LIST_EDIT')
  }, taskTexts)
  await expect(page.getByRole('button', { name: /let's spin/i })).toBeVisible({ timeout: 8000 })
}

test.describe('Mid-session brain dump (append)', () => {
  test('brain dump from the edit sheet APPENDS to the current list, not replaces', async ({ page }) => {
    test.setTimeout(60_000)

    // Start with 2 known tasks on the wheel.
    await goToWheel(page, ['Existing task one', 'Existing task two'])

    // Open the edit sheet from the wheel.
    await page.getByTestId('edit-tasks-btn').click()
    await expect(page.getByTestId('edit-modal')).toBeVisible()

    // Defaults to Quick add — the two existing tasks are listed.
    await expect(page.getByTestId('edit-mode-quick')).toHaveAttribute('aria-selected', 'true')
    expect(await page.getByTestId('edit-modal-task').count()).toBe(2)

    // Switch to Brain dump — explainer must make append behavior clear.
    await page.getByTestId('edit-mode-dump').click()
    const explainer = page.getByTestId('brain-dump-explainer')
    await expect(explainer).toBeVisible()
    await expect(explainer).toContainText(/added to your current list/i)
    await expect(explainer).toContainText(/nothing gets replaced/i)

    // Capacity reflects the 2 existing active tasks.
    await expect(page.getByTestId('brain-dump-capacity')).toContainText('2/20')

    await page.screenshot({ path: `${OUT}/brain-dump-sheet-mobile.png` })

    // Dump two more via the real parse endpoint.
    const textarea = page.getByRole('textbox')
    await textarea.fill('call the dentist to book a cleaning, pay the electricity bill online')
    await page.getByTestId('brain-dump-submit').click()

    // Success toast appears, and the ORIGINAL tasks must still be present
    // (append, not replace). Switch back to Quick add to inspect the list.
    await expect(page.getByTestId('brain-dump-toast')).toBeVisible({ timeout: API_TIMEOUT })
    await expect(page.getByTestId('brain-dump-toast')).toContainText(/added/i)

    await page.getByTestId('edit-mode-quick').click()
    const count = await page.getByTestId('edit-modal-task').count()
    // 2 original + at least 2 newly parsed
    expect(count).toBeGreaterThanOrEqual(4)

    const allText = (await page.getByTestId('edit-modal-task').allTextContents()).join(' ').toLowerCase()
    // Originals survived
    expect(allText).toContain('existing task one')
    expect(allText).toContain('existing task two')
    // New ones landed
    const hasNew = ['dentist', 'electricity', 'bill'].some(kw => allText.includes(kw))
    expect(hasNew, `Expected a newly parsed task in: ${allText}`).toBe(true)

    console.log('[brain dump] ✓ appended to existing list, originals preserved')
  })

  test('at the cap, a brain dump adds nothing and says so — never a silent drop, never exceeds 20', async ({ page }) => {
    test.setTimeout(60_000)

    // Seed to a FULL 20 active tasks — room is exactly 0. This makes the test
    // deterministic regardless of how many tasks the real parser returns:
    // everything must be dropped with the at-limit message.
    const twenty = Array.from({ length: 20 }, (_, i) => `Seeded task ${i + 1}`)
    await goToWheel(page, twenty)

    // Sanity: the seed actually landed as 20 active tasks.
    const seededActive = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      return raw ? (JSON.parse(raw) as { completed: boolean }[]).filter(t => !t.completed).length : -1
    })
    expect(seededActive).toBe(20)

    await page.getByTestId('edit-tasks-btn').click()
    await expect(page.getByTestId('edit-modal')).toBeVisible()
    await page.getByTestId('edit-mode-dump').click()

    // Capacity shows the at-limit state.
    await expect(page.getByTestId('brain-dump-capacity')).toContainText(/at the 20-task limit/i)

    // Dump several — all should be reported as not added.
    await page.getByRole('textbox').fill('buy milk, buy eggs, buy bread, buy coffee, buy butter')
    await page.getByTestId('brain-dump-submit').click()

    const toast = page.getByTestId('brain-dump-toast')
    await expect(toast).toBeVisible({ timeout: API_TIMEOUT })
    await expect(toast).toContainText(/20-task limit/i)

    // Active count must remain exactly 20 (never exceeded, nothing silently added).
    const activeCount = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      if (!raw) return -1
      return (JSON.parse(raw) as { completed: boolean }[]).filter(t => !t.completed).length
    })
    expect(activeCount).toBe(20)

    console.log('[brain dump] ✓ at-cap dump adds nothing, honest messaging, stays at 20')
  })

  test('20-slice wheel screenshot — verify slice labels at max capacity', async ({ page }) => {
    const twenty = [
      'Reply to Sarah about dinner', 'Schedule dentist cleaning', 'Pay electricity bill',
      'Review Jordan PR', 'Update the README', 'Run metrics report', 'Clean old branches',
      'Buy groceries weekly', 'Call the plumber back', 'Book flight to NYC',
      'Renew car insurance', 'Water the plants', 'Email the accountant', 'Fix prod bug',
      'Draft the newsletter', 'Order new headphones', 'Cancel unused subscription',
      'Prep standup notes', 'Back up the laptop', 'Refill prescription',
    ]
    await goToWheel(page, twenty)
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/wheel-idle-20tasks-mobile.png` })
    console.log('[brain dump] ✓ captured 20-slice wheel screenshot')
  })
})

test.describe('Brain dump on the initial "Your tasks" page (LIST_EDIT)', () => {
  test('the SAME toggle appears on the initial task-edit page and APPENDS, not replaces', async ({ page }) => {
    test.setTimeout(60_000)

    await goToListEdit(page, ['Existing task one', 'Existing task two'])

    // The list is visible on the page (not hidden behind the toggle).
    await expect(page.getByText('Existing task one')).toBeVisible()

    // The shared toggle is present here too — defaults to Quick add.
    await expect(page.getByTestId('edit-mode-quick')).toHaveAttribute('aria-selected', 'true')
    await page.getByTestId('edit-mode-dump').click()

    // Same explainer as the wheel sheet (shared component).
    const explainer = page.getByTestId('brain-dump-explainer')
    await expect(explainer).toContainText(/added to your current list/i)
    await expect(explainer).toContainText(/nothing gets replaced/i)
    await expect(page.getByTestId('brain-dump-capacity')).toContainText('2/20')

    await page.screenshot({ path: `${OUT}/list-edit-brain-dump-mobile.png` })

    // Dump two more via the real parse endpoint.
    await page.getByRole('textbox').fill('call the dentist to book a cleaning, pay the electricity bill online')
    await page.getByTestId('brain-dump-submit').click()

    await expect(page.getByTestId('brain-dump-toast')).toBeVisible({ timeout: API_TIMEOUT })
    await expect(page.getByTestId('brain-dump-toast')).toContainText(/added/i)

    // Originals must still be present (append, not replace) — the list is
    // right there on the page, no need to switch tabs.
    await expect(page.getByText('Existing task one')).toBeVisible()
    await expect(page.getByText('Existing task two')).toBeVisible()

    // localStorage confirms the merge grew the list beyond the original 2.
    const activeCount = await page.evaluate(() => {
      const raw = localStorage.getItem('tr-tasks')
      return raw ? (JSON.parse(raw) as { completed: boolean }[]).filter(t => !t.completed).length : -1
    })
    expect(activeCount).toBeGreaterThanOrEqual(4)

    console.log('[brain dump] ✓ initial page: same toggle, appended, originals preserved')
  })
})
