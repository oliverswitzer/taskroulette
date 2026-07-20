import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { submitEmail } from '../api'

const TR_EMAIL_KEY = 'trEmail'

interface EmailGateModalProps {
  onSuccess: () => void   // called after email submitted — modal closes, user continues
  onDismiss: () => void   // called when user hits X
}

export default function EmailGateModal({ onSuccess, onDismiss }: EmailGateModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || loading) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError(null)
    const result = await submitEmail(email.trim())
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Try again.')
      return
    }
    localStorage.setItem(TR_EMAIL_KEY, email.trim())
    setSubmitted(true)
    setTimeout(onSuccess, 1200)
  }, [email, loading, onSuccess])

  return (
    <AnimatePresence>
      <motion.div
        key="email-gate-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
      >
        <motion.div
          key="email-gate-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--color-surface)',
            borderRadius: '24px 24px 0 0',
            padding: '32px 24px 48px',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'var(--color-surface2)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-ink-muted)',
              fontSize: 16,
            }}
          >
            ✕
          </button>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: 'center', padding: '16px 0' }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                You're in!
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', marginTop: 8 }}>
                3 sessions a day, unlocked.
              </div>
            </motion.div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-ink)', marginBottom: 8, lineHeight: 1.2 }}>
                  Keep the momentum going 🚀
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
                  Drop your email to unlock <strong>3 sessions a day</strong> — plus get weekly videos on building real businesses with an ADHD brain.
                </div>
              </div>

              {/* Channel pitch */}
              <div style={{
                background: 'var(--color-surface2)',
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 20,
                fontSize: '0.82rem',
                color: 'var(--color-ink-muted)',
                lineHeight: 1.6,
                borderLeft: '3px solid var(--color-accent)',
              }}>
                <strong style={{ color: 'var(--color-ink)', display: 'block', marginBottom: 4 }}>
                  ADHD Founder Builds
                </strong>
                I document building real startups in public — launches, mistakes, marketing experiments, and the uncomfortable lessons from turning ideas into actual companies. If you've ever avoided sales, chased shiny objects, or wondered why making software feels easier than getting customers.. you're in the right place.
              </div>

              {/* Email input */}
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="you@example.com"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: error ? '1.5px solid #E8532A' : '1.5px solid var(--color-border)',
                  background: 'var(--color-base)',
                  color: 'var(--color-ink)',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  marginBottom: 8,
                  outline: 'none',
                }}
              />
              {error && (
                <div style={{ fontSize: '0.82rem', color: '#E8532A', marginBottom: 8 }}>{error}</div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !email.trim()}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: 12,
                  border: 'none',
                  background: loading || !email.trim() ? 'var(--color-surface2)' : 'var(--color-accent)',
                  color: loading || !email.trim() ? 'var(--color-ink-muted)' : 'oklch(10% 0.01 30)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Subscribing…' : 'Unlock 3 sessions/day →'}
              </button>

              <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', textAlign: 'center', marginTop: 12 }}>
                No spam. Unsubscribe anytime.
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export { TR_EMAIL_KEY }
