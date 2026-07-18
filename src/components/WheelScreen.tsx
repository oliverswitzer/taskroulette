import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Task } from '../types'
import { useWheelPhysics } from '../hooks/useWheelPhysics'
import { initAudioContext, playTick } from '../audio'
import { MAX_TASKS, MIN_SWIPE_VELOCITY, MAX_SWIPE_VELOCITY } from '../constants'
import WheelCanvas from './WheelCanvas'

interface WheelScreenProps {
  tasks: Task[]
  onSpinStart?: () => void
  onTaskSelected: (task: Task, index: number, finalAngle: number) => void
  onEditTasks: () => void
  onBackToDump: () => void
  autoSpinRef?: React.MutableRefObject<boolean>
  autoSpinSignal?: number
}


export default function WheelScreen({
  tasks,
  onSpinStart,
  onTaskSelected,
  onEditTasks,
  onBackToDump,
  autoSpinRef: _autoSpinRef,
  autoSpinSignal = 0,
}: WheelScreenProps) {
  // Compute wheel size — cap at container width (480px max), not full viewport
  const [wheelSize, setWheelSize] = useState(() =>
    Math.min(window.innerWidth - 40, 400)  // 400px max on desktop, fills mobile
  )

  useEffect(() => {
    const handleResize = () => {
      setWheelSize(Math.min(window.innerWidth - 40, 400))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { physics, startSpin } = useWheelPhysics(tasks.length)
  const isSpinning = physics.isSpinning

  // Ticker deflection state — bounces on each peg hit
  const [tickerDeflection, setTickerDeflection] = useState(0)
  const tickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track last angle for audio notch crossings
  const lastAngleRef = useRef<number>(0)
  const audioInitRef = useRef<boolean>(false)

  // Track final angle for when spin completes
  const finalAngleRef = useRef<number>(0)
  useEffect(() => {
    finalAngleRef.current = physics.angle
  })


  // Peg hit detection — fires audio + ticker bounce on each slice boundary crossing
  useEffect(() => {
    if (!isSpinning) return
    const count = tasks.length
    if (count === 0) return

    const TAU = Math.PI * 2
    const sliceAngle = TAU / count
    const prevNorm = ((lastAngleRef.current % TAU) + TAU) % TAU
    const currNorm = ((physics.angle % TAU) + TAU) % TAU

    const prevSlice = Math.floor(prevNorm / sliceAngle)
    const currSlice = Math.floor(currNorm / sliceAngle)

    if (prevSlice !== currSlice) {
      // Peg hit — play click
      playTick(physics.velocity)

      // Ticker bounce: snap to deflected position, then spring back
      if (tickerTimeoutRef.current) clearTimeout(tickerTimeoutRef.current)
      setTickerDeflection(1)
      tickerTimeoutRef.current = setTimeout(() => setTickerDeflection(0), 60)
    }

    lastAngleRef.current = physics.angle
  }, [physics.angle, physics.velocity, isSpinning, tasks.length, tickerDeflection])

  // Transition to TASK_CARD when spin completes (after 600ms glow hold)
  const spinTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (physics.winningSliceIndex !== null && !isSpinning) {
      const winnerIndex = physics.winningSliceIndex
      const finalAngle = finalAngleRef.current

      spinTransitionRef.current = setTimeout(() => {
        if (tasks[winnerIndex]) {
          onTaskSelected(tasks[winnerIndex], winnerIndex, finalAngle)
        }
      }, 600)
    }
    return () => {
      if (spinTransitionRef.current) clearTimeout(spinTransitionRef.current)
    }
  }, [physics.winningSliceIndex, isSpinning]) // eslint-disable-line

  const triggerSpin = useCallback(
    (velocity: number) => {
      if (isSpinning || tasks.length === 0) return

      if (!audioInitRef.current) {
        initAudioContext()
        audioInitRef.current = true
      }

      lastAngleRef.current = physics.angle
      onSpinStart?.()

      startSpin(velocity, () => {})
    },
    [isSpinning, tasks.length, physics.angle, onSpinStart, startSpin]
  )

  // Random spin button
  const handleSpinClick = useCallback(() => {
    const velocity =
      MIN_SWIPE_VELOCITY +
      Math.random() * (MAX_SWIPE_VELOCITY * 0.8 - MIN_SWIPE_VELOCITY)
    triggerSpin(velocity)
  }, [triggerSpin])

  // Auto-spin when autoSpinSignal changes (incremented by App.tsx on "spin again")
  // prevSignalRef tracks last-seen value to avoid re-firing on re-renders.
  // IMPORTANT: No setTimeout here — StrictMode cancels timeouts in dev.
  // startSpin is stable (ref-based) so calling it synchronously in the effect is safe.
  const prevSignalRef = useRef(0)
  useEffect(() => {
    if (autoSpinSignal === 0) return
    if (autoSpinSignal <= prevSignalRef.current) return
    prevSignalRef.current = autoSpinSignal
    const velocity =
      MIN_SWIPE_VELOCITY +
      Math.random() * (MAX_SWIPE_VELOCITY * 0.8 - MIN_SWIPE_VELOCITY)
    startSpin(velocity, () => {})
    onSpinStart?.()
  })


  const activeBadgeCount = tasks.filter(t => !t.completed).length

  return (
    <div
      data-testid="wheel-screen"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 20px',
        paddingBottom: 32,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 0 16px',
        }}
      >
        {/* Back to dump — hidden while spinning */}
        <button
          type="button"
          onClick={onBackToDump}
          aria-label="Back to task dump"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-muted)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 4px',
            minHeight: 44,
            opacity: isSpinning ? 0 : 1,
            pointerEvents: isSpinning ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Dump
        </button>

        {/* Task count badge */}
        <span
          style={{
            background: 'oklch(20% 0.05 30)',
            color: 'var(--color-accent)',
            border: '1px solid oklch(35% 0.1 30)',
            borderRadius: 'var(--rounded-full)',
            padding: '4px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {activeBadgeCount}/{MAX_TASKS} tasks
        </span>

        {/* Edit button — hidden while spinning */}
        <button
          type="button"
          data-testid="edit-tasks-btn"
          onClick={onEditTasks}
          aria-label="Edit tasks"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-ink-muted)',
            opacity: isSpinning ? 0 : 1,
            pointerEvents: isSpinning ? 'none' : 'auto',
            transition: 'opacity 0.2s ease',
          }}
        >
          <PencilIcon />
        </button>
      </div>

      {/* Wheel canvas */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          borderRadius: '50%',
          boxShadow: physics.winningSliceIndex !== null
            ? '0 0 0 3px rgba(240,90,34,0.65), 0 0 55px rgba(240,90,34,0.4), 0 0 80px rgba(240,90,34,0.2)'
            : '0 8px 40px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <WheelCanvas
          tasks={tasks}
          angle={physics.angle}
          winningIndex={physics.winningSliceIndex}
          size={wheelSize}
          tickerDeflection={tickerDeflection}
        />
      </motion.div>

      {/* Spin button */}
      <div
        style={{
          marginTop: 24,
          width: '100%',
          maxWidth: 400,
        }}
      >
        <motion.button
          type="button"
          aria-label="Spin the wheel"
          onClick={handleSpinClick}
          disabled={isSpinning || tasks.length === 0}
          whileTap={isSpinning ? {} : { scale: 0.97 }}
          style={{
            background: isSpinning || tasks.length === 0 ? 'var(--color-surface2)' : 'var(--color-accent)',
            color: isSpinning || tasks.length === 0 ? 'var(--color-ink-muted)' : 'oklch(10% 0.01 30)',
            border: 'none',
            borderRadius: 'var(--rounded-lg)',
            padding: '0 40px',
            minHeight: 60,
            width: '100%',
            fontSize: '1.0625rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: isSpinning || tasks.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isSpinning ? 0.7 : 1,
            transition:
              'background 0.2s cubic-bezier(0.16,1,0.3,1), color 0.2s, opacity 0.2s',
          }}
        >
          {isSpinning ? 'Spinning…' : 'Spin →'}
        </motion.button>
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
