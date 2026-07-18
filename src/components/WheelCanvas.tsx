import { useEffect, useRef } from 'react'
import type { Task } from '../types'

// Precomputed hex equivalents of OKLCH wheel colors for canvas
// (OKLCH does NOT work in canvas 2D fillStyle directly)
const WHEEL_COLORS_HEX = [
  '#F05A22', // warm orange-red
  '#E09B00', // bright amber
  '#82C900', // vivid lime
  '#1EAA4A', // fresh green
  '#00A89A', // clear teal
  '#1D6AFF', // bright blue
  '#7B2FE0', // vibrant purple
  '#E01B7A', // vivid pink
]

// Slightly brighter variants for winning slice
const WHEEL_COLORS_BRIGHT: { [key: string]: string } = {
  '#F05A22': '#FF7A40',
  '#E09B00': '#FFBC20',
  '#82C900': '#AAED20',
  '#1EAA4A': '#28D060',
  '#00A89A': '#10D0C0',
  '#1D6AFF': '#4A88FF',
  '#7B2FE0': '#9B52FF',
  '#E01B7A': '#FF3E96',
}

const TAU = Math.PI * 2

interface WheelCanvasProps {
  tasks: Task[]
  angle: number
  winningIndex: number | null
  size: number
  tickerDeflection?: number // 0–1, how much the ticker is deflected (bounces on peg hit)
}

