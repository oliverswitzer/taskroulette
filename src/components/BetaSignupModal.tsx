/**
 * BetaSignupModal — slide-up sheet for Google Tasks beta waitlist.
 * Same structure as EmailGateModal, different copy + success state.
 * Submits to the same /api/submit-email → Loops endpoint.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { submitEmail } from '../api'

interface BetaSignupModalProps {
  onClose: () => void
}

export default function BetaSignupModal({ onClose }: BetaSignupModalProps) {
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
    setSubmitted(true)
    setTimeout(onClose, 1800)
  }, [email, loading, onClose])

  return (
    <AnimatePresence>
      <motion.div
        key="beta-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0 0 env(safe-area-inset-bottom)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          key="beta-sheet"
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
          {/* Dismiss */}
          <button
            type="button"
            onClick={onClose}
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
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                You're on the list!
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', marginTop: 8 }}>
                We'll reach out when Google Tasks is ready.
              </div>
            </motion.div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                {/* Beta badge */}
                <span style={{
                  display: 'inline-block',
                  background: 'oklch(65% 0.2 40)',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 6,
                  marginBottom: 12,
                }}>
                  Beta
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-ink)', marginBottom: 8, lineHeight: 1.2 }}>
                  Join the Google Tasks beta 📋
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', lineHeight: 1.6 }}>
                  Google Tasks import is in early access. Drop your email and we'll let you know when it's ready — plus you'll get early access before public launch.
                </div>
              </div>

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
                  background: loading || !email.trim() ? 'var(--color-surface2)' : 'oklch(65% 0.2 40)',
                  color: loading || !email.trim() ? 'var(--color-ink-muted)' : '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Signing up…' : 'Request early access →'}
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
