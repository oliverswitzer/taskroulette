import { chromium } from '/Users/clawliver/workspace/taskroulette/node_modules/playwright/index.mjs'

const BASE_URL = 'http://localhost:5173'
const RESULTS = []

function pass(name, note = '') {
  RESULTS.push({ name, status: 'PASS', error: null })
  console.log(`✅ PASS: ${name}${note ? ' — ' + note : ''}`)
}

function fail(name, error, expected) {
  RESULTS.push({ name, status: 'FAIL', error: String(error), expected })
  console.log(`❌ FAIL: ${name}`)
  console.log(`   Error: ${error}`)
  if (expected) console.log(`   Expected: ${expected}`)
}

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

function makeTasks(n, prefix = 'Task') {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    text: `${prefix} ${i + 1}`,
    position: i,
    completed: false,
  }))
}

// ── A. 1-task: spin -> task card -> check -> ALL_DONE ────────────────────────
async function testA(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(1))
    await page.locator('button[aria-label="Spin the wheel"]').click()
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
    await page.locator('[data-testid="task-checkbox"]').click()

    // Wait for ALL_DONE screen — data-testid is "all-done-screen"
    await page.waitForSelector('[data-testid="all-done-screen"]', { timeout: 5000 })
    pass('A. 1-task wheel: spin -> task card -> check -> ALL_DONE immediately')
  } catch (e) {
    // Try alternate detection: check body text
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '')
    const lsState = await page.evaluate(() => localStorage.getItem('tr-app-state')).catch(() => '')
    if (bodyText.toLowerCase().includes('you finished') || lsState === 'ALL_DONE') {
      pass('A. 1-task wheel: spin -> task card -> check -> ALL_DONE immediately',
        `(localStorage state=${lsState}, text includes "you finished")`)
    } else {
      fail('A. 1-task wheel: spin -> task card -> check -> ALL_DONE immediately',
        `${e.message} | bodyText(first 200)="${bodyText.substring(0, 200)}" | lsState="${lsState}"`,
        'After completing the only task, ALL_DONE screen should appear')
    }
  } finally {
    await page.close()
  }
}

// ── B. 15-task wheel: all slices render, spin works ─────────────────────────
async function testB(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(15))

    const badgeText = await page.locator('span').filter({ hasText: '15/15 tasks' }).textContent({ timeout: 3000 })
    if (!badgeText.includes('15/15')) throw new Error(`Badge shows "${badgeText}", expected "15/15"`)

    const canvasCount = await page.locator('canvas').count()
    if (canvasCount === 0) throw new Error('No canvas element found')

    await page.locator('button[aria-label="Spin the wheel"]').click()
    await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, null, { timeout: 3000 })
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })

    pass('B. 15-task wheel: all slices render, spin works')
  } catch (e) {
    fail('B. 15-task wheel: all slices render, spin works', e.message,
      '15 tasks should render on wheel and spin should work')
  } finally {
    await page.close()
  }
}

// ── C. Counter-clockwise swipe BLOCKED ───────────────────────────────────────
async function testC(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const box = await page.locator('[data-testid="wheel-screen"]').boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    // LEFT swipe via pointer events (deltaX = -200, negative = should be blocked)
    await page.evaluate(({ cx, cy }) => {
      const el = document.querySelector('[data-testid="wheel-screen"]')
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx + 100, clientY: cy, bubbles: true }))
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: cx - 100, clientY: cy, bubbles: true }))
    }, { cx, cy })

    await page.waitForTimeout(500)

    const isSpinning = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    })

    if (isSpinning) throw new Error('Wheel started spinning after left swipe — should be blocked')
    pass('C. Counter-clockwise swipe BLOCKED')
  } catch (e) {
    fail('C. Counter-clockwise swipe BLOCKED', e.message,
      'Left swipe (deltaX < 0) must not trigger a spin')
  } finally {
    await page.close()
  }
}

