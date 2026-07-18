import { test } from '@playwright/test'
import path from 'node:path'

const OUT = path.resolve(process.cwd(), 'tests/e2e/screenshots')

async function seedAndShoot(page: any, tasks: string[], name: string) {
  await page.addInitScript((tasks: string[]) => {
    localStorage.setItem('tr-tasks', JSON.stringify(
      tasks.map((t, i) => ({ id: String(i), text: t, completed: false }))
    ))
    localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
  }, tasks)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 8000 })
  // brief settle
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}

test('wheel text — 3 tasks (lots of room)', async ({ page }) => {
  await seedAndShoot(page, [
    'Reply to Sarah about dinner plans',
    'Schedule dentist appointment',
    'Pay electricity bill this month',
  ], 'wheel-3tasks')
})

test('wheel text — 6 tasks (medium)', async ({ page }) => {
  await seedAndShoot(page, [
    'Buy groceries',
    'Call dentist office',
    'Fix the production bug',
    'Reply to Sarah',
    'Schedule team meeting',
    'Pay electricity',
  ], 'wheel-6tasks')
})

test('wheel text — 10 tasks (tight)', async ({ page }) => {
  await seedAndShoot(page, [
    'Buy groceries for the week',
    'Call dentist and book appointment',
    'Fix the nasty production bug',
    'Reply to Sarah about dinner',
    'Schedule team standup meeting',
    'Pay electricity bill online',
    'Review PR from Jordan',
    'Update project README',
    'Run weekly metrics report',
    'Clean up old branches',
  ], 'wheel-10tasks')
})