export default function WheelCanvas({ tasks, angle, winningIndex, size, tickerDeflection = 0 }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // HiDPI support
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const rimWidth = Math.max(10, size * 0.055) // thick rim — ~5.5% of diameter
    const radius = size / 2 - rimWidth - 2
    const outerRimEdge = size / 2 - 2

    ctx.clearRect(0, 0, size, size)

    // ── Outer rim (thick dark border ring) ─────────────────────────────────
    ctx.save()
    // Rim fill — dark navy with subtle gradient
    const rimGrad = ctx.createRadialGradient(cx, cy, radius, cx, cy, outerRimEdge)
    rimGrad.addColorStop(0, '#1e2440')
    rimGrad.addColorStop(0.5, '#252d4e')
    rimGrad.addColorStop(1, '#161c36')
    ctx.beginPath()
    ctx.arc(cx, cy, outerRimEdge, 0, TAU)
    ctx.arc(cx, cy, radius, 0, TAU, true) // inner hole (counter-clockwise = donut)
    ctx.fillStyle = rimGrad
    ctx.fill()
    // Outer edge highlight
    ctx.beginPath()
    ctx.arc(cx, cy, outerRimEdge, 0, TAU)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Inner edge shadow
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, TAU)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    if (tasks.length === 0) {
      // Empty wheel
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, TAU)
      ctx.fillStyle = '#1a1a24'
      ctx.fill()
      ctx.restore()
      return
    }

    const count = tasks.length
    const sliceAngle = TAU / count
    const baseStartAngle = -TAU / 4 + angle

    // ── Slices ──────────────────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const sliceStart = baseStartAngle + i * sliceAngle
      const sliceEnd = sliceStart + sliceAngle
      const color = WHEEL_COLORS_HEX[i % WHEEL_COLORS_HEX.length]
      const isWinner = winningIndex === i

      ctx.save()
      if (isWinner) {
        ctx.shadowBlur = 32
        ctx.shadowColor = color
      }

      // Slight gradient per slice (lighter in center → darker at edge)
      const sliceCenter = sliceStart + sliceAngle / 2
      const gradX1 = cx + Math.cos(sliceCenter) * radius * 0.25
      const gradY1 = cy + Math.sin(sliceCenter) * radius * 0.25
      const gradX2 = cx + Math.cos(sliceCenter) * radius * 0.95
      const gradY2 = cy + Math.sin(sliceCenter) * radius * 0.95
      const sliceGrad = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2)
      const bright = isWinner ? (WHEEL_COLORS_BRIGHT[color] ?? color) : color
      sliceGrad.addColorStop(0, bright + 'ee')
      sliceGrad.addColorStop(1, bright + '99')

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, sliceStart, sliceEnd)
      ctx.closePath()
      ctx.fillStyle = sliceGrad
      ctx.fill()
      ctx.restore()
    }

    // ── Slice dividers ──────────────────────────────────────────────────────
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const lineAngle = baseStartAngle + i * sliceAngle
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(
          cx + Math.cos(lineAngle) * radius,
          cy + Math.sin(lineAngle) * radius
        )
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
    }

    // ── Pegs — at the outer end of each divider, on the rim ──────────────────
    // These are what the ticker physically "hits" — drawn as small circles on
    // the inner edge of the rim, one per slice boundary
    if (count > 1) {
      const pegRadius = Math.max(3.5, size * 0.012)
      const pegDist = radius + rimWidth * 0.45 // sits in the middle of the rim
      for (let i = 0; i < count; i++) {
        const pegAngle = baseStartAngle + i * sliceAngle
        const px = cx + Math.cos(pegAngle) * pegDist
        const py = cy + Math.sin(pegAngle) * pegDist

        // Peg glow — subtle warm highlight
        ctx.save()
        ctx.shadowBlur = 6
        ctx.shadowColor = 'rgba(255, 220, 120, 0.7)'
        ctx.beginPath()
        ctx.arc(px, py, pegRadius, 0, TAU)
        // Warm cream/white fill — like a carnival light bulb
        const pegGrad = ctx.createRadialGradient(px - pegRadius * 0.3, py - pegRadius * 0.3, 0, px, py, pegRadius)
        pegGrad.addColorStop(0, '#fff9e0')
        pegGrad.addColorStop(0.6, '#f0d060')
        pegGrad.addColorStop(1, '#c08020')
        ctx.fillStyle = pegGrad
        ctx.fill()
        ctx.restore()
      }
    }

    // ── Text labels ─────────────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      if (sliceAngle < 0.28) continue

      const sliceMid = baseStartAngle + i * sliceAngle + sliceAngle / 2
      const textRadius = radius * 0.62
      const tx = cx + Math.cos(sliceMid) * textRadius
      const ty = cy + Math.sin(sliceMid) * textRadius

      const rawText = tasks[i].text
      const label = rawText.length > 12 ? rawText.slice(0, 11) + '…' : rawText
      const color = WHEEL_COLORS_HEX[i % WHEEL_COLORS_HEX.length]
      const isWinner = winningIndex === i

      ctx.save()
      ctx.translate(tx, ty)
      const normSC = ((sliceMid % TAU) + TAU) % TAU
      const isBottomHalf = normSC >= Math.PI / 2 && normSC <= (3 * Math.PI) / 2
      ctx.rotate(isBottomHalf ? sliceMid - Math.PI / 2 : sliceMid + Math.PI / 2)

      const fontSize = Math.max(10, Math.min(14, size * 0.034))
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
      const lightSegments = new Set(['#E09B00', '#82C900', '#1EAA4A'])
      const isDarkText = lightSegments.has(color)
      ctx.fillStyle = isDarkText ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.97)'
      ctx.shadowColor = isDarkText ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = isWinner ? 8 : 4
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 0, 0)
      ctx.restore()
    }

    // ── Center hub ───────────────────────────────────────────────────────────
    const hubRadius = Math.max(16, size * 0.078)
    ctx.save()
    const hubGrad = ctx.createRadialGradient(cx - hubRadius * 0.2, cy - hubRadius * 0.2, 0, cx, cy, hubRadius)
    hubGrad.addColorStop(0, '#2a2f52')
    hubGrad.addColorStop(0.7, '#1a1f3a')
    hubGrad.addColorStop(1, '#10142a')
    ctx.beginPath()
    ctx.arc(cx, cy, hubRadius, 0, TAU)
    ctx.fillStyle = hubGrad
    ctx.shadowBlur = 8
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

  }, [tasks, angle, winningIndex, size])

  // The ticker/pointer is drawn as a DOM element so it can animate independently
  // (bounce on peg hit without needing a canvas redraw)
  const tickerSize = Math.max(22, size * 0.09)
  // tickerDeflection: 0 = upright, 1 = fully deflected right (15deg)
  const deflectDeg = tickerDeflection * 15

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', borderRadius: '50%' }}
        aria-label="Task roulette wheel"
      />
      {/* Ticker pointer — sits outside canvas, pivots at top */}
      <div
        style={{
          position: 'absolute',
          top: -tickerSize * 0.15,
          left: '50%',
          transform: `translateX(-50%)`,
          width: tickerSize,
          height: tickerSize * 1.15,
          pointerEvents: 'none',
          transformOrigin: '50% 10%',
          // Bounce animation on peg hit — rotate right then spring back
          transition: deflectDeg > 0
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          rotate: `${deflectDeg}deg`,
        }}
      >
        <svg
          width={tickerSize}
          height={tickerSize * 1.15}
          viewBox="0 0 40 46"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Drop shadow filter */}
          <defs>
            <filter id="tickerShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
            </filter>
          </defs>
          {/* Thick orange/amber pointer triangle */}
          <polygon
            points="20,46 4,8 36,8"
            fill="#F5A623"
            filter="url(#tickerShadow)"
          />
          {/* Lighter center highlight */}
          <polygon
            points="20,40 8,12 32,12"
            fill="#FFD060"
            opacity="0.6"
          />
          {/* Dark outline for definition */}
          <polygon
            points="20,46 4,8 36,8"
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
