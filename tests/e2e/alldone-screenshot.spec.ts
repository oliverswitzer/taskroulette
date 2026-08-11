import { test } from '@playwright/test'
import { waitForBoundingBoxToSettle } from './helpers'

test('screenshot wheel explosion confetti', async ({ page }) => {
  // Start on TaskCard with 1 task left — checking it triggers the explosion
  await page.addInitScript(() => {
    const tasks = [{ id: '1', text: 'Final task — finish strong', completed: false }]
    localStorage.setItem('tr-tasks', JSON.stringify(tasks))
    localStorage.setItem('tr-app-state', 'TASK_CARD')
    localStorage.setItem('tr-selected-task-id', '1')
    localStorage.setItem('tr-wheel-angle', '0')
    localStorage.setItem('tr-completed-count', '4')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="task-card"]', { timeout: 8000 })
  // Wait for the task card's slide-in spring animation to settle (bounding
  // box stops moving) instead of a fixed sleep — this is a screenshot
  // capture script, but still benefits from not racing the animation.
  await waitForBoundingBoxToSettle(page.locator('[data-testid="task-card"]'), { axis: 'y' })

  // Click checkbox — explosion fires, screen starts transitioning
  await page.click('[data-testid="task-checkbox"]')

  // Capture during the burst — before AllDone screen fully renders
  await page.waitForTimeout(180)
  await page.screenshot({
    path: 'scripts/debug/output/wheel-explosion-burst.png',
    fullPage: false,
  })

  // Also capture the AllDone screen after the full transition
  await page.waitForSelector('[data-testid="all-done-screen"]', { timeout: 4000 })
  await page.waitForTimeout(700)
  await page.screenshot({
    path: 'scripts/debug/output/wheel-explosion-alldone.png',
    fullPage: false,
  })
})
