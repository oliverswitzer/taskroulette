import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { MOTIVATIONAL_MESSAGES } from '../constants'
import { playCrowdApplause } from '../audio'
import EmailGateModal, { TR_EMAIL_KEY } from './EmailGateModal'

interface AllDoneScreenProps {
  completedCount: number
  onStartFresh: () => void
}

export default function AllDoneScreen({
  completedCount,
  onStartFresh,
}: AllDoneScreenProps) {
  const [message] = useState(() => {
    const template = MOTIVATIONAL_MESSAGES[
      Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)
    ]
    return template.replace(/\{n\}/g, String(completedCount))
  })

  // Show email modal after applause settles (~10s) — unless already submitted
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Fire confetti + applause
    playCrowdApplause()
    confetti({
      particleCount: 220,
      spread: 100,
      origin: { x: 0.5, y: 0.55 },
      colors: ['#F05A22', '#E09B00', '#82C900', '#1EAA4A', '#1D6AFF', '#7B2FE0', '#E01B7A', '#FFD700', '#ffffff'],
      scalar: 1.1,
    })
    const timer1 = setTimeout(() => {
      confetti({ particleCount: 100, spread: 70, origin: { x: 0.25, y: 0.65 }, angle: 60 })
      confetti({ particleCount: 100, spread: 70, origin: { x: 0.75, y: 0.65 }, angle: 120 })
    }, 350)
    const timer2 = setTimeout(() => {
      confetti({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.3 }, gravity: 0.5 })
    }, 700)

    // Show email gate after confetti settles — short delay so confetti fires first
    const hasEmail = !!localStorage.getItem(TR_EMAIL_KEY)
    const modalTimer = !hasEmail ? setTimeout(() => setShowModal(true), 3000) : undefined

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      if (modalTimer) clearTimeout(modalTimer)
    }
  }, [])

  return (
    <div
      data-testid="all-done-screen"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      {/* Star / trophy icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
        style={{ fontSize: '4rem', marginBottom: 24, lineHeight: 1 }}
        role="img"
        aria-label="Star"
      >
        ⭐
      </motion.div>

      {/* Main message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: 340 }}
      >
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.25rem)',
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: 12,
          }}
        >
          {message}
        </h1>

        <p
          style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--color-ink-muted)',
            marginBottom: 0,
          }}
        >
          {completedCount === 1
            ? 'One task done is better than zero.'
            : `${completedCount} tasks done. Not bad for a brain that wasn't sure where to start.`}
        </p>
      </motion.div>

      {/* Start fresh button */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: '100%', maxWidth: 360, marginTop: 40 }}
      >
        <button
          type="button"
          onClick={onStartFresh}
          style={{
            background: 'var(--color-accent)',
            color: 'oklch(10% 0.01 30)',
            border: 'none',
            borderRadius: 'var(--rounded-lg)',
            padding: '0 40px',
            minHeight: 60,
            width: '100%',
            fontSize: '1.0625rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
        >
          Task dump &amp; spin again →
        </button>
      </motion.div>

      {/* Email gate modal — slides up after applause, if not already subscribed */}
      {showModal && (
        <EmailGateModal
          onSuccess={() => setShowModal(false)}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
