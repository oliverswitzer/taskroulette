import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MAX_TASK_LENGTH } from '../constants'

const CHAR_COUNT_THRESHOLD = 60

interface TaskFormProps {
  mode: 'add' | 'edit'
  initialValue?: string
  onSubmit: (text: string) => void
  onDelete?: () => void
  onCancel?: () => void
  submitLabel?: string
  placeholder?: string
  disabled?: boolean
}

export default function TaskForm({
  mode,
  initialValue = '',
  onSubmit,
  onDelete,
  onCancel,
  submitLabel,
  placeholder = 'What needs doing?',
  disabled = false,
}: TaskFormProps) {
  const [value, setValue] = useState(initialValue)

  const trimmed = value.trim()
  const isOverLimit = trimmed.length > MAX_TASK_LENGTH
  const showCharCount = value.length > CHAR_COUNT_THRESHOLD
  const canSubmit = trimmed.length > 0 && !isOverLimit && !disabled

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    onSubmit(trimmed)
    if (mode === 'add') setValue('')
  }, [canSubmit, onSubmit, trimmed, mode])

  const defaultSubmitLabel = mode === 'add' ? 'Add task' : 'Save changes'
  const label = submitLabel ?? defaultSubmitLabel

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          role="textbox"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          aria-invalid={isOverLimit ? 'true' : 'false'}
          aria-label={mode === 'add' ? 'New task' : 'Edit task'}
          style={{
            width: '100%',
            background: 'var(--color-surface)',
            color: 'var(--color-ink)',
            border: `1px solid ${isOverLimit ? 'oklch(65% 0.2 25)' : 'var(--color-border)'}`,
            borderRadius: 'var(--rounded-md)',
            padding: '14px 16px',
            fontSize: '1rem',
            lineHeight: '1.6',
            outline: 'none',
            transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxSizing: 'border-box',
          }}
          onFocus={e => {
            if (!isOverLimit) {
              e.target.style.borderColor = 'var(--color-accent)'
            }
          }}
          onBlur={e => {
            e.target.style.borderColor = isOverLimit ? 'oklch(65% 0.2 25)' : 'var(--color-border)'
          }}
        />
        <AnimatePresence>
          {showCharCount && (
            <motion.span
              key="char-count"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isOverLimit ? 'oklch(65% 0.2 25)' : 'var(--color-ink-muted)',
                pointerEvents: 'none',
                letterSpacing: '0.02em',
              }}
            >
              {trimmed.length}/{MAX_TASK_LENGTH}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {isOverLimit && (
          <motion.p
            key="error-msg"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="alert"
            style={{
              fontSize: '0.8125rem',
              color: 'oklch(65% 0.2 25)',
              margin: '-4px 0 0',
            }}
          >
            Task too long — keep it under {MAX_TASK_LENGTH} characters
          </motion.p>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <button
        type="button"
        data-submit
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          background: canSubmit ? 'var(--color-accent)' : 'var(--color-surface2)',
          color: canSubmit ? 'oklch(10% 0.01 30)' : 'var(--color-ink-muted)',
          border: 'none',
          borderRadius: 'var(--rounded-lg)',
          padding: '0 32px',
          minHeight: 54,
          width: '100%',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {label}
      </button>

      {/* Delete button (edit mode only) */}
      {mode === 'edit' && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete task"
          style={{
            background: 'transparent',
            color: 'var(--color-ink-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--rounded-md)',
            padding: '10px 16px',
            minHeight: 44,
            width: '100%',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          Delete task
        </button>
      )}

      {/* Cancel link */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: 'var(--color-ink-muted)',
            border: 'none',
            padding: '6px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            transition: 'text-decoration-color 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.textDecorationColor = 'var(--color-ink-muted)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.textDecorationColor = 'transparent'
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
