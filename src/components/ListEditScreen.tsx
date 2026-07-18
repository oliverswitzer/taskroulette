import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '../types'
import { MAX_TASKS } from '../constants'
import TaskForm from './TaskForm'

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

  const count = tasks.length
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 20px calc(80px + 32px)',
        boxSizing: 'border-box',
        maxWidth: 600,
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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

      {/* Task list — P0-2: paddingBottom so CTA doesn't obscure last item */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          paddingBottom: 'calc(80px + 32px)',
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
      </div>

      {/* Proceed CTA — fixed bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px 32px',
          background:
            'linear-gradient(to top, var(--color-base) 70%, transparent)',
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
