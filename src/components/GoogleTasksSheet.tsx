/**
 * GoogleTasksSheet — bottom sheet for importing Google Tasks into the task list.
 *
 * Design: Enhanced bottom sheet (88% height), dot capacity meter, due-date grouped list.
 * Behavior: slides up over ListEditScreen with existing list peeking behind.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GoogleTask } from '../types'
import { useGoogleTasks } from '../hooks/useGoogleTasks'
import {
  groupTasksByBucket,
  BUCKET_ORDER,
  BUCKET_LABEL,
  filterDueSoon,
  formatDueDate,
} from '../googleTasks'
import { MAX_TASKS } from '../constants'

interface GoogleTasksSheetProps {
  isOpen: boolean
  onClose: () => void
  currentTaskCount: number
  onImport: (tasks: Pick<GoogleTask, 'id' | 'title'>[]) => void
}

const SPRING = { type: 'spring', damping: 30, stiffness: 300 } as const
const SPRING_EXIT = { type: 'spring', damping: 40, stiffness: 400 } as const

export default function GoogleTasksSheet({
  isOpen,
  onClose,
  currentTaskCount,
  onImport,
}: GoogleTasksSheetProps) {
  const { authState, tasks, isLoading, error, isMockMode, login, logout } = useGoogleTasks()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const slotsUsed = currentTaskCount + selected.size
  const slotsLeft = MAX_TASKS - slotsUsed
  const canSelectMore = slotsLeft > 0

  const toggleTask = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!canSelectMore && !next.has(id)) return prev // cap hit
        next.add(id)
      }
      return next
    })
  }, [canSelectMore])

  const handleImport = useCallback(() => {
    const toImport = tasks
      .filter(t => selected.has(t.id))
      .map(t => ({ id: t.id, title: t.title }))
    onImport(toImport)
    setSelected(new Set())
    onClose()
  }, [tasks, selected, onImport, onClose])

  const handleClose = useCallback(() => {
    setSelected(new Set())
    onClose()
  }, [onClose])

  // Build task groups for display
  const dueSoonTasks = filterDueSoon(tasks)
  const displayTasks = showAll ? tasks : dueSoonTasks
  const displayGrouped = groupTasksByBucket(displayTasks)
  const hiddenCount = tasks.length - dueSoonTasks.length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 40,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={isOpen ? SPRING : SPRING_EXIT}
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 480,
              height: '88svh',
              background: 'oklch(18% 0.025 260)',
              borderRadius: '20px 20px 0 0',
              zIndex: 41,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            data-testid="google-tasks-sheet"
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'oklch(35% 0.02 260)' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '8px 20px 12px', borderBottom: '1px solid oklch(28% 0.025 260)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'oklch(95% 0.01 260)' }}>
                  Google Tasks
                  {isMockMode && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'oklch(60% 0.02 260)', marginLeft: 8 }}>
                      (demo)
                    </span>
                  )}
                </h2>
                <button
                  onClick={handleClose}
                  style={{ background: 'none', border: 'none', color: 'oklch(60% 0.02 260)', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Dot capacity meter */}
              {authState === 'authenticated' && (
                <CapacityMeter
                  total={MAX_TASKS}
                  existing={currentTaskCount}
                  selected={selected.size}
                />
              )}
            </div>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 80px' }}>
              {authState === 'idle' && (
                <IdleState onLogin={login} isLoading={isLoading} />
              )}
              {authState === 'loading' && isLoading && (
                <LoadingState />
              )}
              {authState === 'error' && (
                <ErrorState error={error} onRetry={login} />
              )}
              {authState === 'authenticated' && (
                <>
                  {tasks.length === 0 ? (
                    <EmptyState onLogout={logout} />
                  ) : (
                    <>
                      {BUCKET_ORDER.map(bucket => {
                        const bucketTasks = displayGrouped.get(bucket) ?? []
                        if (bucketTasks.length === 0) return null
                        return (
                          <BucketSection
                            key={bucket}
                            bucket={bucket}
                            tasks={bucketTasks}
                            selected={selected}
                            onToggle={toggleTask}
                            canSelectMore={canSelectMore}
                          />
                        )
                      })}
                      {!showAll && hiddenCount > 0 && (
                        <button
                          onClick={() => setShowAll(true)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '14px 20px',
                            background: 'none',
                            border: 'none',
                            color: 'oklch(72% 0.2 30)',
                            fontSize: 14,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          Show {hiddenCount} more {hiddenCount === 1 ? 'task' : 'tasks'} →
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Sticky CTA */}
            {authState === 'authenticated' && selected.size > 0 && (
              <motion.div
                initial={{ y: 80 }}
                animate={{ y: 0 }}
                style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0,
                  padding: '12px 20px 24px',
                  background: 'oklch(18% 0.025 260)',
                  borderTop: '1px solid oklch(28% 0.025 260)',
                }}
              >
                <button
                  onClick={handleImport}
                  data-testid="google-import-btn"
                  style={{
                    width: '100%',
                    height: 56,
                    background: 'oklch(72% 0.2 30)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Add {selected.size} task{selected.size !== 1 ? 's' : ''} to wheel
                </button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CapacityMeter({ total, existing, selected }: { total: number; existing: number; selected: number }) {
  const slotsLeft = total - existing - selected
  const isWarning = slotsLeft <= 2
  const isFull = slotsLeft <= 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {Array.from({ length: total }, (_, i) => {
          const isExisting = i < existing
          const isSelected = i >= existing && i < existing + selected
          const isEmpty = !isExisting && !isSelected
          return (
            <motion.div
              key={i}
              initial={isSelected ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: isExisting
                  ? 'oklch(50% 0.02 260)'
                  : isSelected
                    ? isFull ? 'oklch(60% 0.2 15)' : 'oklch(72% 0.2 30)'
                    : 'oklch(28% 0.025 260)',
                border: isEmpty ? '1.5px solid oklch(35% 0.02 260)' : 'none',
              }}
            />
          )
        })}
      </div>
      <p style={{
        margin: 0, fontSize: 12,
        color: isFull ? 'oklch(60% 0.2 15)' : isWarning ? 'oklch(78% 0.15 65)' : 'oklch(60% 0.02 260)',
      }}>
        {isFull ? 'All 15 slots filled' : `${slotsLeft} slot${slotsLeft !== 1 ? 's' : ''} remaining`}
      </p>
    </div>
  )
}

function BucketSection({
  bucket,
  tasks,
  selected,
  onToggle,
  canSelectMore,
}: {
  bucket: string
  tasks: GoogleTask[]
  selected: Set<string>
  onToggle: (id: string) => void
  canSelectMore: boolean
}) {
  return (
    <div>
      <div style={{
        padding: '12px 20px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: bucket === 'overdue' ? 'oklch(60% 0.2 15)' : 'oklch(50% 0.02 260)',
      }}>
        {BUCKET_LABEL[bucket as keyof typeof BUCKET_LABEL]}
      </div>
      {tasks.map(task => (
        <GoogleTaskRow
          key={task.id}
          task={task}
          isSelected={selected.has(task.id)}
          disabled={!canSelectMore && !selected.has(task.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function GoogleTaskRow({
  task,
  isSelected,
  disabled,
  onToggle,
}: {
  task: GoogleTask
  isSelected: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  const due = formatDueDate(task.due)
  const isOverdue = task.due && new Date(task.due) < new Date(new Date().toDateString())

  return (
    <motion.button
      onClick={() => !disabled && onToggle(task.id)}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      data-testid={`google-task-row-${task.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 20px',
        background: isSelected ? 'oklch(72% 0.2 30 / 0.08)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid oklch(24% 0.02 260)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Checkbox */}
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        border: `2px solid ${isSelected ? 'oklch(72% 0.2 30)' : 'oklch(40% 0.02 260)'}`,
        background: isSelected ? 'oklch(72% 0.2 30)' : 'transparent',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}>
        {isSelected && (
          <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
            <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 500,
          color: 'oklch(92% 0.01 260)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {due && (
            <span style={{
              fontSize: 12,
              color: isOverdue ? 'oklch(60% 0.2 15)' : 'oklch(55% 0.02 260)',
            }}>
              {due}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'oklch(45% 0.02 260)' }}>
            {task.listTitle}
          </span>
        </div>
      </div>
    </motion.button>
  )
}

function IdleState({ onLogin, isLoading }: { onLogin: () => void; isLoading: boolean }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'oklch(95% 0.01 260)' }}>
        Import from Google Tasks
      </h3>
      <p style={{ margin: '0 0 28px', fontSize: 14, color: 'oklch(60% 0.02 260)', lineHeight: 1.5 }}>
        Connect your Google account to pull in tasks you already have, so you can add them to your spin wheel without retyping.
      </p>
      <button
        onClick={onLogin}
        disabled={isLoading}
        data-testid="google-login-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          width: '100%',
          height: 52,
          background: '#fff',
          color: '#1f1f1f',
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
        </svg>
        {isLoading ? 'Connecting…' : 'Connect Google Tasks'}
      </button>
      <p style={{ margin: '12px 0 0', fontSize: 12, color: 'oklch(45% 0.02 260)' }}>
        Read-only access · Never modifies your tasks
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center', color: 'oklch(60% 0.02 260)' }}>
      Loading your tasks…
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ color: 'oklch(65% 0.2 15)', marginBottom: 16 }}>
        {error ?? 'Something went wrong'}
      </p>
      <button onClick={onRetry} style={{ padding: '10px 24px', background: 'oklch(72% 0.2 30)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  )
}

function EmptyState({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <p style={{ color: 'oklch(60% 0.02 260)', marginBottom: 16 }}>
        No incomplete tasks found in Google Tasks.
      </p>
      <button onClick={onLogout} style={{ fontSize: 13, color: 'oklch(55% 0.02 260)', background: 'none', border: 'none', cursor: 'pointer' }}>
        Disconnect Google
      </button>
    </div>
  )
}


