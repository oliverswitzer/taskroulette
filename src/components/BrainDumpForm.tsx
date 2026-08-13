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
import GoogleTasksSheet from './GoogleTasksSheet'
import type { GoogleTask } from '../types'

const ONBOARDING_KEY = 'tr-photo-onboarding-seen'

/**
 * BrainDumpForm — the shared "dump it all out" input surface: a free-text
 * textarea, photo attach (react-dropzone + Claude vision), and Google Tasks
 * import. Extracted from DumpScreen so it can be reused inside the wheel's
 * edit sheet (mid-session brain dump) without duplicating the
 * textarea/photo/Google-Tasks logic.
 *
 * IMPORTANT: this is ONLY the input surface — no page chrome, no heading, no
 * motion page-transition wrapper. Callers provide their own layout around it.
 *
 * The photo onboarding Dialog is gated behind `enablePhotoOnboarding` (default
 * false) so it only fires on the first-run DUMP screen — never nested inside a
 * bottom sheet, where a dialog-inside-a-sheet is a known mobile layout trap.
 */
interface BrainDumpFormProps {
  /** Called with the dump text (and optional photo) when the user submits. */
  onSubmit: (dump: string, photo?: File) => void
  /** Submit-button label. Use append-oriented copy in the edit sheet. */
  submitLabel: string
  /** Textarea placeholder. */
  placeholder?: string
  /** Optional helper line rendered directly under the textarea. */
  helperText?: string
  /** Active task count — passed to Google import so its cap math is correct. */
  currentTaskCount?: number
  /** Parse error text to surface (owned by the caller). */
  error?: string
  /** When true, disables submit and shows a busy label — caller drives this. */
  loading?: boolean
  /** Busy-state label shown on the CTA while `loading`. */
  loadingLabel?: string
  /** Lifted photo state so it can survive a parent transition if needed. */
  photoFile: File | null
  onPhotoChange: (file: File | null) => void
  /** First-run photo onboarding modal — only the DUMP screen should enable it. */
  enablePhotoOnboarding?: boolean
  /**
   * Bumping this integer clears the textarea + photo. Parents increment it
   * AFTER a successful submit so a failed parse preserves the user's input.
   */
  resetSignal?: number
}

