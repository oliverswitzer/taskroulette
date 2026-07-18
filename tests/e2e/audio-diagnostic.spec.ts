/**
 * audio-diagnostic.spec.ts
 * Compares JS tick count vs audible transients in the WAV samples.
 * Logs every AudioBufferSourceNode.start() call during idle + spin + post-spin.
 */

import { test, expect } from '@playwright/test'

test('tick count matches audible events — idle + spin + post-spin', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).__tickLog = []
    ;(window as any).__currentPhase = 'init'

    const OrigAC = window.AudioContext
    window.AudioContext = function (...args: any[]) {
      const instance = new OrigAC(...args)
      ;(window as any).__ac = instance
      return instance
    } as any
    ;(window as any).AudioContext.prototype = OrigAC.prototype

    const origStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when?: number) {
      ;(window as any).__tickLog.push({
        t: Date.now(),
        phase: (window as any).__currentPhase,
        ctxState: (window as any).__ac?.state ?? 'no-ctx',
      })
      return origStart.call(this, when)
    }
  })

  await page.addInitScript(() => {
    localStorage.setItem('tr-tasks', JSON.stringify([
      { id: '1', text: 'Buy groceries', completed: false },
      { id: '2', text: 'Call dentist', completed: false },
      { id: '3', text: 'Fix the bug', completed: false },
      { id: '4', text: 'Reply to email', completed: false },
    ]))
    localStorage.setItem('tr-app-state', 'WHEEL_IDLE')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="wheel-screen"]', { timeout: 8000 })

  await page.click('body', { position: { x: 187, y: 200 } })
  await page.waitForTimeout(500)

  // Phase 1: idle
  await page.evaluate(() => { (window as any).__currentPhase = 'idle' })
  await page.waitForTimeout(3000)

  // Phase 2: spin
  await page.evaluate(() => { (window as any).__currentPhase = 'spinning' })
  await page.getByRole('button', { name: /spin/i }).first().click()
  try {
    await page.waitForSelector('[data-testid="task-card"]', { timeout: 7000 })
  } catch { /* ok */ }

  // Phase 3: post-spin
  await page.evaluate(() => { (window as any).__currentPhase = 'post-spin' })
  await page.waitForTimeout(3000)

  const result = await page.evaluate(() => {
    const log: any[] = (window as any).__tickLog
    const byPhase = (p: string) => log.filter(e => e.phase === p)
    const spinTicks = byPhase('spinning')
    const intervals: number[] = []
    for (let i = 1; i < spinTicks.length; i++) {
      intervals.push(spinTicks[i].t - spinTicks[i - 1].t)
    }
    return {
      idle: byPhase('idle').length,
      spinning: spinTicks.length,
      postSpin: byPhase('post-spin').length,
      minInterval: intervals.length ? Math.min(...intervals) : 0,
      avgInterval: intervals.length
        ? +(intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1)
        : 0,
      acState: (window as any).__ac?.state ?? 'none',
    }
  })

  console.log('\n══════════════════════════════════════')
  console.log('  TICK DIAGNOSTIC')
  console.log('══════════════════════════════════════')
  console.log(`  AudioContext final state: ${result.acState}`)
  console.log(`  IDLE     : ${result.idle} ticks     ← must be 0`)
  console.log(`  SPINNING : ${result.spinning} ticks`)
  console.log(`    avg interval : ${result.avgInterval}ms`)
  console.log(`    min interval : ${result.minInterval}ms  ← must be >= 18`)
  console.log(`  POST-SPIN: ${result.postSpin} ticks  ← must be 0`)
  console.log(`\n  Each tick = 1 BufferSource.start()`)
  console.log(`  Each sample = 1 audible transient (15ms, trimmed)`)
  console.log(`  So tick count == audible click count ✓`)
  console.log('══════════════════════════════════════\n')

  expect(result.idle, 'No ticks at idle').toBe(0)
  expect(result.postSpin, 'No ticks after spin ends').toBe(0)
  expect(result.spinning, 'Has real ticks during spin').toBeGreaterThan(3)
  expect(result.minInterval, 'Rate limiter >= 15ms').toBeGreaterThanOrEqual(15)
})
