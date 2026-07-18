import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface DumpScreenProps {
  onSubmit: (dump: string) => void
  error?: string
}

export default function DumpScreen({ onSubmit, error }: DumpScreenProps) {
  const [value, setValue] = useState('')

  const isEmpty = value.trim().length === 0

  const handleSubmit = useCallback(() => {
    if (isEmpty) return
    onSubmit(value)
  }, [isEmpty, onSubmit, value])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '32px 20px',
        boxSizing: 'border-box',
        maxWidth: 600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: 'var(--color-ink)',
          marginBottom: 12,
          textWrap: 'balance',
        } as React.CSSProperties}
      >
        What&apos;s swirling around in your head?
      </motion.h1>

      {/* Subheading */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontSize: '1.0625rem',
          lineHeight: 1.6,
          color: 'var(--color-ink-muted)',
          marginBottom: 32,
          maxWidth: '50ch',
        }}
      >
        No lists, no formats, no pressure. Just let it all out. We&apos;ll sort it for you.
      </motion.p>

      {/* Textarea */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginBottom: 8 }}
      >
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Just type it all out.. emails to send, calls to make, things you've been avoiding.. all of it. Don't worry about order or categories."
          rows={7}
          style={{
            width: '100%',
            minHeight: 200,
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '16px',
            fontSize: '1rem',
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--color-accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--color-border)' }}
        />
      </motion.div>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          style={{
            fontSize: '0.875rem',
            color: 'oklch(65% 0.2 25)',
            marginBottom: 8,
          }}
        >
          {error}
        </motion.p>
      )}

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ marginTop: 4 }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isEmpty}
          aria-label="Parse my tasks"
          style={{
            background: isEmpty ? 'var(--color-surface2)' : 'var(--color-accent)',
            color: isEmpty ? 'var(--color-ink-muted)' : 'oklch(10% 0.01 30)',
            border: 'none',
            borderRadius: 'var(--rounded-lg)',
            padding: '0 32px',
            minHeight: 60,
            width: '100%',
            fontSize: '1.0625rem',
            fontWeight: 700,
            cursor: isEmpty ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            letterSpacing: '-0.01em',
          }}
        >
          Parse my tasks &rarr;
        </button>
      </motion.div>
    </motion.div>
  )
}