// ── D. Double-spin blocked ───────────────────────────────────────────────────
async function testD(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))
    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    await spinBtn.click()
    await spinBtn.click()

    const isDisabled = await spinBtn.isDisabled()
    if (!isDisabled) throw new Error('Spin button not disabled after first spin')

    const btnText = await spinBtn.textContent()
    if (!btnText.includes('Spinning')) throw new Error(`Button text is "${btnText}", expected "Spinning…"`)

    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
    pass('D. Double-spin blocked (click spin twice rapidly, second ignored)')
  } catch (e) {
    fail('D. Double-spin blocked (click spin twice rapidly, second ignored)', e.message,
      'Second spin click should be ignored while spinning')
  } finally {
    await page.close()
  }
}

// ── E. Edit button hidden/disabled during spin ───────────────────────────────
async function testE(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')

    const styleBefore = await editBtn.evaluate(el => el.style.opacity)
    if (styleBefore === '0') throw new Error('Edit button starts hidden before spin')

    await page.locator('button[aria-label="Spin the wheel"]').click()
    await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, null, { timeout: 3000 })

    const style = await editBtn.evaluate(el => ({
      opacity: el.style.opacity,
      pointerEvents: el.style.pointerEvents,
    }))

    const hidden = style.opacity === '0' || style.pointerEvents === 'none'
    if (!hidden) throw new Error(`Edit button visible during spin: opacity="${style.opacity}", pointerEvents="${style.pointerEvents}"`)

    pass('E. Edit button hidden/disabled during spin')
  } catch (e) {
    fail('E. Edit button hidden/disabled during spin', e.message,
      'Edit button should have opacity:0 and pointerEvents:none while spinning')
  } finally {
    await page.close()
  }
}

// ── F. Task removed from wheel after completion (3 -> 2) ─────────────────────
async function testF(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))
    await page.locator('span').filter({ hasText: /3\/15 tasks/ }).waitFor({ timeout: 3000 })

    await page.locator('button[aria-label="Spin the wheel"]').click()
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
    await page.locator('[data-testid="task-checkbox"]').click()
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 5000 })

    await page.locator('span').filter({ hasText: /2\/15 tasks/ }).waitFor({ timeout: 3000 })
    pass('F. Task removed from wheel after completion (3 tasks -> complete 1 -> wheel shows 2)')
  } catch (e) {
    fail('F. Task removed from wheel after completion (3 tasks -> complete 1 -> wheel shows 2)', e.message,
      'After completing 1 of 3 tasks, wheel should show 2/15 tasks badge')
  } finally {
    await page.close()
  }
}

// ── G. Spin again auto-spins ─────────────────────────────────────────────────
async function testG(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    await page.locator('button[aria-label="Spin the wheel"]').click()
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })
    await page.locator('[data-testid="spin-again-btn"]').click()

    // Wheel screen should return
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 3000 })

    // Auto-spin should start
    const autoSpinStarted = await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, null, { timeout: 3000 }).catch(() => null)

    if (!autoSpinStarted) throw new Error('Wheel did not auto-spin after "spin again"')

    // Wait for it to resolve to task card
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 12000 })

    pass('G. Spin again auto-spins (verified)')
  } catch (e) {
    // Gather diagnostic info
    const diag = await page.evaluate(() => ({
      testids: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')),
      spinBtnText: (() => { const b = document.querySelector('[aria-label="Spin the wheel"]'); return b ? b.textContent : 'not found' })(),
      lsState: localStorage.getItem('tr-app-state'),
    })).catch(() => ({}))
    fail('G. Spin again auto-spins (verified)', 
      `${e.message} | diag: ${JSON.stringify(diag)}`,
      'Clicking "spin again" should auto-spin the wheel and resolve to a new task card')
  } finally {
    await page.close()
  }
}

// ── H. Edit modal: add task -> reflects on wheel ─────────────────────────────
async function testH(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(2))
    await page.locator('[data-testid="edit-tasks-btn"]').click()

    const modal = page.locator('[data-testid="edit-modal"]')
    await modal.waitFor({ timeout: 3000 })

    await modal.locator('button', { hasText: '+ Add task' }).click()

    const input = modal.locator('input[type="text"],textarea').first()
    await input.fill('New Test Task H')

    // Find the submit button (Add task)
    await modal.locator('button', { hasText: /^Add task$/i }).click()

    // Close modal
    await modal.locator('button', { hasText: 'Done' }).click()

    await page.waitForFunction(() => document.body.innerText.includes('3/15'), null, { timeout: 3000 })
    pass('H. Edit modal: add task -> reflects on wheel')
  } catch (e) {
    fail('H. Edit modal: add task -> reflects on wheel', e.message,
      'Adding a task via edit modal should update wheel badge from 2/15 to 3/15')
  } finally {
    await page.close()
  }
}

