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

// Slightly brighter variants for winning slice (20% luminance boost)
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
}

export default function WheelCanvas({ tasks, angle, winningIndex, size }: WheelCanvasProps) {
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
    const radius = size / 2 - 8

    ctx.clearRect(0, 0, size, size)

    if (tasks.length === 0) {
      // Empty wheel — just a dark circle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, TAU)
      ctx.fillStyle = '#1a1a24'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 2
      ctx.stroke()
      return
    }

    const count = tasks.length
    const sliceAngle = TAU / count
    const baseStartAngle = -TAU / 4 + angle

    // Draw slices
    for (let i = 0; i < count; i++) {
      const sliceStart = baseStartAngle + i * sliceAngle
      const sliceEnd = sliceStart + sliceAngle
      const color = WHEEL_COLORS_HEX[i % WHEEL_COLORS_HEX.length]
      const isWinner = winningIndex === i

      ctx.save()

      if (isWinner) {
        ctx.shadowBlur = 28
        ctx.shadowColor = color
      }

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      const arcRadius = isWinner ? radius + 4 : radius
      ctx.arc(cx, cy, arcRadius, sliceStart, sliceEnd)
      ctx.closePath()

      ctx.fillStyle = isWinner ? (WHEEL_COLORS_BRIGHT[color] ?? color) : color
      ctx.fill()

      ctx.restore()
    }

    // Outer ring stroke
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, TAU)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()

    // Draw text on each slice (only if slice is wide enough)
    for (let i = 0; i < count; i++) {
      if (sliceAngle < 0.3) continue // skip if too small

      const sliceCenter = baseStartAngle + i * sliceAngle + sliceAngle / 2
      const textRadius = radius * 0.6
      const tx = cx + Math.cos(sliceCenter) * textRadius
      const ty = cy + Math.sin(sliceCenter) * textRadius

      const rawText = tasks[i].text
      const label = rawText.length > 12 ? rawText.slice(0, 12) + '…' : rawText
      const color = WHEEL_COLORS_HEX[i % WHEEL_COLORS_HEX.length]

      ctx.save()
      ctx.translate(tx, ty)
      // Normalize slice center angle to [0, TAU)
      const normSC = ((sliceCenter % TAU) + TAU) % TAU
      // For bottom half of wheel, text would render upside-down — flip by PI to keep readable
      const isBottomHalf = normSC >= Math.PI / 2 && normSC <= (3 * Math.PI / 2)
      ctx.rotate(isBottomHalf ? sliceCenter - Math.PI / 2 : sliceCenter + Math.PI / 2)
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      const lightSegments = new Set(['#E09B00', '#82C900', '#1EAA4A'])
      const isDarkText = lightSegments.has(color)
      ctx.fillStyle = isDarkText ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.95)'
      ctx.shadowColor = isDarkText ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.7)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Draw text shadow for legibility
      ctx.shadowBlur = 4
      ctx.fillText(label, 0, 0)
      ctx.restore()
    }

    // Slice dividers (thin lines between slices)
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const lineAngle = baseStartAngle + i * sliceAngle
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(
          cx + Math.cos(lineAngle) * (radius + 4),
          cy + Math.sin(lineAngle) * (radius + 4)
        )
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.restore()
      }
    }

    // Notch indicator — sits just above wheel rim at 12 o'clock
    const notchW = 20
    const notchH = 22
    const notchX = cx
    const notchTip = cy - radius - 2  // tip touches wheel rim
    const notchTop = notchTip - notchH
    ctx.save()
    // Dark outline shadow
    ctx.beginPath()
    ctx.moveTo(notchX - notchW / 2, notchTop)
    ctx.lineTo(notchX + notchW / 2, notchTop)
    ctx.lineTo(notchX, notchTip)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 0
    ctx.fill()
    // White fill
    ctx.beginPath()
    ctx.moveTo(notchX - notchW / 2 + 2, notchTop + 2)
    ctx.lineTo(notchX + notchW / 2 - 2, notchTop + 2)
    ctx.lineTo(notchX, notchTip - 2)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(240,90,34,0.9)'
    ctx.fill()
    ctx.restore()

    // Center circle — dark overlay to cover the converging point
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, TAU)
    ctx.fillStyle = '#1a1a24'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }, [tasks, angle, winningIndex, size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        borderRadius: '50%',
      }}
      aria-label="Task roulette wheel"
    />
  )
}
