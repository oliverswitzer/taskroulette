import { chromium } from '@playwright/test'
import path from 'path'

const OUT = path.resolve(process.cwd(), 'tests/e2e/screenshots')

async function shoot() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  // Screenshot 1: List edit screen with google button
  await page.addInitScript(() => {
    localStorage.setItem('tr-tasks', JSON.stringify([
      { id: '1', text: 'Review Q4 OKRs', position: 0, completed: false },
      { id: '2', text: 'Send invoices', position: 1, completed: false },
      { id: '3', text: 'Fix login bug', position: 2, completed: false },
    ]))
    localStorage.setItem('tr-app-state', 'LIST_EDIT')
  })
  await page.goto('https://clawlivers-mac-mini.tail60e2f.ts.net:5173', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="task-item"]', { timeout: 8000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/google-tasks-list-edit-btn.png` })
  console.log('✅ Screenshot 1: list edit with google button')

  // Screenshot 2: Google tasks sheet - idle state (click the button)
  await page.click('[data-testid="google-tasks-btn"]')
  await page.waitForTimeout(600) // let spring animation settle
  await page.screenshot({ path: `${OUT}/google-tasks-sheet-idle.png` })
  console.log('✅ Screenshot 2: google tasks sheet - idle/login state')

  // Screenshot 3: Sheet with mock tasks (click login → triggers mock mode since no OAuth configured)
  await page.click('[data-testid="google-login-btn"]')
  await page.waitForTimeout(1000) // wait for mock data to load
  await page.screenshot({ path: `${OUT}/google-tasks-sheet-loaded.png` })
  console.log('✅ Screenshot 3: google tasks sheet - loaded with mock tasks')

  // Screenshot 4: Sheet with tasks selected
  await page.click('[data-testid="google-task-row-m1"]')
  await page.click('[data-testid="google-task-row-m2"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/google-tasks-sheet-selected.png` })
  console.log('✅ Screenshot 4: google tasks sheet - 2 tasks selected')

  await browser.close()
}

shoot().catch(e => { console.error(e); process.exit(1) })
