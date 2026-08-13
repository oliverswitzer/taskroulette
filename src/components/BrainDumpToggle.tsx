import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AppendResult } from '../types'
import { MAX_TASKS } from '../constants'
import BrainDumpForm from './BrainDumpForm'

type EditMode = 'quick' | 'dump'

/**
 * BrainDumpToggle — the shared "Quick add / Brain dump" surface used in BOTH
 * the initial task-edit page (ListEditScreen) and the wheel's edit sheet
 * (EditModal). It owns ONLY the segmented tab chrome + the brain-dump (append)
 * panel; each caller supplies its own quick-add content via `children`.
 *
 * Why a slot instead of identical markup: the two contexts differ in what
 * "quick add" means visually —
 *   - EditModal: the quick tab shows the whole task list (edit/delete each) +
 *     an inline add form, because the sheet has no room to show both at once.
 *   - ListEditScreen: the task list is always visible on the page, so the quick
 *     tab only needs the inline "+ add / Google import" affordances.
 * Same functionality, same append behavior, one component — the presentation
 * difference lives entirely in the caller-supplied children.
 *
 * Mode is local state defaulting to 'quick'. Callers that unmount on close
 * (EditModal's AnimatePresence) get a fresh 'quick' default automatically on
 * reopen; callers that stay mounted can force a reset by bumping `modeResetSignal`.
 */
interface BrainDumpToggleProps {
  /** Quick-add tab content, supplied by the caller. */
  children: React.ReactNode
  /** Active (non-completed) task count — drives capacity + Google import cap. */
  activeCount: number
  /** Append handler (App.handleAppendDump). Merges parsed tasks in place. */
  onAppendDump: (dump: string, photo?: File) => Promise<AppendResult>
  appendLoading?: boolean
  appendError?: string
  appendResetSignal?: number
  appendToast?: string | null
  dumpPhoto: File | null
  onDumpPhotoChange: (file: File | null) => void
  /** CTA label for the brain-dump submit button. */
  submitLabel?: string
  /** Bump to force the toggle back to the Quick add tab. */
  modeResetSignal?: number
  /** Label for the quick-add tab (default "Quick add"). */
  quickLabel?: string
}

export default function BrainDumpToggle({
  children,
  activeCount,
  onAppendDump,
  appendLoading = false,
  appendError,
  appendResetSignal = 0,
  appendToast,
  dumpPhoto,
  onDumpPhotoChange,
  submitLabel = 'Add to list \u2192',
  modeResetSignal = 0,
  quickLabel = 'Quick add',
}: BrainDumpToggleProps) {
  const [mode, setMode] = useState<EditMode>('quick')
  const [lastReset, setLastReset] = useState(modeResetSignal)

  // Reset to Quick add when the caller bumps modeResetSignal (render-time sync,
  // no effect needed — avoids a flash of the previous tab).
  if (modeResetSignal !== lastReset) {
    setLastReset(modeResetSignal)
    if (mode !== 'quick') setMode('quick')
  }

  const roomLeft = Math.max(0, MAX_TASKS - activeCount)

  return (
    <div>
      {/* Segmented mode toggle */}
      <div
        role="tablist"
        aria-label="Add mode"
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: 'var(--color-surface2)',
          borderRadius: 'var(--rounded-md)',
          marginBottom: 14,
        }}
      >
        <ModeTab testId="edit-mode-quick" label={quickLabel} active={mode === 'quick'} onClick={() => setMode('quick')} />
        <ModeTab testId="edit-mode-dump" label="Brain dump" active={mode === 'dump'} onClick={() => setMode('dump')} />
      </div>

      {mode === 'dump' ? (
        <div>
          {/* Explainer — makes append (not replace) unmistakable */}
          <p
            data-testid="brain-dump-explainer"
            style={{ fontSize: '0.875rem', color: 'var(--color-ink-muted)', lineHeight: 1.55, margin: '0 0 6px' }}
          >
            Dump anything new that popped into your head — type it, snap a photo, or pull from Google Tasks. It all gets <strong style={{ color: 'var(--color-ink)', fontWeight: 700 }}>added to your current list</strong>. Nothing gets replaced.
          </p>
          {/* Live capacity */}
          <p
            data-testid="brain-dump-capacity"
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: roomLeft === 0 ? 'oklch(65% 0.2 25)' : 'var(--color-ink-muted)',
              margin: '0 0 12px',
            }}
          >
            {roomLeft === 0
              ? `You're at the ${MAX_TASKS}-task limit`
              : `${activeCount}/${MAX_TASKS} tasks — room for ${roomLeft} more`}
          </p>

          {/* Success / overflow toast */}
          <AnimatePresence>
            {appendToast && (
              <motion.p
                key="append-toast"
                data-testid="brain-dump-toast"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="status"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-success)',
                  background: 'oklch(28% 0.08 145)',
                  border: '1px solid oklch(40% 0.1 145)',
                  borderRadius: 'var(--rounded-md)',
                  padding: '10px 12px',
                  margin: '0 0 12px',
                }}
              >
                {appendToast}
              </motion.p>
            )}
          </AnimatePresence>

          <BrainDumpForm
            onSubmit={onAppendDump}
            submitLabel={submitLabel}
            loadingLabel="Adding\u2026"
            loading={appendLoading}
            error={appendError}
            currentTaskCount={activeCount}
            photoFile={dumpPhoto}
            onPhotoChange={onDumpPhotoChange}
            resetSignal={appendResetSignal}
            placeholder="Anything else on your mind? Emails, calls, errands.. just get it out. We'll sort it and add it to your list."
          />
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function ModeTab({
  testId,
  label,
  active,
  onClick,
}: {
  testId: string
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      data-testid={testId}
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 0',
        background: active ? 'var(--color-surface)' : 'transparent',
        border: active ? '1px solid var(--color-border)' : '1px solid transparent',
        borderRadius: 'var(--rounded-sm)',
        color: active ? 'var(--color-ink)' : 'var(--color-ink-muted)',
        fontSize: '0.875rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {label}
    </button>
  )
}
