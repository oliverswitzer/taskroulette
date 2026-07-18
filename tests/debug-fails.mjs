import { chromium } from '/Users/clawliver/workspace/taskroulette/node_modules/playwright/index.mjs'

const BASE_URL = 'http://localhost:5173'

async function setupWheelState(page, tasks, state = 'WHEEL_IDLE') {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__setAppState === 'function')
  await page.evaluate(({ tasks, state }) => {
    window.__setTasks(tasks)
    window.__setAppState(state)
  }, { tasks, state })
  await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 3000 })
}

function makeTasks(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    text: `Task ${i + 1}`,
    position: i,
    completed: false,
  }))
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // ── Debug A ────────────────────────────────────────────────
  console.log('\n=== DEBUG: Test A (1-task, ALL_DONE) ===')
  const pageA = await browser.newPage()
  pageA.on('console', msg => console.log('[browser]', msg.text()))

  await setupWheelState(pageA, makeTasks(1))

  const spinBtn = pageA.locator('button[aria-label="Spin the wheel"]')
  await spinBtn.click()
  console.log('Spin clicked')

  // Wait for task card
  await pageA.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
  console.log('Task card appeared')

  // Get current page state
  const bodyText1 = await pageA.evaluate(() => document.body.innerText)
  console.log('Page text before check:', bodyText1.substring(0, 200))

  const appState1 = await pageA.evaluate(() => localStorage.getItem('tr-app-state'))
  console.log('App state in localStorage:', appState1)

  // Click checkbox
  const checkbox = pageA.locator('[data-testid="task-checkbox"]')
  await checkbox.click()
  console.log('Checkbox clicked')

  // Wait a moment
  await pageA.waitForTimeout(1500)

  // Get state after
  const bodyText2 = await pageA.evaluate(() => document.body.innerText)
  console.log('Page text after check (first 500):', bodyText2.substring(0, 500))

  const appState2 = await pageA.evaluate(() => localStorage.getItem('tr-app-state'))
  console.log('App state after check:', appState2)

  // Check what screens are visible
  const taskCard = await pageA.$('[data-testid="task-card"]')
  const wheelScreen = await pageA.$('[data-testid="wheel-screen"]')
  const allDoneTest = await pageA.evaluate(() => {
    return {
      hasAllDone: !!document.querySelector('[data-testid="all-done"]'),
      bodyText: document.body.innerText.substring(0, 300),
      allElements: Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid'))
    }
  })
  console.log('After check state:', JSON.stringify(allDoneTest, null, 2))

  await pageA.close()

  // ── Debug G ────────────────────────────────────────────────
  console.log('\n=== DEBUG: Test G (spin again auto-spins) ===')
  const pageG = await browser.newPage()
  pageG.on('console', msg => console.log('[browser]', msg.text()))

  await setupWheelState(pageG, makeTasks(3))

  const spinBtnG = pageG.locator('button[aria-label="Spin the wheel"]')
  await spinBtnG.click()
  console.log('Spin clicked')

  await pageG.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
  console.log('Task card appeared')

  const spinAgainBtn = pageG.locator('[data-testid="spin-again-btn"]')
  await spinAgainBtn.click()
  console.log('Spin again clicked')

  // Wait for wheel screen to return
  await pageG.waitForSelector('[data-testid="wheel-screen"]', { timeout: 3000 })
  console.log('Wheel screen returned')

  // Check if spinning
  await pageG.waitForTimeout(300)
  const spinningState = await pageG.evaluate(() => {
    const btn = document.querySelector('[aria-label="Spin the wheel"]')
    return {
      text: btn ? btn.textContent : 'not found',
      disabled: btn ? btn.disabled : null,
    }
  })
  console.log('Spin button state after spin-again:', spinningState)

  // Wait longer and check for task card
  const taskCardG = await pageG.waitForSelector('[data-testid="task-card"]', { timeout: 15000 }).catch(e => {
    console.log('Task card never appeared after spin-again:', e.message)
    return null
  })

  if (taskCardG) {
    console.log('Task card appeared after spin-again ✅')
  } else {
    // what's on screen now?
    const body = await pageG.evaluate(() => ({
      testids: Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid')),
      spinBtn: (() => {
        const b = document.querySelector('[aria-label="Spin the wheel"]')
        return b ? { text: b.textContent, disabled: b.disabled } : null
      })()
    }))
    console.log('State after timeout:', JSON.stringify(body, null, 2))
  }

  await pageG.close()
  await browser.close()
}

main().catch(console.error)
