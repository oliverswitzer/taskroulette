import { chromium } from '/Users/clawliver/workspace/taskroulette/node_modules/playwright/index.mjs'

const BASE_URL = 'http://localhost:5173'
const RESULTS = []

function pass(name) {
  RESULTS.push({ name, status: 'PASS', error: null })
  console.log(`✅ PASS: ${name}`)
}

function fail(name, error, expected) {
  RESULTS.push({ name, status: 'FAIL', error: String(error), expected })
  console.log(`❌ FAIL: ${name}`)
  console.log(`   Error: ${error}`)
  if (expected) console.log(`   Expected: ${expected}`)
}

// Helper: set up tasks + state via window helpers
async function setupWheelState(page, tasks, state = 'WHEEL_IDLE') {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__setAppState === 'function')

  await page.evaluate(({ tasks, state }) => {
    window.__setTasks(tasks)
    window.__setAppState(state)
  }, { tasks, state })

  // Wait for wheel screen to be visible
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

// ──────────────────────────────────────────────────────────────
// A. 1-task wheel: spin -> task card -> check -> ALL_DONE
// ──────────────────────────────────────────────────────────────
async function testA(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(1))

    // Click spin
    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    await spinBtn.click()

    // Wait for task card (spin finishes)
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    // Click the checkbox
    const checkbox = page.locator('[data-testid="task-checkbox"]')
    await checkbox.click()

    // Wait for ALL_DONE screen
    await page.waitForFunction(() => {
      const h = document.querySelector('h1,h2,h3,[data-testid="all-done"]')
      if (h && h.textContent.includes('All Done')) return true
      // also check for "all done" text anywhere
      return document.body.innerText.toLowerCase().includes('all done') ||
             document.body.innerText.toLowerCase().includes('you finished')
    }, { timeout: 5000 })

    pass('A. 1-task: spin -> task card -> check -> ALL_DONE')
  } catch (e) {
    fail('A. 1-task: spin -> task card -> check -> ALL_DONE', e.message,
      'After completing the only task, ALL_DONE screen should appear')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// B. 15-task wheel: all slices render, spin works
// ──────────────────────────────────────────────────────────────
async function testB(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(15))

    // Check badge says 15/15
    const badge = page.locator('span').filter({ hasText: '15/15 tasks' })
    const badgeText = await badge.textContent({ timeout: 3000 })
    if (!badgeText.includes('15/15')) throw new Error(`Badge shows "${badgeText}", expected "15/15"`)

    // Verify canvas element exists (wheel rendered)
    const canvas = page.locator('canvas')
    const canvasCount = await canvas.count()
    if (canvasCount === 0) throw new Error('No canvas element found for wheel')

    // Click spin and verify spinning state
    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    await spinBtn.click()
    await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, { timeout: 3000 })

    // Wait for task card to appear (spin completes)
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    pass('B. 15-task wheel: all slices render, spin works')
  } catch (e) {
    fail('B. 15-task wheel: all slices render, spin works', e.message,
      '15 tasks should render on wheel and spin should work')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// C. Counter-clockwise swipe BLOCKED (left swipe must NOT spin)
// ──────────────────────────────────────────────────────────────
async function testC(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const wheelScreen = page.locator('[data-testid="wheel-screen"]')
    const box = await wheelScreen.boundingBox()
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    // Simulate LEFT swipe (counter-clockwise): startX > endX
    await page.mouse.move(cx + 100, cy)
    await page.mouse.down()
    await page.mouse.move(cx - 100, cy, { steps: 10 })
    await page.mouse.up()

    // Also try via pointer events (matching app's onPointerDown/Up)
    await page.evaluate(({ cx, cy }) => {
      const el = document.querySelector('[data-testid="wheel-screen"]')
      const downEvt = new PointerEvent('pointerdown', { clientX: cx + 100, clientY: cy, bubbles: true })
      el.dispatchEvent(downEvt)
      const upEvt = new PointerEvent('pointerup', { clientX: cx - 100, clientY: cy, bubbles: true })
      el.dispatchEvent(upEvt)
    }, { cx, cy })

    // Wait a short bit and verify NOT spinning
    await page.waitForTimeout(500)

    const isSpinning = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    })

    if (isSpinning) throw new Error('Wheel started spinning after left swipe — should be blocked')

    pass('C. Counter-clockwise swipe BLOCKED')
  } catch (e) {
    fail('C. Counter-clockwise swipe BLOCKED', e.message,
      'Left swipe (deltaX < 0) should not trigger spin')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// D. Double-spin blocked (second click ignored)
// ──────────────────────────────────────────────────────────────
async function testD(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')

    // Click twice very rapidly
    await spinBtn.click()
    await spinBtn.click() // second click should be ignored

    // Verify button is now disabled
    const isDisabled = await spinBtn.isDisabled()
    if (!isDisabled) throw new Error('Spin button not disabled after first spin')

    // Verify it says "Spinning…"
    const btnText = await spinBtn.textContent()
    if (!btnText.includes('Spinning')) throw new Error(`Button text is "${btnText}", expected "Spinning…"`)

    // Wait for task card — only one spin should have happened
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    pass('D. Double-spin blocked (second click ignored)')
  } catch (e) {
    fail('D. Double-spin blocked (second click ignored)', e.message,
      'Second spin click should be ignored while spinning')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// E. Edit button hidden/disabled during spin
// ──────────────────────────────────────────────────────────────
async function testE(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')

    // Before spin: edit button should be visible
    const opacityBefore = await editBtn.evaluate(el => el.style.opacity)
    if (opacityBefore === '0') throw new Error('Edit button starts hidden (opacity=0) before spin')

    // Start spinning
    await spinBtn.click()
    await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, { timeout: 3000 })

    // During spin: check edit button
    const editStyle = await editBtn.evaluate(el => ({
      opacity: el.style.opacity,
      pointerEvents: el.style.pointerEvents,
    }))

    const isEffectivelyHidden = editStyle.opacity === '0' || editStyle.pointerEvents === 'none'
    if (!isEffectivelyHidden) {
      throw new Error(`Edit button not hidden during spin: opacity="${editStyle.opacity}", pointerEvents="${editStyle.pointerEvents}"`)
    }

    pass('E. Edit button hidden/disabled during spin')
  } catch (e) {
    fail('E. Edit button hidden/disabled during spin', e.message,
      'Edit button should have opacity:0 and pointerEvents:none while spinning')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// F. Task removed from wheel after completion (3 tasks -> complete 1 -> wheel shows 2)
// ──────────────────────────────────────────────────────────────
async function testF(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    // Verify badge shows 3/15
    const badgeBefore = page.locator('span').filter({ hasText: /3\/15 tasks/ })
    await badgeBefore.waitFor({ timeout: 3000 })

    // Spin
    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    await spinBtn.click()

    // Wait for task card
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    // Complete the task
    const checkbox = page.locator('[data-testid="task-checkbox"]')
    await checkbox.click()

    // Wait to return to wheel screen
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 5000 })

    // Check badge now shows 2/15
    const badgeAfter = page.locator('span').filter({ hasText: /2\/15 tasks/ })
    await badgeAfter.waitFor({ timeout: 3000 })

    pass('F. Task removed from wheel after completion (3->2)')
  } catch (e) {
    fail('F. Task removed from wheel after completion (3->2)', e.message,
      'After completing 1 of 3 tasks, wheel should show 2/15 tasks badge')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// G. Spin again auto-spins
// ──────────────────────────────────────────────────────────────
async function testG(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    // Spin
    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    await spinBtn.click()

    // Wait for task card
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    // Click "spin again" (skip)
    const spinAgainBtn = page.locator('[data-testid="spin-again-btn"]')
    await spinAgainBtn.click()

    // Should auto-spin: wheel-screen appears and immediately starts spinning
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 3000 })

    // Check it auto-spins (spinning state)
    const isSpinning = await page.waitForFunction(() => {
      const btn = document.querySelector('[aria-label="Spin the wheel"]')
      return btn && btn.textContent.includes('Spinning')
    }, { timeout: 3000 }).catch(() => null)

    if (!isSpinning) throw new Error('Wheel did not auto-spin after "spin again"')

    // Wait for it to eventually land on another task card
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 10000 })

    pass('G. Spin again auto-spins')
  } catch (e) {
    fail('G. Spin again auto-spins', e.message,
      'Clicking "spin again" should auto-trigger a new spin immediately')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// H. Edit modal: add task -> reflects on wheel
// ──────────────────────────────────────────────────────────────
async function testH(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(2))

    // Open edit modal
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
    await editBtn.click()

    // Wait for modal
    const modal = page.locator('[data-testid="edit-modal"]')
    await modal.waitFor({ timeout: 3000 })

    // Click "+ Add task"
    const addBtn = modal.locator('button', { hasText: '+ Add task' })
    await addBtn.click()

    // Fill in task text
    const input = modal.locator('input[type="text"],textarea').first()
    await input.fill('New Test Task H')

    // Submit
    const submitBtn = modal.locator('button[type="submit"], button', { hasText: /add task/i }).last()
    await submitBtn.click()

    // Close modal (click Done)
    const doneBtn = modal.locator('button', { hasText: 'Done' })
    await doneBtn.click()

    // Verify badge now shows 3/15
    await page.waitForFunction(() => {
      return document.body.innerText.includes('3/15')
    }, { timeout: 3000 })

    pass('H. Edit modal: add task -> reflects on wheel')
  } catch (e) {
    fail('H. Edit modal: add task -> reflects on wheel', e.message,
      'Adding a task via edit modal should update wheel badge from 2/15 to 3/15')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// I. localStorage restore: tasks persist after page.reload()
// ──────────────────────────────────────────────────────────────
async function testI(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(4))

    // Verify 4 tasks showing
    await page.waitForFunction(() => document.body.innerText.includes('4/15'), { timeout: 3000 })

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // After reload, tasks should be restored from localStorage
    // The app should restore to WHEEL_IDLE with 4 tasks
    await page.waitForFunction(() => document.body.innerText.includes('4/15'), { timeout: 5000 })

    pass('I. localStorage restore: tasks persist after reload')
  } catch (e) {
    fail('I. localStorage restore: tasks persist after reload', e.message,
      'After page reload, tasks should be restored from localStorage showing 4/15')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// J. 15-task cap in edit modal: add button disabled at 15
// ──────────────────────────────────────────────────────────────
async function testJ(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(15))

    // Open edit modal
    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
    await editBtn.click()

    const modal = page.locator('[data-testid="edit-modal"]')
    await modal.waitFor({ timeout: 3000 })

    // Verify the count badge shows 15/15
    const countBadge = modal.locator('span').filter({ hasText: '15/15' })
    await countBadge.waitFor({ timeout: 3000 })

    // The "+ Add task" button should NOT be visible (canAddMore is false -> button not rendered)
    const addBtn = modal.locator('button', { hasText: '+ Add task' })
    const addBtnVisible = await addBtn.isVisible().catch(() => false)

    if (addBtnVisible) throw new Error('Add task button still visible at 15/15 cap')

    pass('J. 15-task cap: add button hidden at 15')
  } catch (e) {
    fail('J. 15-task cap: add button hidden at 15', e.message,
      'When 15 tasks exist, "+ Add task" button should not be visible in edit modal')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// EXTRA: Spin button height >= 60px
// ──────────────────────────────────────────────────────────────
async function testSpinButtonHeight(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const spinBtn = page.locator('button[aria-label="Spin the wheel"]')
    const box = await spinBtn.boundingBox()
    if (!box) throw new Error('Could not get bounding box of spin button')
    if (box.height < 60) throw new Error(`Spin button height is ${box.height}px, expected >= 60px`)

    pass(`Spin button height >= 60px (actual: ${box.height}px)`)
  } catch (e) {
    fail('Spin button height >= 60px', e.message, 'Spin button must be at least 60px tall')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// EXTRA: Edit button has data-testid='edit-tasks-btn' and is visible
// ──────────────────────────────────────────────────────────────
async function testEditButtonPresence(browser) {
  const page = await browser.newPage()
  try {
    await setupWheelState(page, makeTasks(3))

    const editBtn = page.locator('[data-testid="edit-tasks-btn"]')
    const isVisible = await editBtn.isVisible()
    if (!isVisible) throw new Error('Edit button with data-testid="edit-tasks-btn" is not visible')

    const tagName = await editBtn.evaluate(el => el.tagName.toLowerCase())
    if (tagName !== 'button') throw new Error(`Expected button, got ${tagName}`)

    pass('Edit button has data-testid="edit-tasks-btn" and is visible')
  } catch (e) {
    fail('Edit button has data-testid="edit-tasks-btn" and is visible', e.message,
      'Edit button with correct data-testid must be present and visible on wheel screen')
  } finally {
    await page.close()
  }
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
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
    await testSpinButtonHeight(browser)
    await testEditButtonPresence(browser)
  } finally {
    await browser.close()
  }

  // Print results table
  console.log('\n' + '='.repeat(80))
  console.log('RESULTS SUMMARY')
  console.log('='.repeat(80))
  console.log(`${'Test'.padEnd(55)} ${'Status'.padEnd(8)}`)
  console.log('-'.repeat(80))
  for (const r of RESULTS) {
    const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'
    console.log(`${r.name.padEnd(55)} ${status}`)
    if (r.status === 'FAIL') {
      console.log(`  └─ Error: ${r.error}`)
      if (r.expected) console.log(`  └─ Expected: ${r.expected}`)
    }
  }
  console.log('='.repeat(80))

  const passed = RESULTS.filter(r => r.status === 'PASS').length
  const failed = RESULTS.filter(r => r.status === 'FAIL').length
  console.log(`\nTotal: ${passed} passed, ${failed} failed`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