export default function BrainDumpForm({
  onSubmit,
  submitLabel,
  placeholder = 'Just type it all out.. emails to send, calls to make, things you\u2019ve been avoiding.. all of it. Don\u2019t worry about order or categories.',
  helperText,
  currentTaskCount = 0,
  error,
  loading = false,
  loadingLabel = 'Adding\u2026',
  photoFile,
  onPhotoChange,
  enablePhotoOnboarding = false,
  resetSignal = 0,
}: BrainDumpFormProps) {
  const [value, setValue] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showGoogleSheet, setShowGoogleSheet] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Clear the form when the parent bumps resetSignal (i.e. after a successful
  // submit). Skipped on initial mount (resetSignal starts at 0).
  useEffect(() => {
    if (resetSignal === 0) return
    setValue('')
    onPhotoChange(null)
    setPhotoError(null)
  }, [resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URLs on unmount / photo change using state so re-renders fire.
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
    onDropAccepted: files => {
      setPhotoError(null)
      onPhotoChange(files[0] ?? null)
    },
    onDropRejected: rejections => {
      const code = rejections[0]?.errors[0]?.code
      if (code === 'file-too-large') {
        setPhotoError('Photo must be under 5MB')
      } else {
        setPhotoError('Unsupported file type \u2014 use JPG, PNG, or WEBP')
      }
    },
  })

  const handleAttachTap = useCallback(() => {
    if (enablePhotoOnboarding && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true)
    } else {
      open()
    }
  }, [enablePhotoOnboarding, open])

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

  // Append selected Google Tasks as freeform newline-separated text into the
  // textarea — these get parsed by Claude alongside anything else typed.
  const handleGoogleImport = useCallback((googleTasks: Pick<GoogleTask, 'id' | 'title'>[]) => {
    if (googleTasks.length === 0) return
    setValue(prev => prev + (prev.trim() ? '\n' : '') + googleTasks.map(t => t.title).join('\n'))
  }, [])

  const isEmpty = value.trim().length === 0 && photoFile === null
  const canSubmit = !isEmpty && !loading

  const handleSubmit = useCallback(() => {
    if (isEmpty || loading) return
    onSubmit(value, photoFile ?? undefined)
  }, [isEmpty, loading, onSubmit, value, photoFile])

  const truncateName = (name: string, max = 24) =>
    name.length <= max ? name : name.slice(0, max - 3) + '...'

  return (
    <>
      {/* react-dropzone hidden input */}
      <input {...getInputProps()} />

      {/* First-time onboarding modal — only when enabled (DUMP screen) */}
      {enablePhotoOnboarding && (
        <Dialog open={showOnboarding} onOpenChange={o => { if (!o) handleOnboardingDismiss() }}>
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
                Take a photo of a sticky note, whiteboard, or handwritten list. We&apos;ll combine it with anything you&apos;ve typed and find every task inside.
              </DialogDescription>
            </DialogHeader>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 20px' }}>
              {[
                { icon: '\uD83D\uDCCB', label: 'Handwritten lists' },
                { icon: '\uD83D\uDDD2\uFE0F', label: 'Sticky notes' },
                { icon: '\uD83D\uDCF8', label: 'Whiteboard shots' },
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
      )}

      {/* Textarea + attach bar */}
      <div style={{ marginBottom: 8, position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={loading}
          placeholder={placeholder}
          rows={7}
          style={{
            width: '100%',
            minHeight: 160,
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
            opacity: loading ? 0.6 : 1,
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

        {/* Attach photo + Google Tasks buttons — inside textarea bottom bar */}
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
            disabled={loading}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s ease',
              minHeight: 32,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>{photoFile ? 'Change photo' : 'Add photo'}</span>
          </button>

          <button
            type="button"
            data-testid="add-google-tasks-btn"
            onClick={() => setShowGoogleSheet(true)}
            disabled={loading}
            aria-label="Add tasks from Google Tasks"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: 'var(--color-surface2)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--rounded-sm)',
              color: 'var(--color-ink-muted)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s ease',
              minHeight: 32,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            <span>Add Google Tasks</span>
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
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Attached photo preview"
                  data-testid="photo-preview"
                  style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div
                  data-testid="photo-preview"
                  aria-label="Attached photo preview"
                  style={{ width: 28, height: 28, background: 'var(--color-border)', borderRadius: 4, flexShrink: 0 }}
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
      </div>

      {/* Helper text — makes append semantics unmistakable in the sheet */}
      {helperText && (
        <p
          data-testid="brain-dump-helper"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-ink-muted)',
            lineHeight: 1.5,
            margin: '0 0 10px',
          }}
        >
          {helperText}
        </p>
      )}

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
          style={{ fontSize: '0.875rem', color: 'oklch(65% 0.2 25)', marginBottom: 8 }}
        >
          {error}
        </motion.p>
      )}

      {/* Submit CTA */}
      <button
        type="button"
        data-testid="brain-dump-submit"
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label={submitLabel}
        style={{
          background: canSubmit ? 'var(--color-accent)' : 'oklch(22% 0.025 260)',
          color: canSubmit ? 'oklch(10% 0.01 30)' : 'oklch(55% 0.02 260)',
          border: canSubmit ? '1.5px solid transparent' : '1.5px solid oklch(30% 0.025 260)',
          borderRadius: 'var(--rounded-lg)',
          padding: '0 32px',
          minHeight: 60,
          width: '100%',
          fontSize: '1.0625rem',
          fontWeight: 700,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          letterSpacing: '-0.01em',
        }}
      >
        {loading ? loadingLabel : submitLabel}
      </button>

      <GoogleTasksSheet
        isOpen={showGoogleSheet}
        onClose={() => setShowGoogleSheet(false)}
        currentTaskCount={currentTaskCount}
        onImport={handleGoogleImport}
      />
    </>
  )
}
