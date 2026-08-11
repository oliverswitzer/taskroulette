import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task, GoogleTask } from '../types'
import { MAX_TASKS } from '../constants'
import TaskForm from './TaskForm'
import GoogleTasksSheet from './GoogleTasksSheet'

interface ListEditScreenProps {
  tasks: Task[]
  onAddTask: (text: string) => void
  onEditTask: (id: string, text: string) => void
  onDeleteTask: (id: string) => void
  onProceed: () => void
  canAddMore: boolean
}

export default function ListEditScreen({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onProceed,
  canAddMore,
}: ListEditScreenProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGoogleSheet, setShowGoogleSheet] = useState(false)

  const count = tasks.filter(t => !t.completed).length
  const isWarning = count >= MAX_TASKS - 1
  const canProceed = count >= 1 && count <= MAX_TASKS

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

  const handleGoogleImport = useCallback(
    (googleTasks: Pick<GoogleTask, 'id' | 'title'>[]) => {
      const activeCount = tasks.filter(t => !t.completed).length
      const slotsLeft = MAX_TASKS - activeCount
      googleTasks.slice(0, slotsLeft).forEach(t => onAddTask(t.title))
    },
    [tasks, onAddTask]
  )

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        // Fixed to the viewport height (not just minHeight) — the page/window
        // itself must never scroll. The task list below has its own internal
        // scroll region so all tasks stay reachable without moving the page.
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 20px 0',
        boxSizing: 'border-box',
        maxWidth: 600,
        margin: '0 auto',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header — fixed within the flex column, never scrolls */}
      <div style={{ marginBottom: 32, flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
            }}
          >
            Your tasks
          </h1>
          {/* P1-5: Energized badge */}
          <span
            data-warning={isWarning ? 'true' : 'false'}
            style={{
              background: isWarning
                ? 'oklch(25% 0.08 30)'
                : 'oklch(20% 0.05 30)',
              color: isWarning ? 'var(--color-accent-glow)' : 'var(--color-accent)',
              border: isWarning
                ? '1px solid oklch(40% 0.12 30)'
                : '1px solid oklch(35% 0.1 30)',
              borderRadius: 'var(--rounded-full)',
              padding: '4px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              transition: 'background 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {count}/{MAX_TASKS}
          </span>
        </div>
        <p
          style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--color-ink-muted)',
          }}
        >
          Edit anything that doesn&apos;t feel right. Then spin the wheel.
        </p>
      </div>

      {/* Task list — internal scroll region ONLY. This is what makes all
          tasks reachable without the page/window itself ever scrolling —
          overflowY:auto is scoped to just this box, bounded by the fixed
          header above and fixed CTA below. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          paddingBottom: 16,
          minHeight: 0,
        }}
      >
        <AnimatePresence initial>
          {tasks.map((taskItem, i) => (
            <motion.div
              key={taskItem.id}
              data-testid="task-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16, scale: 0.97 }}
              transition={{
                duration: 0.28,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              layout
            >
              {editingId === taskItem.id ? (
                <div
                  style={{
                    background: 'var(--color-surface)',
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
                    placeholder="What's the task?"
                  />
                </div>
              ) : (
                <TaskCard
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
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'var(--color-surface)',
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
                placeholder="What else needs doing?"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add task button */}
        {canAddMore && !showAddForm && (
          <motion.button
            type="button"
            onClick={() => setShowAddForm(true)}
            aria-label="+ Add another task"
            whileTap={{ scale: 0.98 }}
            style={{
              background: 'transparent',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--rounded-md)',
              padding: '14px 20px',
              minHeight: 52,
              width: '100%',
              fontSize: '0.9375rem',
              color: 'var(--color-ink-muted)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'border-color 0.18s ease, color 0.18s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--color-accent)'
              el.style.color = 'var(--color-ink)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--color-border)'
              el.style.color = 'var(--color-ink-muted)'
            }}
          >
            + Add another task
          </motion.button>
        )}

        {/* Google Tasks import button — shown when below cap */}
        {count < MAX_TASKS && (
          <div style={{ position: 'relative', width: '100%' }}>
            <motion.button
              type="button"
              onClick={() => setShowGoogleSheet(true)}
              aria-label="Import from Google Tasks"
              data-testid="google-tasks-btn"
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'transparent',
                border: '1px solid oklch(28% 0.025 260)',
                borderRadius: 'var(--rounded-md)',
                padding: '12px 20px',
                minHeight: 48,
                width: '100%',
                fontSize: '0.875rem',
                color: 'oklch(60% 0.02 260)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              Import from Google Tasks
            </motion.button>
          </div>
        )}
      </div>

      {/* Proceed CTA — a normal flex child (NOT position:fixed). Fixed
          positioning floated this bar OVER whatever list content happened
          to be at the bottom of the viewport at scrollTop=0 — the list's
          paddingBottom only extended scroll range, it didn't stop the
          overlay from visually covering unscrolled items (edit/delete
          icons on the last visible task got clipped under the button).
          As a real flex-column sibling with flexShrink:0, it reserves its
          own space and the list naturally ends above it. */}
      <div
        style={{
          flexShrink: 0,
          padding: '16px 20px 32px',
          background: 'var(--color-base)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          type="button"
          onClick={onProceed}
          disabled={!canProceed}
          aria-label="Let's spin"
          style={{
            background: canProceed ? 'var(--color-accent)' : 'var(--color-surface2)',
            color: canProceed ? 'oklch(10% 0.01 30)' : 'var(--color-ink-muted)',
            border: 'none',
            borderRadius: 'var(--rounded-lg)',
            padding: '0 40px',
            minHeight: 60,
            width: '100%',
            maxWidth: 560,
            fontSize: '1.0625rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          Let&apos;s spin &rarr;
        </button>
      </div>
    </motion.div>

      {/* Google Tasks bottom sheet — rendered outside scroll container */}
      <GoogleTasksSheet
        isOpen={showGoogleSheet}
        onClose={() => setShowGoogleSheet(false)}
        currentTaskCount={count}
        onImport={handleGoogleImport}
      />

    </>
  )
}

interface TaskCardProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
}

function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--rounded-md)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid var(--color-border)',
      }}
    >
      {/* P1-2: Show ONLY task text, no numbering prefix */}
      <span
        style={{
          flex: 1,
          fontSize: '0.9375rem',
          lineHeight: 1.55,
          color: 'var(--color-ink)',
          wordBreak: 'break-word',
        }}
      >
        {task.text}
      </span>
      {/* P1-4: Higher contrast icon buttons with 44x44 touch targets */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit task: ${task.text}`}
          title="Edit"
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
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.color = 'oklch(90% 0.01 260)'
            el.style.background = 'var(--color-surface2)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.color = 'oklch(65% 0.02 260)'
            el.style.background = 'transparent'
          }}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete task: ${task.text}`}
          title="Delete"
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
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.color = 'oklch(65% 0.2 25)'
            el.style.background = 'oklch(25% 0.04 25 / 0.4)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.color = 'oklch(65% 0.02 260)'
            el.style.background = 'transparent'
          }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
