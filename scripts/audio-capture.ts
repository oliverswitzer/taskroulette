/**
 * audio-capture.ts
 * Playwright script that instruments the Web Audio graph, captures raw PCM
 * samples from the AnalyserNode, and writes them to a WAV file for analysis.
 *
 * Captures three windows:
 *   1. IDLE    — app loaded, wheel screen visible, not spinning (2s)
 *   2. SPINNING — wheel is spinning (3s)
 *   3. STOPPED  — spin just ended, wheel idle again (2s)
 *
 * Run: npx tsx scripts/audio-capture.ts
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = 'http://localhost:5173'
const OUT_DIR = path.resolve(process.cwd(), 'tests/e2e/screenshots')
const SAMPLE_RATE = 44100

// ── WAV writer ────────────────────────────────────────────────────────────────
function writeWav(filePath: string, samples: Float32Array, sampleRate: number) {
  const numSamples = samples.length
  const byteRate = sampleRate * 2  // 16-bit mono
  const blockAlign = 2
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)

  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)          // subchunk size
  buf.writeUInt16LE(1, 20)           // PCM
  buf.writeUInt16LE(1, 22)           // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(blockAlign, 32)
  buf.writeUInt16LE(16, 34)          // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
  }

  fs.writeFileSync(filePath, buf)
}

// ── RMS analysis ──────────────────────────────────────────────────────────────
function analyzeRMS(label: string, samples: Float32Array, windowMs = 100) {
  const windowSize = Math.floor(SAMPLE_RATE * windowMs / 1000)
  const results: { t: number; rms: number }[] = []
  for (let i = 0; i < samples.length; i += windowSize) {
    const chunk = samples.slice(i, i + windowSize)
    const rms = Math.sqrt(chunk.reduce((s, x) => s + x * x, 0) / chunk.length)
    results.push({ t: +(i / SAMPLE_RATE * 1000).toFixed(0), rms: +rms.toFixed(5) })
  }
  const max = results.reduce((m, r) => r.rms > m ? r.rms : m, 0)
  const noisy = results.filter(r => r.rms > 0.001)
  console.log(`\n── ${label} ──`)
  console.log(`  duration: ${(samples.length / SAMPLE_RATE * 1000).toFixed(0)}ms`)
  console.log(`  peak RMS: ${max.toFixed(5)}`)
  console.log(`  windows with RMS > 0.001: ${noisy.length}/${results.length}`)
  if (noisy.length > 0) {
    console.log(`  noisy windows (t_ms : rms):`)
    noisy.forEach(r => console.log(`    ${r.t}ms : ${r.rms}`))
  } else {
    console.log(`  ✓ silent`)
  }
  return { max, noisyCount: noisy.length }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Launching browser…')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const page = await ctx.newPage()

  // Collect console errors
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()) })

  console.log('Loading app…')
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  // ── Seed tasks directly in localStorage so we skip the AI parse step ────
  await page.evaluate(() => {
    const tasks = [
      { id: '1', text: 'Buy groceries', completed: false },
      { id: '2', text: 'Call dentist', completed: false },
      { id: '3', text: 'Fix the bug', completed: false },
    ]
    const state = {
      screen: 'WHEEL_IDLE',
      tasks,
      selectedTask: null,
      selectedIndex: null,
      wheelAngle: 0,
      autoSpinSignal: 0,
    }
    localStorage.setItem('taskroulette-state', JSON.stringify(state))
  })
  await page.reload({ waitUntil: 'networkidle' })

  // Wait for wheel screen
  await page.waitForSelector('[data-testid="wheel-screen"]')
  console.log('Wheel screen visible.')

  // ── Inject AudioContext spy + AnalyserNode capture ───────────────────────
  // We monkey-patch AudioContext to intercept creation and wire in our recorder.
  const captureScript = `
    window.__audioCapture = {
      chunks: [],        // { label, samples: Float32Array }
      recording: false,
      label: 'idle',
      _analyser: null,
      _processor: null,

      start(label) {
        this.label = label
        this.recording = true
        console.log('[capture] start:', label)
      },

      stop() {
        this.recording = false
        console.log('[capture] stop:', this.label, 'chunks:', this.chunks.length)
      },

      // Called once by the patch below after AudioContext is created
      wire(ctx) {
        if (this._analyser) return
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0

        // ScriptProcessorNode lets us intercept raw samples
        const proc = ctx.createScriptProcessor(4096, 1, 1)
        proc.onaudioprocess = (e) => {
          if (!this.recording) return
          const data = e.inputBuffer.getChannelData(0)
          this.chunks.push({ label: this.label, samples: new Float32Array(data) })
        }

        // Connect: destination → analyser → processor → (sink)
        // We splice BEFORE destination so we capture everything routed there.
        // But since the app uses MediaStreamDestination, we also hook that.
        try {
          const origCreate = ctx.createMediaStreamDestination.bind(ctx)
          // already created — wire the analyser into the processor chain
        } catch(e) {}

        // Wire: hook onaudioprocess on a processor connected to the mediaStreamDest
        // We need to intercept the mediaStreamDest node itself.
        // Simplest: connect ctx.destination (the real one) through analyser → proc
        analyser.connect(proc)
        proc.connect(ctx.destination)  // proc needs a sink or it won't fire
        this._analyser = analyser
        this._processor = proc

        // Also expose a way to connect arbitrary nodes through us
        window.__captureInput = analyser
        console.log('[capture] wired, sampleRate:', ctx.sampleRate)
      },

      getChunks(label) {
        return this.chunks.filter(c => c.label === label).map(c => Array.from(c.samples))
      }
    }

    // Patch AudioContext constructor to auto-wire capture
    const OrigAC = window.AudioContext
    window.AudioContext = function(...args) {
      const instance = new OrigAC(...args)
      setTimeout(() => window.__audioCapture.wire(instance), 100)
      window.__ac = instance
      return instance
    }
    window.AudioContext.prototype = OrigAC.prototype
  `
  await page.evaluate(captureScript)
  console.log('Audio capture injected.')

  // Trigger a click to initialize audio (simulates first touch)
  await page.click('[data-testid="wheel-screen"]', { position: { x: 195, y: 100 } })
  await page.waitForTimeout(500)

  // Patch the mediaStreamDest to also route through our analyser
  await page.evaluate(() => {
    const ac = (window as any).__ac
    const cap = (window as any).__audioCapture
    if (!ac || !cap._analyser) return
    // The mediaStreamDest was created by _init() — we need to intercept what flows into it.
    // Simplest approach: override AudioNode.connect so we can log all connections.
    // Instead: just capture via a ScriptProcessorNode connected to what flows into
    // mediaStreamDest by re-routing: whenever playTick connects to mediaStreamDest,
    // also connect to our analyser.
    // Since we can't intercept past connections, wire analyser to ctx.destination directly.
    // The real audio goes to mediaStreamDest → <audio>, but we can measure RMS separately
    // by connecting our own OscillatorNode through the same filter chain... or just
    // override AudioNode.connect at module load time (too late now).
    //
    // Better: patch AudioNode.prototype.connect to intercept all future connections.
    const orig = AudioNode.prototype.connect
    ;(AudioNode.prototype.connect as any) = function(dest: AudioNode, ...rest: any[]) {
      // If connecting to mediaStreamDest, also connect to our analyser for monitoring
      if (dest === (window as any).__mediaStreamDest && cap._analyser) {
        try { orig.call(this, cap._analyser) } catch {}
      }
      return orig.call(this, dest, ...rest)
    }
    console.log('[capture] AudioNode.connect patched for future connections')
  })

  // ── CAPTURE 1: IDLE (2 seconds, not spinning) ────────────────────────────
  console.log('\nCapturing IDLE window (2s)…')
  await page.evaluate(() => { (window as any).__audioCapture.start('idle') })
  await page.waitForTimeout(2000)
  await page.evaluate(() => { (window as any).__audioCapture.stop() })

  // ── CAPTURE 2: SPINNING ───────────────────────────────────────────────────
  console.log('Triggering spin…')
  await page.evaluate(() => { (window as any).__audioCapture.start('spin-before-click') })

  // Click the spin button (this resumes AudioContext)
  const spinBtn = page.getByRole('button', { name: /spin/i })
  await spinBtn.click()

  await page.evaluate(() => { (window as any).__audioCapture.start('spinning') })
  await page.waitForTimeout(3000)

  // ── CAPTURE 3: POST-SPIN IDLE ─────────────────────────────────────────────
  await page.evaluate(() => { (window as any).__audioCapture.start('post-spin') })

  // Wait for task card or wheel to settle
  await page.waitForTimeout(3000)
  await page.evaluate(() => { (window as any).__audioCapture.stop() })

  // ── Collect samples from page ─────────────────────────────────────────────
  const rawData = await page.evaluate(() => {
    const cap = (window as any).__audioCapture
    return {
      idle: cap.getChunks('idle'),
      spinning: cap.getChunks('spinning'),
      postSpin: cap.getChunks('post-spin'),
      totalChunks: cap.chunks.length,
      ac: {
        state: (window as any).__ac?.state,
        sampleRate: (window as any).__ac?.sampleRate,
      }
    }
  })

  console.log(`\nAudioContext state after capture: ${rawData.ac.state}`)
  console.log(`Total chunks recorded: ${rawData.totalChunks}`)
  console.log(`  idle: ${rawData.idle.length} chunks`)
  console.log(`  spinning: ${rawData.spinning.length} chunks`)
  console.log(`  post-spin: ${rawData.postSpin.length} chunks`)

  // ── Flatten + write WAV files ─────────────────────────────────────────────
  const flatten = (chunks: number[][]): Float32Array => {
    const total = chunks.reduce((s, c) => s + c.length, 0)
    const out = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }

  const idleSamples = flatten(rawData.idle)
  const spinningSamples = flatten(rawData.spinning)
  const postSpinSamples = flatten(rawData.postSpin)

  fs.mkdirSync(OUT_DIR, { recursive: true })

  if (idleSamples.length > 0) {
    writeWav(path.join(OUT_DIR, 'audio-idle.wav'), idleSamples, SAMPLE_RATE)
    console.log(`\nWrote audio-idle.wav (${idleSamples.length} samples)`)
  }
  if (spinningSamples.length > 0) {
    writeWav(path.join(OUT_DIR, 'audio-spinning.wav'), spinningSamples, SAMPLE_RATE)
    console.log(`Wrote audio-spinning.wav (${spinningSamples.length} samples)`)
  }
  if (postSpinSamples.length > 0) {
    writeWav(path.join(OUT_DIR, 'audio-post-spin.wav'), postSpinSamples, SAMPLE_RATE)
    console.log(`Wrote audio-post-spin.wav (${postSpinSamples.length} samples)`)
  }

  // ── RMS analysis ──────────────────────────────────────────────────────────
  analyzeRMS('IDLE (should be silent)', idleSamples)
  analyzeRMS('SPINNING (should have clicks)', spinningSamples)
  analyzeRMS('POST-SPIN (should be silent)', postSpinSamples)

  await browser.close()
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
