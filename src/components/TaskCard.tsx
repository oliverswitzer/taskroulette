import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { Task } from '../types'
import WheelCanvas from './WheelCanvas'

interface TaskCardProps {
  task: Task
  onComplete: () => void
  onSkip: () => void
  onBackToDump: () => void
  wheelAngle: number
  winningIndex: number | null
  activeTasks: Task[]
  wheelSize?: number
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { x: 0.5, y: 0.6 },
    colors: ['#E8532A', '#D4891A', '#2BA84A', '#2563EB', '#7C3AED', '#ffffff'],
    gravity: 1.2,
    scalar: 0.9,
  })
}

export default function TaskCard({
  task,
  onComplete,
  onSkip,
  onBackToDump,
  wheelAngle,
  winningIndex,
  activeTasks,
  wheelSize: wheelSizeProp,
}: TaskCardProps) {
  const [checked, setChecked] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Match WheelScreen sizing — full width up to 400px
  const [computedWheelSize, setComputedWheelSize] = useState(() =>
    wheelSizeProp ?? Math.min(window.innerWidth - 40, 400)
  )
  useEffect(() => {
    if (wheelSizeProp) return
    const handleResize = () => setComputedWheelSize(Math.min(window.innerWidth - 40, 400))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [wheelSizeProp])

  const handleCheck = useCallback(() => {
    if (checked || completing) return
    setChecked(true)
    fireConfetti()
    setCompleting(true)
    setTimeout(() => {
      onComplete()
    }, 800)
  }, [checked, completing, onComplete])

  return (
    <div
      data-testid="task-card"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 20px 40px',
        boxSizing: 'border-box',
      }}
    >
      {/* Back button — top left */}
      <div style={{ width: '100%', maxWidth: computedWheelSize, padding: '12px 0 0' }}>
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
            padding: '4px 0',
            minHeight: 44,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Dump
        </button>
      </div>

      {/* Frozen wheel with glowing winner */}
      <div style={{ width: computedWheelSize }}>
        <div
          style={{
            borderRadius: '50%',
            boxShadow: '0 0 0 3px rgba(240,90,34,0.7), 0 0 50px rgba(240,90,34,0.45), 0 0 90px rgba(240,90,34,0.2)',
          }}
        >
          <WheelCanvas
            tasks={activeTasks}
            angle={wheelAngle}
            winningIndex={winningIndex}
            size={computedWheelSize}
            tickerDeflection={0}
          />
        </div>
      </div>

      {/* Floating task card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          marginTop: 12,
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface)',
          borderRadius: 'var(--rounded-xl)',
          padding: '16px 20px',
          animation: 'taskGlow 1.8s ease-in-out infinite',
          position: 'relative',
        }}
      >
        {/* Label above */}
        <p
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-ink-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          The wheel chose
        </p>

        {/* Task text */}
        <p
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            lineHeight: 1.35,
            color: 'var(--color-ink)',
            marginBottom: 14,
          }}
        >
          {task.text}
        </p>

        {/* Checkbox area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            data-testid="task-checkbox"
            onClick={handleCheck}
            aria-label="Mark task complete"
            aria-pressed={checked}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: checked ? 'default' : 'pointer',
              background: 'transparent',
              border: 'none',
              padding: 6,
              borderRadius: 'var(--rounded-md)',
              flexShrink: 0,
            }}
          >
            <motion.div
              animate={checked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: checked
                  ? 'none'
                  : '2px solid var(--color-accent)',
                background: checked ? 'var(--color-accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s ease, border 0.2s ease',
              }}
            >
              {checked && (
                <motion.svg
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.polyline
                    points="20 6 9 17 4 12"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                </motion.svg>
              )}
            </motion.div>
          </button>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)' }}>
            Got it? Check it off!
          </p>
        </div>
      </motion.div>

      {/* Skip button */}
      <button
        type="button"
        data-testid="spin-again-btn"
        onClick={onSkip}
        style={{
          marginTop: 8,
          background: 'transparent',
          border: 'none',
          color: 'var(--color-ink-muted)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          padding: '8px 24px',
          minHeight: 36,
          opacity: completing ? 0 : 1,
          pointerEvents: completing ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        skip for now →
      </button>
    </div>
  )
}
