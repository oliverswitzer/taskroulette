/**
 * Edge Case Tests for TaskRoulette
 * Run with: node tests/e2e/edge-cases.mjs
 */
import { chromium } from '/Users/clawliver/workspace/taskroulette/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = 'tests/e2e/screenshots'

let passed = 0
let failed = 0
const failures = []

function log(testId, label, result, detail = '') {
  if (result === 'PASS') {
    console.log(`✅ [${testId}] PASS: ${label}`)
    passed++
  } else {
    console.log(`❌ [${testId}] FAIL: ${label} — ${detail}`)
    failed++
    failures.push({ testId, label, detail })
  }
}

async function goToWheel(page, tasks) {
  await page.goto(BASE_URL)
  await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 10000 })
  await page.evaluate((texts) => {
    const taskObjs = texts.map((text, i) => ({
      id: String(i + 1),
      text,
      position: i,
      completed: false,
    }))
    window.__setTasks(taskObjs)
    window.__setAppState('WHEEL_IDLE')
  }, tasks)
  await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 5000 })
}

async function waitForSpin(page, timeout = 8000) {
  // Wait for task-card to appear after spin
  await page.waitForSelector('[data-testid="task-card"]', { timeout })
}

async function run() {
  await mkdir(SCREENSHOT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  // ── Test A: Wheel with 1 task ─────────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Single task'])
      // Spin
      await page.click('button[aria-label="Spin the wheel"]')
      // Wait for task card
      await waitForSpin(page)
      const taskCardVisible = await page.isVisible('[data-testid="task-card"]')
      log('A1', '1-task: spin shows task card', taskCardVisible ? 'PASS' : 'FAIL', 'task card not visible')

      // Check off
      await page.click('[data-testid="task-checkbox"]')
      // After last task, should show all-done screen
      await page.waitForSelector('[data-testid="all-done-screen"]', { timeout: 5000 })
      const allDoneVisible = await page.isVisible('[data-testid="all-done-screen"]')
      log('A2', '1-task: check → all-done immediately', allDoneVisible ? 'PASS' : 'FAIL', 'all-done screen not visible')

      // Verify no wheel with 0 tasks
      const wheelVisible = await page.isVisible('[data-testid="wheel-screen"]')
      log('A3', '1-task: no wheel after last task checked', !wheelVisible ? 'PASS' : 'FAIL', 'wheel appeared after last task')
    } catch (e) {
      log('A', '1-task complete flow', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-A.png` })
    }
    await page.close()
  }

  // ── Test B: Wheel with 15 tasks ────────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      const tasks15 = Array.from({ length: 15 }, (_, i) => `Task ${i + 1}`)
      await goToWheel(page, tasks15)
      const canvasEl = await page.$('canvas')
      log('B1', '15-task: canvas renders', canvasEl ? 'PASS' : 'FAIL', 'canvas missing')

      // Spin button should work
      const spinBtn = await page.$('button[aria-label="Spin the wheel"]')
      const isEnabled = await spinBtn.isEnabled()
      log('B2', '15-task: spin button enabled', isEnabled ? 'PASS' : 'FAIL', 'spin button disabled')

      // Click spin
      await page.click('button[aria-label="Spin the wheel"]')
      // Spin button should be disabled immediately
      await page.waitForFunction(() => {
        const btn = document.querySelector('button[aria-label="Spin the wheel"]')
        return btn && btn.disabled
      }, { timeout: 2000 })
      log('B3', '15-task: spin triggered and disabled', 'PASS')
      await page.screenshot({ path: `${SCREENSHOT_DIR}/wheel-idle-15tasks-debug.png` })
    } catch (e) {
      log('B', '15-task wheel', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-B.png` })
    }
    await page.close()
  }

  // ── Test C: Counter-clockwise swipe blocked ───────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task 1', 'Task 2', 'Task 3'])
      // Simulate a left (counter-clockwise) swipe
      const wheelEl = await page.$('[data-testid="wheel-screen"]')
      const box = await wheelEl.boundingBox()
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2

      // Pointer events: left swipe (deltaX < 0)
      await page.mouse.move(cx + 100, cy)
      await page.mouse.down()
      await page.mouse.move(cx - 100, cy, { steps: 10 }) // leftward
      await page.mouse.up()

      // Wait a bit to see if spin triggered
      await page.waitForTimeout(500)
      const spinBtn = await page.$('button[aria-label="Spin the wheel"]')
      const spinText = await spinBtn.textContent()
      const isSpinning = spinText?.includes('Spinning')
      log('C', 'Counter-clockwise swipe blocked', !isSpinning ? 'PASS' : 'FAIL', 'wheel spun on left swipe')
    } catch (e) {
      log('C', 'Counter-clockwise swipe blocked', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-C.png` })
    }
    await page.close()
  }

  // ── Test D: Double-spin blocked ───────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task 1', 'Task 2', 'Task 3'])
      // Click spin once
      await page.click('button[aria-label="Spin the wheel"]')
      // Immediately click again - should be ignored (button disabled)
      const spinBtn = await page.$('button[aria-label="Spin the wheel"]')
      const isDisabled = await spinBtn.isDisabled()
      log('D', 'Double-spin blocked (button disabled after first click)', isDisabled ? 'PASS' : 'FAIL', 'button still enabled after spin start')
    } catch (e) {
      log('D', 'Double-spin blocked', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-D.png` })
    }
    await page.close()
  }

  // ── Test E: Edit modal during spin blocked ────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task 1', 'Task 2', 'Task 3'])
      // Start spin
      await page.click('button[aria-label="Spin the wheel"]')
      // Wait for spin to fully register (spin button disabled confirms isSpinning=true)
      await page.waitForFunction(() => {
        const btn = document.querySelector('button[aria-label="Spin the wheel"]')
        return btn && btn.disabled
      }, { timeout: 2000 })
      // Now check edit button opacity (transition should be ~complete at 300ms extra)
      await page.waitForTimeout(300)
      const editBtn = await page.$('[data-testid="edit-tasks-btn"]')
      // Check that edit button has opacity 0 and pointerEvents none
      const editProps = editBtn ? await editBtn.evaluate(el => {
        const cs = getComputedStyle(el)
        return { opacity: cs.opacity, pointerEvents: cs.pointerEvents }
      }) : null
      const editHidden = editProps && (parseFloat(editProps.opacity) < 0.1 || editProps.pointerEvents === 'none')
      log('E', 'Edit button hidden during spin (opacity=0, pointerEvents=none)', editHidden ? 'PASS' : 'FAIL', `opacity: ${editProps?.opacity}, pointerEvents: ${editProps?.pointerEvents}`)
    } catch (e) {
      log('E', 'Edit modal during spin blocked', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-E.png` })
    }
    await page.close()
  }

  // ── Test F: Task removed from wheel after completion ─────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task Alpha', 'Task Beta', 'Task Gamma'])
      await page.click('button[aria-label="Spin the wheel"]')
      await waitForSpin(page)
      // Complete the task
      await page.click('[data-testid="task-checkbox"]')
      // Back to wheel
      await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 5000 })
      // Check badge shows 2/15
      const badgeText = await page.textContent('[data-testid="wheel-screen"] span:first-child')
      const showsTwo = badgeText?.includes('2/')
      log('F1', 'Task removed: badge shows 2/15 tasks', showsTwo ? 'PASS' : 'FAIL', `badge: ${badgeText}`)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/wheel-after-complete-2tasks.png` })
    } catch (e) {
      log('F', 'Task removed from wheel', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-F.png` })
    }
    await page.close()
  }

  // ── Test G: Skip auto-spins ───────────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task 1', 'Task 2', 'Task 3'])
      await page.click('button[aria-label="Spin the wheel"]')
      await waitForSpin(page)
      // Click skip/spin again
      await page.click('[data-testid="spin-again-btn"]')
      // Should return to wheel screen
      await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 3000 })
      // Within 1000ms, wheel should be spinning (spin button disabled)
      const isSpinning = await page.waitForFunction(
        () => {
          const btn = document.querySelector('button[aria-label="Spin the wheel"]')
          return btn && btn.disabled
        },
        { timeout: 4000 }
      ).then(() => true).catch(() => false)
      log('G', 'Skip auto-spins immediately', isSpinning ? 'PASS' : 'FAIL', 'wheel did not auto-spin after skip')
    } catch (e) {
      log('G', 'Skip auto-spins', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-G.png` })
    }
    await page.close()
  }

  // ── Test H: Edit modal adds task to wheel ────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await goToWheel(page, ['Task 1', 'Task 2'])
      // Open edit modal
      await page.click('[data-testid="edit-tasks-btn"]')
      await page.waitForSelector('[data-testid="edit-modal"]', { timeout: 2000 })
      // Click "+ Add task"
      const addBtn = await page.$('[data-testid="edit-modal"] button:has-text("+ Add task")')
      if (!addBtn) throw new Error('Add task button not found in modal')
      await addBtn.click()
      // Fill in new task
      const input = await page.$('[data-testid="edit-modal"] input, [data-testid="edit-modal"] textarea')
      if (!input) throw new Error('Input not found in modal')
      await input.fill('New Task Three')
      // Submit
      const submitBtn = await page.$('[data-testid="edit-modal"] button:has-text("Add task")')
      if (!submitBtn) throw new Error('Submit button not found')
      await submitBtn.click()
      // Close modal
      const doneBtn = await page.$('[data-testid="edit-modal"] button:has-text("Done")')
      await doneBtn.click()
      await page.waitForFunction(() => !document.querySelector('[data-testid="edit-modal"]'), { timeout: 2000 })
      // Check badge shows 3/15
      const badgeText = await page.textContent('[data-testid="wheel-screen"] span:first-child')
      const showsThree = badgeText?.includes('3/')
      log('H', 'Edit modal: add task reflects on wheel (badge 3/15)', showsThree ? 'PASS' : 'FAIL', `badge: ${badgeText}`)
    } catch (e) {
      log('H', 'Edit modal adds task to wheel', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-H.png` })
    }
    await page.close()
  }

  // ── Test I: localStorage restore ─────────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      await page.goto(BASE_URL)
      await page.waitForFunction(() => typeof window.__setAppState !== 'undefined', { timeout: 10000 })
      // Set state and save to localStorage
      await page.evaluate(() => {
        const tasks = [
          { id: '1', text: 'Persist me A', position: 0, completed: false },
          { id: '2', text: 'Persist me B', position: 1, completed: false },
          { id: '3', text: 'Persist me C', position: 2, completed: false },
        ]
        window.__setTasks(tasks)
        window.__setAppState('WHEEL_IDLE')
        localStorage.setItem('tr-tasks', JSON.stringify(tasks))
        localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
      })
      // Reload
      await page.reload()
      await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 5000 })
      const badgeText = await page.textContent('[data-testid="wheel-screen"] span:first-child')
      const persisted = badgeText?.includes('3/')
      log('I', 'localStorage: wheel restores with same tasks after reload', persisted ? 'PASS' : 'FAIL', `badge: ${badgeText}`)
    } catch (e) {
      log('I', 'localStorage restore', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-I.png` })
    }
    await page.close()
  }

  // ── Test J: 15-task cap in edit modal ────────────────────────────────────
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 390, height: 844 })
    try {
      const tasks14 = Array.from({ length: 14 }, (_, i) => `Task ${i + 1}`)
      await goToWheel(page, tasks14)
      // Open edit modal
      await page.click('[data-testid="edit-tasks-btn"]')
      await page.waitForSelector('[data-testid="edit-modal"]', { timeout: 2000 })
      // Verify badge shows 14/15
      const badge14 = await page.textContent('[data-testid="edit-modal"] span:last-child')
      log('J1', '15-cap: modal shows 14/15', badge14?.includes('14/15') ? 'PASS' : 'FAIL', `badge: ${badge14}`)
      // Add one more task
      const addBtn = await page.$('[data-testid="edit-modal"] button:has-text("+ Add task")')
      if (!addBtn) throw new Error('Add button not found at 14 tasks')
      await addBtn.click()
      const input = await page.$('[data-testid="edit-modal"] input, [data-testid="edit-modal"] textarea')
      await input.fill('The 15th task')
      const submitBtn = await page.$('[data-testid="edit-modal"] button:has-text("Add task")')
      await submitBtn.click()
      // Now at 15 - add button should be gone/hidden
      await page.waitForTimeout(300)
      const addBtnAfter = await page.$('[data-testid="edit-modal"] button:has-text("+ Add task")')
      const addGone = !addBtnAfter || !(await addBtnAfter.isVisible())
      log('J2', '15-cap: add button disappears at 15 tasks', addGone ? 'PASS' : 'FAIL', 'add button still visible at 15')
      // Badge shows 15/15
      const badge15 = await page.textContent('[data-testid="edit-modal"] span:last-child')
      log('J3', '15-cap: modal shows 15/15', badge15?.includes('15/15') ? 'PASS' : 'FAIL', `badge: ${badge15}`)
    } catch (e) {
      log('J', '15-task cap in edit modal', 'FAIL', e.message)
      await page.screenshot({ path: `${SCREENSHOT_DIR}/fail-J.png` })
    }
    await page.close()
  }

  await browser.close()

  console.log('\n──────────────────────────────────')
  console.log(`Results: ${passed} PASS, ${failed} FAIL`)
  if (failures.length > 0) {
    console.log('\nFailed tests:')
    failures.forEach(f => console.log(`  • [${f.testId}] ${f.label}: ${f.detail}`))
  }
  console.log('──────────────────────────────────')
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
