/**
 * audio-diagnostic.spec.ts
 * Logs every AudioBufferSourceNode.start() call to detect spurious ticks.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test('audio tick diagnostic — idle + spin + post-spin', async ({ page }) => {
  // Inject instrumentation before any page JS runs
  await page.addInitScript(() => {
    ;(window as any).__tickLog = []
    ;(window as any).__currentPhase = 'init'
    ;(window as any).__acState = 'none'

    // Intercept AudioContext creation
    const OrigAC = window.AudioContext
    window.AudioContext = function (...args: any[]) {
      const instance = new OrigAC(...args)
      ;(window as any).__ac = instance
      ;(window as any).__acState = instance.state

      // Poll state changes
      const origResume = instance.resume.bind(instance)
      instance.resume = () => origResume().then(() => {
        ;(window as any).__acState = instance.state
      })
      const origSuspend = instance.suspend.bind(instance)
      instance.suspend = () => origSuspend().then(() => {
        ;(window as any).__acState = instance.state
      })

      return instance
    } as any
    ;(window as any).AudioContext.prototype = OrigAC.prototype

    // Intercept every BufferSource.start() — each playTick() creates one
    const origStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when?: number) {
      const ac = (window as any).__ac
      ;(window as any).__tickLog.push({
        t: Date.now(),
        phase: (window as any).__currentPhase,
        ctxState: ac?.state ?? 'no-ctx',
        ctxTime: +(ac?.currentTime?.toFixed(3) ?? -1),
      })
      return origStart.call(this, when)
    }
  })

  // Seed localStorage state using the real storage keys
  await page.addInitScript(() => {
    const tasks = [
      { id: '1', text: 'Buy groceries', completed: false },
      { id: '2', text: 'Call dentist', completed: false },
      { id: '3', text: 'Fix the bug', completed: false },
      { id: '4', text: 'Reply to email', completed: false },
    ]
    localStorage.setItem('tr-tasks', JSON.stringify(tasks))
    localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Wait for wheel screen — check what's actually on screen if it fails
  try {
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 8000 })
  } catch {
    const snap = await page.content()
    fs.writeFileSync('/tmp/page-snap.html', snap)
    // force navigate to wheel state via console
    await page.evaluate(() => {
      localStorage.setItem('taskroulette-state', JSON.stringify({
        screen: 'WHEEL_IDLE',
        tasks: [
          { id: '1', text: 'Buy groceries', completed: false },
          { id: '2', text: 'Call dentist', completed: false },
        ],
      }))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 8000 })
  }

  // Trigger first interaction (arms audio subsystem)
  await page.click('body', { position: { x: 187, y: 200 } })
  await page.waitForTimeout(500)

  // ── Phase 1: IDLE 3s ──────────────────────────────────────────────────────
  await page.evaluate(() => { (window as any).__currentPhase = 'idle' })
  await page.waitForTimeout(3000)

  // ── Phase 2: SPIN ─────────────────────────────────────────────────────────
  await page.evaluate(() => { (window as any).__currentPhase = 'spinning' })
  const spinBtn = page.getByRole('button', { name: /spin/i }).first()
  await spinBtn.click()

  // Wait for spin to complete (task card appears) — max 7s
  try {
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 7000 })
  } catch { /* still on wheel, that's ok */ }

  // ── Phase 3: POST-SPIN 4s ─────────────────────────────────────────────────
  await page.evaluate(() => { (window as any).__currentPhase = 'post-spin' })
  await page.waitForTimeout(4000)

  // ── Collect results ───────────────────────────────────────────────────────
  const result = await page.evaluate(() => {
    const log: any[] = (window as any).__tickLog
    const byPhase = (p: string) => log.filter(e => e.phase === p)

    const idleTicks = byPhase('idle')
    const spinTicks = byPhase('spinning')
    const postTicks = byPhase('post-spin')

    const intervals: number[] = []
    for (let i = 1; i < spinTicks.length; i++) {
      intervals.push(spinTicks[i].t - spinTicks[i - 1].t)
    }

    return {
      total: log.length,
      idle: { count: idleTicks.length, entries: idleTicks.slice(0, 10) },
      spinning: {
        count: spinTicks.length,
        avgIntervalMs: intervals.length
          ? +(intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)
          : 0,
        minIntervalMs: intervals.length ? Math.min(...intervals) : 0,
      },
      postSpin: { count: postTicks.length, entries: postTicks.slice(0, 10) },
      acFinalState: (window as any).__ac?.state ?? 'none',
    }
  })

  // ── Report ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════')
  console.log('  AUDIO TICK DIAGNOSTIC REPORT')
  console.log('══════════════════════════════════════════')
  console.log(`  AudioContext final state: ${result.acFinalState}`)
  console.log(`  Total BufferSource.start() calls: ${result.total}`)
  console.log()
  console.log(`  IDLE  (3s) : ${result.idle.count} ticks  ← should be 0`)
  if (result.idle.entries.length) {
    result.idle.entries.forEach((e: any) =>
      console.log(`    ↳ ctxState=${e.ctxState} ctxTime=${e.ctxTime}`)
    )
  }
  console.log()
  console.log(`  SPIN       : ${result.spinning.count} ticks`)
  console.log(`    avg interval: ${result.spinning.avgIntervalMs}ms`)
  console.log(`    min interval: ${result.spinning.minIntervalMs}ms  ← should be >= 18`)
  console.log()
  console.log(`  POST-SPIN  : ${result.postSpin.count} ticks  ← should be 0`)
  if (result.postSpin.entries.length) {
    result.postSpin.entries.forEach((e: any) =>
      console.log(`    ↳ ctxState=${e.ctxState} ctxTime=${e.ctxTime}`)
    )
  }
  console.log('══════════════════════════════════════════\n')

  // ── Assertions ────────────────────────────────────────────────────────────
  expect(result.idle.count, 'No ticks during idle').toBe(0)
  expect(result.postSpin.count, 'No ticks after spin ends').toBe(0)
  expect(result.spinning.count, 'Real ticks during spin').toBeGreaterThan(3)
  expect(result.spinning.minIntervalMs, 'Rate limiter >= 15ms').toBeGreaterThanOrEqual(15)
})
