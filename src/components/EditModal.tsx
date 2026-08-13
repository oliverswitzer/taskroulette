import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task, AppendResult } from '../types'
import { MAX_TASKS } from '../constants'
import TaskForm from './TaskForm'
import BrainDumpForm from './BrainDumpForm'

type EditMode = 'quick' | 'dump'

interface EditModalProps {
  isOpen: boolean
  tasks: Task[]
  onAddTask: (text: string) => void
  onEditTask: (id: string, text: string) => void
  onDeleteTask: (id: string) => void
  onClose: () => void
  canAddMore: boolean
  // ── Brain-dump (append) mode ──
  onAppendDump: (dump: string, photo?: File) => Promise<AppendResult>
  appendLoading?: boolean
  appendError?: string
  appendResetSignal?: number
  appendToast?: string | null
  dumpPhoto: File | null
  onDumpPhotoChange: (file: File | null) => void
}

export default function EditModal({
  isOpen,
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onClose,
  canAddMore,
  onAppendDump,
  appendLoading = false,
  appendError,
  appendResetSignal = 0,
  appendToast,
  dumpPhoto,
  onDumpPhotoChange,
}: EditModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [mode, setMode] = useState<EditMode>('quick')

  const handleEdit = useCallback(
    (id: string, text: string) => {
      onEditTask(id, text)
      setEditingId(null)
    },
    [onEditTask]
  )

  const handleDelete = useCallback(
    (id: string) => {
      onDeleteTask(id)
      setEditingId(null)
    },
    [onDeleteTask]
  )

  const handleAdd = useCallback(
    (text: string) => {
      onAddTask(text)
      setShowAddForm(false)
    },
    [onAddTask]
  )

  const handleClose = useCallback(() => {
    setEditingId(null)
    setShowAddForm(false)
    // Always reopen in Quick add mode — don't leave the sheet stuck in whatever
    // mode it was last closed in.
    setMode('quick')
    onClose()
  }, [onClose])

  // Belt-and-suspenders: if the sheet is closed from outside (backdrop tap
  // handled above, but also parent-driven isOpen=false), reset the mode too.
  useEffect(() => {
    if (!isOpen) setMode('quick')
  }, [isOpen])

  // Active tasks stay on top; completed tasks sink to the bottom.
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed === b.completed) return 0
    return a.completed ? 1 : -1
  })

  const activeCount = tasks.filter(t => !t.completed).length
  const isWarning = activeCount >= MAX_TASKS - 1
  const roomLeft = Math.max(0, MAX_TASKS - activeCount)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 50,
            }}
          />

          {/* Bottom sheet */}
          <motion.div
            key="modal-sheet"
            data-testid="edit-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '90vh',
              background: 'var(--color-surface)',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              zIndex: 51,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0 4px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 'var(--rounded-full)',
                  background: 'var(--color-border)',
                }}
              />
            </div>

            {/* Content */}
            <div style={{ padding: '12px 20px 0', flex: 1, overflowY: 'auto' }}>
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    flex: 1,
                  }}
                >
                  Edit your tasks
                </h2>
                <span
                  data-testid="edit-modal-count"
                  style={{
                    background: isWarning ? 'oklch(25% 0.08 30)' : 'oklch(20% 0.05 30)',
                    color: isWarning ? 'var(--color-accent-glow)' : 'var(--color-accent)',
                    border: isWarning ? '1px solid oklch(40% 0.12 30)' : '1px solid oklch(35% 0.1 30)',
                    borderRadius: 'var(--rounded-full)',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {activeCount}/{MAX_TASKS}
                </span>
              </div>

              {/* Segmented mode toggle — Quick add / Brain dump */}
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
                <ModeTab
                  testId="edit-mode-quick"
                  label="Quick add"
                  active={mode === 'quick'}
                  onClick={() => setMode('quick')}
                />
                <ModeTab
                  testId="edit-mode-dump"
                  label="Brain dump"
                  active={mode === 'dump'}
                  onClick={() => setMode('dump')}
                />
              </div>

              {mode === 'dump' ? (
                /* ── Brain dump (append) mode ─────────────────────────────── */
                <div style={{ marginBottom: 16 }}>
                  {/* Explainer — makes it unmistakable that this ADDS, not replaces */}
                  <p
                    data-testid="brain-dump-explainer"
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-ink-muted)',
                      lineHeight: 1.55,
                      margin: '0 0 6px',
                    }}
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
                    submitLabel="Add to wheel &rarr;"
                    loadingLabel="Adding to your wheel\u2026"
                    loading={appendLoading}
                    error={appendError}
                    currentTaskCount={activeCount}
                    photoFile={dumpPhoto}
                    onPhotoChange={onDumpPhotoChange}
                    resetSignal={appendResetSignal}
                    placeholder="Anything else on your mind? Emails, calls, errands.. just get it out. We'll sort it and add it to your wheel."
                  />
                </div>
              ) : (
                /* ── Quick add mode (existing single-line list editor) ────── */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <AnimatePresence initial={false}>
                    {sortedTasks.map(taskItem => (
                      <motion.div
                        key={taskItem.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16, scale: 0.97 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        layout
                      >
                        {editingId === taskItem.id ? (
                          <div
                            style={{
                              background: 'var(--color-surface2)',
                              borderRadius: 'var(--rounded-md)',
                              padding: 16,
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            <TaskForm
                              mode="edit"
                              initialValue={taskItem.text}
                              onSubmit={text => handleEdit(taskItem.id, text)}
                              onDelete={() => handleDelete(taskItem.id)}
                              onCancel={() => setEditingId(null)}
                              submitLabel="Save changes"
                            />
                          </div>
                        ) : (
                          <ModalTaskItem
                            task={taskItem}
                            onEdit={() => setEditingId(taskItem.id)}
                            onDelete={() => handleDelete(taskItem.id)}
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add form */}
                  <AnimatePresence>
                    {showAddForm && (
                      <motion.div
                        key="add-form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          background: 'var(--color-surface2)',
                          borderRadius: 'var(--rounded-md)',
                          padding: 16,
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <TaskForm
                          mode="add"
                          onSubmit={handleAdd}
                          onCancel={() => setShowAddForm(false)}
                          submitLabel="Add task"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Add more button */}
                  {canAddMore && !showAddForm && !editingId && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--color-border)',
                        borderRadius: 'var(--rounded-md)',
                        padding: '12px 20px',
                        minHeight: 48,
                        width: '100%',
                        fontSize: '0.9rem',
                        color: 'var(--color-ink-muted)',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      + Add task
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Done button — sticky footer */}
            <div
              style={{
                padding: '16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
                borderTop: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'var(--color-accent)',
                  color: 'oklch(10% 0.01 30)',
                  border: 'none',
                  borderRadius: 'var(--rounded-lg)',
                  padding: '0 40px',
                  minHeight: 56,
                  width: '100%',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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

interface ModalTaskItemProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
}

function ModalTaskItem({ task, onEdit, onDelete }: ModalTaskItemProps) {
  return (
    <div
      data-testid="edit-modal-task"
      data-completed={task.completed ? 'true' : 'false'}
      style={{
        background: 'var(--color-surface2)',
        borderRadius: 'var(--rounded-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid var(--color-border)',
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: '0.9375rem',
          lineHeight: 1.5,
          color: task.completed ? 'oklch(55% 0.015 260)' : 'var(--color-ink)',
          textDecoration: task.completed ? 'line-through' : 'none',
          wordBreak: 'break-word',
        }}
      >
        {task.text}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit: ${task.text}`}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--rounded-sm)',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'oklch(65% 0.02 260)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete: ${task.text}`}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--rounded-sm)',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'oklch(65% 0.02 260)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