// ── I. localStorage restore: tasks persist after reload ──────────────────────
async function testI(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(4))
    await page.waitForFunction(() => document.body.innerText.includes('4/15'), null, { timeout: 3000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.waitForFunction(() => document.body.innerText.includes('4/15'), null, { timeout: 5000 })
    pass('I. localStorage restore: tasks persist after page.reload()')
  } catch (e) {
    fail('I. localStorage restore: tasks persist after page.reload()', e.message,
      'After reload, 4 tasks should be restored from localStorage showing 4/15')
  } finally {
    await page.close()
  }
}

// ── J. 15-task cap: add button hidden at 15 ──────────────────────────────────
async function testJ(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(15))
    await page.locator('[data-testid="edit-tasks-btn"]').click()

    const modal = page.locator('[data-testid="edit-modal"]')
    await modal.waitFor({ timeout: 3000 })

    await modal.locator('span').filter({ hasText: '15/15' }).waitFor({ timeout: 3000 })

    const addVisible = await modal.locator('button', { hasText: '+ Add task' }).isVisible().catch(() => false)
    if (addVisible) throw new Error('Add task button still visible at 15/15 cap')

    pass('J. 15-task cap in edit modal: add button disabled at 15')
  } catch (e) {
    fail('J. 15-task cap in edit modal: add button disabled at 15', e.message,
      'When 15 tasks exist, "+ Add task" button should not be visible')
  } finally {
    await page.close()
  }
}

// ── EXTRA: Spin button height >= 60px ────────────────────────────────────────
async function testSpinHeight(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))
    const box = await page.locator('button[aria-label="Spin the wheel"]').boundingBox()
    if (!box) throw new Error('Cannot get bounding box')
    if (box.height < 60) throw new Error(`Height is ${box.height}px, need >= 60px`)
    pass(`Spin button height >= 60px (actual: ${Math.round(box.height)}px)`)
  } catch (e) {
    fail('Spin button height >= 60px', e.message, 'Spin button must be at least 60px tall')
  } finally {
    await page.close()
  }
}

// ── EXTRA: Edit button data-testid + visible ─────────────────────────────────
async function testEditBtnPresence(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
    const isVisible = await editBtn.isVisible()
    if (!isVisible) throw new Error('Not visible')
    const tag = await editBtn.evaluate(el => el.tagName.toLowerCase())
    if (tag !== 'button') throw new Error(`Expected button, got ${tag}`)
    pass('Edit button has data-testid="edit-tasks-btn" and is visible')
  } catch (e) {
    fail('Edit button has data-testid="edit-tasks-btn" and is visible', e.message,
      'data-testid="edit-tasks-btn" button must be visible on wheel screen')
  } finally {
    await page.close()
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Launching Playwright...\n')
  const browser = await chromium.launch({ headless: true })
  try {
    await testA(browser)
    await testB(browser)
    await testC(browser)
    await testD(browser)
    await testE(browser)
    await testF(browser)
    await testG(browser)
    await testH(browser)
    await testI(browser)
    await testJ(browser)
    await testSpinHeight(browser)
    await testEditBtnPresence(browser)
  } finally {
    await browser.close()
  }

  console.log('\n' + '═'.repeat(80))
  console.log('RESULTS SUMMARY')
  console.log('═'.repeat(80))
  const colW = 56
  console.log(`${'Test'.padEnd(colW)} Status`)
  console.log('─'.repeat(80))
  for (const r of RESULTS) {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'
    console.log(`${r.name.padEnd(colW)} ${icon}`)
    if (r.status === 'FAIL') {
      console.log(`  └─ Error: ${r.error}`)
      if (r.expected) console.log(`  └─ Expected: ${r.expected}`)
    }
  }
  console.log('═'.repeat(80))
  const p = RESULTS.filter(r => r.status === 'PASS').length
  const f = RESULTS.filter(r => r.status === 'FAIL').length
  console.log(`\nTotal: ${p} passed, ${f} failed out of ${RESULTS.length}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
