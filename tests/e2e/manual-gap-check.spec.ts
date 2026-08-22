import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'tests/e2e/screenshots')

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

test.use({ viewport: { width: 390, height: 844 } })

test('TASK_CARD gap check on 390x844 viewport', async ({ page }) => {
  test.setTimeout(20000)
  await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  await page.getByRole('button', { name: /spin/i }).click()
  const taskCard = page.locator('[data-testid="task-card"]')
  await expect(taskCard).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(700) // let spring settle

  await page.screenshot({ path: `${OUT}/task-card-390x844.png` })

  const canvas = page.locator('canvas')
  const canvasBox = await canvas.boundingBox()
  const cardBox = await taskCard.boundingBox()
  console.log('canvas top:', canvasBox?.y, 'canvas height:', canvasBox?.height)
  console.log('taskCard top:', cardBox?.y)

  expect(canvasBox).not.toBeNull()
  // The gap above the wheel canvas should be small — not a huge dead zone.
  // AppLayout header is ~44+12+12=68px; allow generous margin up to 100px.
  expect(canvasBox!.y).toBeLessThan(120)
})

test('WHEEL_IDLE looks normal on 390x844 (no regression)', async ({ page }) => {
  await goToWheel(page, ['Call dentist', 'Buy groceries', 'Email Sarah'])
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/wheel-idle-390x844.png` })
})
