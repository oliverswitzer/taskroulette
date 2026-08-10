import { useEffect, useRef, useState, useCallback } from 'react'
import useSound from 'use-sound'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'
import { useWheelPhysics } from '../hooks/useWheelPhysics'
import { resumeAudioContext, suspendAudioContext, playTick } from '../audio'
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
  frozen?: boolean
  frozenAngle?: number
  frozenWinnerIndex?: number | null
  onSetActiveTask?: (task: Task, index: number) => void
  onMarkComplete?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
  // Real measured height of the TaskCard bottom sheet (0 when not showing).
  // Replaces a previous hardcoded 300px guess that drifted from the actual
  // card height and either wasted vertical space or clipped the card's
  // bottom content (e.g. the "skip for now" link) depending on task text
  // length and device safe-area insets.
  reservedBottomHeight?: number
}


export default function WheelScreen({
  tasks,
  onSpinStart,
  onTaskSelected,
  onEditTasks,
  onBackToDump,
  autoSpinRef: _autoSpinRef,
  autoSpinSignal = 0,
  frozen = false,
  frozenAngle,
  frozenWinnerIndex,
  onSetActiveTask,
  onMarkComplete,
  onDeleteTask,
  reservedBottomHeight = 0,
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

  const [playWheelLands] = useSound('/audio/wheel-lands.mp3', {
    volume: 0.85,
    html5: true, // forces <audio> element → iOS MEDIA channel (not ringer)
  })

  // Ticker deflection state — bounces on each peg hit
  const [tickerDeflection, setTickerDeflection] = useState(0)
  const tickerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track last angle for audio notch crossings
  const lastAngleRef = useRef<number>(0)

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
  // NOTE: tickerDeflection intentionally omitted — this effect only writes it,
  // never reads it. Including it caused double-tick firing on every bounce.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics.angle, physics.velocity, isSpinning, tasks.length])

  // Transition to TASK_CARD when spin completes (after 600ms glow hold).
  // Also suspends the AudioContext so the idle MediaStream stops emitting.
  const spinTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (physics.winningSliceIndex !== null && !isSpinning) {
      const winnerIndex = physics.winningSliceIndex
      const finalAngle = finalAngleRef.current

      suspendAudioContext()
      playWheelLands()

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

      // resumeAudioContext() handles init + resume in the same gesture tick.
      resumeAudioContext()

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

  // ── Slice click popover — only interactive when wheel is idle ────────────
  const [slicePopover, setSlicePopover] = useState<{ index: number; x: number; y: number } | null>(null)
  const isWheelIdle = !isSpinning && !frozen

  const handleSliceClick = useCallback(
    (index: number, clientX: number, clientY: number) => {
      if (!isWheelIdle) return
      setSlicePopover({ index, x: clientX, y: clientY })
    },
    [isWheelIdle]
  )

  const closeSlicePopover = useCallback(() => setSlicePopover(null), [])

  const popoverTask = slicePopover ? tasks[slicePopover.index] : undefined

  return (
    <div
      data-testid="wheel-screen"
      style={{
        // In frozen mode: size to fit exactly above the task card bottom
        // sheet, using its REAL measured height (reservedBottomHeight) rather
        // than a hardcoded guess. 100svh = stable small viewport (excludes
        // Safari address bar) so the wheel stays fully visible regardless of
        // URL bar state.
        height: frozen ? `calc(100svh - ${reservedBottomHeight}px)` : undefined,
        minHeight: frozen ? undefined : '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Anchor content to the BOTTOM of the reserved area in frozen mode —
        // i.e. hug the wheel right up against the task card with a small
        // fixed gap, and let any true excess vertical space (on taller
        // devices) collect ABOVE the wheel instead of between the wheel and
        // the card. Previously this was centered, which split leftover space
        // equally above AND below the wheel — pushing the task card (and its
        // "skip for now" link) further down and off screen on shorter
        // devices for no visual benefit.
        justifyContent: frozen ? 'flex-end' : 'flex-start',
        padding: '0 20px',
        paddingBottom: frozen ? 0 : 32,
        paddingTop: frozen ? 0 : 0,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: frozen ? 'visible' : 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: frozen ? 'none' : 'flex',
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
          // Small fixed gap below the wheel when frozen (task card showing) —
          // enough to visually separate the wheel from the card without the
          // large dead space the old centered layout produced.
          marginBottom: frozen ? 20 : 0,
          boxShadow: (frozen || physics.winningSliceIndex !== null)
            ? '0 0 0 3px rgba(240,90,34,0.65), 0 0 55px rgba(240,90,34,0.4), 0 0 80px rgba(240,90,34,0.2)'
            : '0 8px 40px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <WheelCanvas
          tasks={tasks}
          angle={frozen ? (frozenAngle ?? 0) : physics.angle}
          winningIndex={frozen ? (frozenWinnerIndex ?? null) : physics.winningSliceIndex}
          size={wheelSize}
          tickerDeflection={tickerDeflection}
          onSliceClick={isWheelIdle ? handleSliceClick : undefined}
        />
      </motion.div>

      {/* Slice click popover — Set active / Mark complete / Delete */}
      <AnimatePresence>
        {slicePopover && popoverTask && (
          <>
            {/* Backdrop — dismiss on outside tap */}
            <motion.div
              key="slice-popover-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeSlicePopover}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'transparent' }}
            />
            <motion.div
              key="slice-popover"
              data-testid="slice-popover"
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              style={{
                position: 'fixed',
                left: Math.min(Math.max(slicePopover.x, 100), window.innerWidth - 100),
                top: Math.min(Math.max(slicePopover.y, 20), window.innerHeight - 160),
                transform: 'translate(-50%, 0)',
                zIndex: 61,
                background: 'oklch(18% 0.025 260)',
                border: '1px solid oklch(30% 0.025 260)',
                borderRadius: 14,
                padding: 6,
                minWidth: 200,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '10px 12px 6px',
                  fontSize: 12,
                  color: 'oklch(55% 0.02 260)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {popoverTask.text}
              </div>
              <PopoverOption
                testId="slice-popover-set-active"
                label="Set as active task"
                accent
                onClick={() => {
                  onSetActiveTask?.(popoverTask, slicePopover.index)
                  closeSlicePopover()
                }}
              />
              <PopoverOption
                testId="slice-popover-mark-complete"
                label="Mark as complete"
                onClick={() => {
                  onMarkComplete?.(popoverTask.id)
                  closeSlicePopover()
                }}
              />
              <PopoverOption
                testId="slice-popover-delete"
                label="Delete"
                danger
                onClick={() => {
                  onDeleteTask?.(popoverTask.id)
                  closeSlicePopover()
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spin button */}
      <div
        style={{
          marginTop: 24,
          width: '100%',
          maxWidth: 400,
          display: frozen ? 'none' : undefined,
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

function PopoverOption({
  testId,
  label,
  onClick,
  accent,
  danger,
}: {
  testId: string
  label: string
  onClick: () => void
  accent?: boolean
  danger?: boolean
}) {
  const color = danger ? 'oklch(65% 0.2 15)' : accent ? 'oklch(72% 0.2 30)' : 'oklch(90% 0.01 260)'
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 14,
        fontWeight: accent ? 700 : 500,
        color,
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'oklch(24% 0.02 260)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}
    </button>
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
