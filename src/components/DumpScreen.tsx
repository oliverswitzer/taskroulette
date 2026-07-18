import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'

const ONBOARDING_KEY = 'tr-photo-onboarding-seen'

interface DumpScreenProps {
  onSubmit: (dump: string, photo?: File) => void
  error?: string
  photoFile: File | null
  onPhotoChange: (file: File | null) => void
}

export default function DumpScreen({ onSubmit, error, photoFile, onPhotoChange }: DumpScreenProps) {
  const [value, setValue] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Revoke object URLs on unmount / photo change using useState so re-renders fire
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (photoFile) {
      const url = URL.createObjectURL(photoFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [photoFile])

  const { getInputProps, open } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: (files) => {
      setPhotoError(null)
      onPhotoChange(files[0] ?? null)
    },
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors[0]?.code
      if (code === 'file-too-large') {
        setPhotoError('Photo must be under 5MB')
      } else {
        setPhotoError('Unsupported file type — use JPG, PNG, or WEBP')
      }
    },
  })

  const handleAttachTap = useCallback(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true)
    } else {
      open()
    }
  }, [open])

  const handleOnboardingConfirm = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
    // Small delay so dialog fully closes before file picker opens (iOS Safari quirk)
    setTimeout(() => open(), 50)
  }, [open])

  const handleOnboardingDismiss = useCallback(() => {
    setShowOnboarding(false)
  }, [])

  const handleRemovePhoto = useCallback(() => {
    onPhotoChange(null)
    setPhotoError(null)
  }, [onPhotoChange])

  const isEmpty = value.trim().length === 0 && photoFile === null

  const handleSubmit = useCallback(() => {
    if (isEmpty) return
    onSubmit(value, photoFile ?? undefined)
  }, [isEmpty, onSubmit, value, photoFile])

  const truncateName = (name: string, max = 24) =>
    name.length <= max ? name : name.slice(0, max - 3) + '...'

  return (
    <>
      {/* react-dropzone hidden input — rendered outside visible DOM */}
      <input {...getInputProps()} />

      {/* First-time onboarding modal */}
      <Dialog open={showOnboarding} onOpenChange={(open) => { if (!open) handleOnboardingDismiss() }}>
        <DialogContent
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--rounded-xl)',
            color: 'var(--color-ink)',
            maxWidth: 400,
            padding: '28px 24px 24px',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              Parse a photo too
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-ink-muted)', fontSize: '0.9375rem', lineHeight: 1.6, marginTop: 8 }}>
              Take a photo of a sticky note, whiteboard, or handwritten list. We'll combine it with anything you've typed and find every task inside.
            </DialogDescription>
          </DialogHeader>

          {/* Example types */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 20px' }}>
            {[
              { icon: '📋', label: 'Handwritten lists' },
              { icon: '🗒️', label: 'Sticky notes' },
              { icon: '📸', label: 'Whiteboard shots' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: 'var(--color-surface2)',
                  borderRadius: 'var(--rounded-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleOnboardingConfirm}
            style={{
              width: '100%',
              padding: '14px 0',
              background: 'var(--color-accent)',
              color: 'oklch(10% 0.01 30)',
              border: 'none',
              borderRadius: 'var(--rounded-md)',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Got it, let me take a photo &rarr;
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleOnboardingDismiss}
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-ink-muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '32px 20px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 600 }}>
          {/* Wordmark */}
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent)', opacity: 0.7, textTransform: 'uppercase', marginBottom: '32px' }}>
            TaskRoulette
          </div>

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

          {/* Textarea + attach button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: 8, position: 'relative' }}
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
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--rounded-md)',
                padding: '16px 16px 52px',
                fontSize: '1rem',
                lineHeight: 1.7,
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--color-accent)'
                e.target.style.boxShadow = '0 0 0 3px oklch(72% 0.2 30 / 0.15)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--color-border)'
                e.target.style.boxShadow = 'none'
              }}
            />

            {/* Attach photo button — sits inside textarea bottom bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                right: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <button
                type="button"
                data-testid="attach-photo-btn"
                onClick={handleAttachTap}
                aria-label="Attach a photo of a task list"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--rounded-sm)',
                  color: photoFile ? 'var(--color-accent)' : 'var(--color-ink-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                  minHeight: 32,
                }}
              >
                {/* Camera SVG */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>{photoFile ? 'Change photo' : 'Add photo'}</span>
              </button>

              {/* Photo thumbnail preview */}
              {photoFile && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px 4px 4px',
                    background: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--rounded-sm)',
                    maxWidth: 160,
                  }}
                >
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Attached photo preview"
                      data-testid="photo-preview"
                      style={{
                        width: 28,
                        height: 28,
                        objectFit: 'cover',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {!previewUrl && (
                    <div
                      data-testid="photo-preview"
                      aria-label="Attached photo preview"
                      style={{
                        width: 28,
                        height: 28,
                        background: 'var(--color-border)',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-ink-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {truncateName(photoFile.name)}
                  </span>
                  <button
                    type="button"
                    data-testid="remove-photo-btn"
                    onClick={handleRemovePhoto}
                    aria-label="Remove attached photo"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-ink-muted)',
                      cursor: 'pointer',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Photo error */}
          {photoError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: '0.8125rem', color: 'oklch(65% 0.2 25)', marginBottom: 6 }}
            >
              {photoError}
            </motion.p>
          )}

          {/* Parse error */}
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
                background: isEmpty ? 'oklch(22% 0.025 260)' : 'var(--color-accent)',
                color: isEmpty ? 'oklch(55% 0.02 260)' : 'oklch(10% 0.01 30)',
                border: isEmpty ? '1.5px solid oklch(30% 0.025 260)' : '1.5px solid transparent',
                borderRadius: 'var(--rounded-lg)',
                padding: '0 32px',
                minHeight: 60,
                width: '100%',
                fontSize: '1.0625rem',
                fontWeight: 700,
                cursor: isEmpty ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                letterSpacing: '-0.01em',
              }}
            >
              Parse my tasks &rarr;
            </button>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
