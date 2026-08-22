import { useState, useEffect, useCallback, useRef } from 'react'
import { useHistoryNav } from './hooks/useHistoryNav'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Analytics } from '@vercel/analytics/react'
import type { AppState, Task } from './types'
import DumpScreen from './components/DumpScreen'
import ParsingScreen from './components/ParsingScreen'
import ListEditScreen from './components/ListEditScreen'
import WheelScreen from './components/WheelScreen'
import TaskCard from './components/TaskCard'
import EditModal from './components/EditModal'
import AllDoneScreen from './components/AllDoneScreen'
import AppLayout from './components/AppLayout'
import PencilIcon from './components/PencilIcon'
import { parseTasks, parseTasksFromImage, getSessionStatus, recordSessionComplete } from './api'
import type { AppendResult } from './types'
import EmailGateModal from './components/EmailGateModal'
import {
  saveTasks,
  loadTasks,
  saveAppState,
  loadAppState,
  saveSelectedTask,
  loadSelectedTask,
  clearAll,
} from './storage'
import { MAX_TASKS } from './constants'
import { generateId } from './lib/id'

// Expose state setters for Playwright testing
declare global {
  interface Window {
    __setAppState: (state: AppState) => void
    __setTasks: (tasks: Task[]) => void
    __setCompletedCount?: (count: number) => void
  }
}

// Page transition variants (used by all screens except task card)
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
const pageTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }

// Task card slides up from the bottom — no page-swap flash
const taskCardVariants = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
}
const taskCardTransition = { type: 'spring' as const, stiffness: 380, damping: 42 }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [sessionLimitMsg, setSessionLimitMsg] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)

  // Restore TASK_CARD state: check if there's a persisted selected task
  const [appState, setAppState] = useState<AppState>(() => {
    const saved = loadAppState() as AppState | null
    if (saved === 'TASK_CARD') {
      // Only valid if a selectedTaskId exists in storage AND that task is in the task list
      const sel = loadSelectedTask()
      const allTasks = loadTasks()
      const found = sel && allTasks.find(t => t.id === sel.taskId && !t.completed)
      return found ? 'TASK_CARD' : 'WHEEL_IDLE'
    }
    return saved ?? 'DUMP'
  })

  const [selectedTask, setSelectedTask] = useState<Task | null>(() => {
    const sel = loadSelectedTask()
    if (!sel) return null
    const allTasks = loadTasks()
    return allTasks.find(t => t.id === sel.taskId && !t.completed) ?? null
  })

  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => {
    const sel = loadSelectedTask()
    if (!sel) return null
    const allTasks = loadTasks().filter(t => !t.completed)
    const idx = allTasks.findIndex(t => t.id === sel.taskId)
    return idx >= 0 ? idx : null
  })

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [parseError, setParseError] = useState<string | undefined>()
  const [showBackConfirm, setShowBackConfirm] = useState(false)

  const [wheelAngle, setWheelAngle] = useState<number>(() => {
    const sel = loadSelectedTask()
    return sel?.angle ?? 0
  })
  const [dumpPhoto, setDumpPhoto] = useState<File | null>(null)

  // ── Mid-session brain dump (from the wheel's edit sheet) ────────────────────
  // A photo lifted so it survives across the sheet's toggle switches.
  const [editSheetPhoto, setEditSheetPhoto] = useState<File | null>(null)
  const [appendLoading, setAppendLoading] = useState(false)
  const [appendError, setAppendError] = useState<string | undefined>()
  // Bumped after a successful append so BrainDumpForm clears its textarea/photo.
  const [appendResetSignal, setAppendResetSignal] = useState(0)
  // Transient toast summarizing the last append ("Added 8, hit your 20-task limit").
  const [appendToast, setAppendToast] = useState<string | null>(null)

  // Auto-spin signal — incremented each time user hits "spin again"
  // Using a counter (not a ref) so WheelScreen's useEffect detects the change
  const [autoSpinSignal] = useState(0)

  // Active (non-completed) tasks
  const activeTasks = tasks.filter(t => !t.completed)
  // Completed count is derived LIVE from tasks — never a separately-tracked
  // counter, so deleting a completed task can never leave it stale.
  const completedCount = tasks.filter(t => t.completed).length

  // Persist to localStorage on every relevant state change
  useEffect(() => { saveAppState(appState) }, [appState])
  useEffect(() => { saveTasks(tasks) }, [tasks])

  // Always-fresh mirror of `tasks` for use inside stable (empty-dep) callbacks
  // like handleAppendDump, whose closure would otherwise capture the initial
  // (empty) task list. The append handler runs after an awaited API call, so it
  // must read the CURRENT list — not whatever existed when the callback was
  // memoized — to compute cap/overflow correctly.
  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  // ── History management — back-button navigation ───────────────────────────
  const historyHandlers = {
    onBackFromWheel: useCallback(() => {
      setAppState('LIST_EDIT')
      setIsEditModalOpen(false)
    }, []),
    onBackFromEdit: useCallback(() => {
      setShowBackConfirm(true)
    }, []),
  }
  useHistoryNav(appState, historyHandlers)

  // Expose window helpers for Playwright tests
  useEffect(() => {
    window.__setAppState = (state: AppState) => setAppState(state)
    window.__setTasks = (t: Task[]) => setTasks(t)
    // Compat shim for E2E tests: completedCount is now derived live from
    // `tasks`, so "setting" it means seeding `tasks` with N completed dummy
    // tasks rather than touching a separate counter.
    window.__setCompletedCount = (count: number) => {
      setTasks(
        Array.from({ length: count }, (_, i) => ({
          id: `__test-completed-${i}`,
          text: `Test completed task ${i}`,
          position: i,
          completed: true,
        }))
      )
    }
  }, [])

  // ── DUMP → PARSING ──────────────────────────────────────────────────────────
  const handleDumpSubmit = async (dump: string, photo?: File) => {
    setParseError(undefined)
    setSessionLimitMsg(null)

    // Check session limit before spending API call / showing loading state
    // Skip in test/dev environments to avoid blocking E2E tests
    if (!import.meta.env.VITE_SKIP_SESSION_LIMIT) {
      const status = await getSessionStatus()
      if (!status.allowed) {
        if (status.reason === 'come_back_tomorrow') {
          setSessionLimitMsg("You've hit your limit of 3 sessions today. Come back tomorrow 💪")
        } else if (status.reason === 'needs_email') {
          setShowEmailModal(true)
        }
        return
      }
    }

    setAppState('PARSING')
    try {
      let parsed: string[]
      if (photo) {
        const base64 = await fileToBase64(photo)
        parsed = await parseTasksFromImage(base64, photo.type, dump || undefined)
      } else {
        parsed = await parseTasks(dump)
      }

      if (parsed.length === 0) {
        setParseError('No tasks found in your input. Try adding more detail or a clearer photo.')
        setAppState('DUMP')
        return
      }

      const newTasks: Task[] = parsed.map((text, i) => ({
        id: String(Date.now() + i),
        text,
        position: i,
        completed: false,
      }))
      setTasks(newTasks)
      setDumpPhoto(null)
      setAppState('LIST_EDIT')
      history.pushState({ state: 'EDIT' }, '')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setParseError(msg)
      setAppState('DUMP')
    }
  }

  // ── LIST_EDIT task management ────────────────────────────────────────────────
  const handleAddTask = (text: string) => {
    const newTask: Task = {
      id: generateId(),
      text,
      position: tasks.length,
      completed: false,
    }
    setTasks(prev => [...prev, newTask])
  }

  // ── Mid-session brain dump → append (does NOT leave WHEEL_IDLE) ──────────────
  // Reuses the same parse API as the first-run dump, but MERGES results into the
  // current list instead of replacing, and never routes through the full-screen
  // PARSING app-state. Caps once against the active count and reports how many
  // were added vs. dropped so the sheet can show honest overflow feedback.
  const handleAppendDump = useCallback(async (dump: string, photo?: File): Promise<AppendResult> => {
    setAppendError(undefined)
    setAppendToast(null)
    setAppendLoading(true)
    try {
      let parsed: string[]
      if (photo) {
        const base64 = await fileToBase64(photo)
        parsed = await parseTasksFromImage(base64, photo.type, dump || undefined)
      } else {
        parsed = await parseTasks(dump)
      }

      const cleaned = parsed.map(t => t.trim()).filter(t => t.length > 0)
      if (cleaned.length === 0) {
        setAppendError('No tasks found in that — try adding more detail or a clearer photo.')
        return { added: 0, dropped: 0 }
      }

      // Read the CURRENT list via the ref — `tasks` here is the frozen closure
      // from useCallback([]) (empty on first render). The ref is kept in sync by
      // an effect, so it reflects seeded/edited/completed state at call time.
      const current = tasksRef.current
      const active = current.filter(t => !t.completed)
      const room = Math.max(0, MAX_TASKS - active.length)
      const toAdd = cleaned.slice(0, room)
      const result: AppendResult = { added: toAdd.length, dropped: cleaned.length - toAdd.length }

      if (toAdd.length > 0) {
        const base = current.length
        const newTasks: Task[] = toAdd.map((text, i) => ({
          id: generateId(),
          text,
          position: base + i,
          completed: false,
        }))
        setTasks(prev => [...prev, ...newTasks])
      }

      // Honest, ADHD-friendly feedback: never a silent drop.
      if (result.added === 0 && result.dropped > 0) {
        setAppendToast(`You're at the ${MAX_TASKS}-task limit — complete or remove a few to add more.`)
      } else if (result.dropped > 0) {
        setAppendToast(`Added ${result.added} — you hit the ${MAX_TASKS}-task limit, so ${result.dropped} didn't fit.`)
      } else {
        setAppendToast(`Added ${result.added} task${result.added !== 1 ? 's' : ''}.`)
      }

      if (result.added > 0) {
        setEditSheetPhoto(null)
        setAppendResetSignal(s => s + 1)
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setAppendError(msg)
      return { added: 0, dropped: 0 }
    } finally {
      setAppendLoading(false)
    }
  }, [])

  const handleEditTask = (id: string, text: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, text } : t)))
  }

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  // ── LIST_EDIT → WHEEL_IDLE ──────────────────────────────────────────────────
  const handleProceed = () => {
    saveAppState('WHEEL_IDLE')
    setAppState('WHEEL_IDLE')
    history.pushState({ state: 'WHEEL' }, '')
  }

  // ── Auto-show task card when only 1 task remains ─────────────────────────────
  // No need to spin — just show the task directly
  useEffect(() => {
    if (appState === 'WHEEL_IDLE' && activeTasks.length === 1) {
      setSelectedTask(activeTasks[0])
      setSelectedIndex(0)
      setWheelAngle(0)
      setAppState('TASK_CARD')
    }
  }, [appState, activeTasks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── WHEEL_IDLE → WHEEL_SPINNING ─────────────────────────────────────────────
  const handleSpinStart = () => {
    setAppState('WHEEL_SPINNING')
  }

  // ── WHEEL_SPINNING → TASK_CARD ──────────────────────────────────────────────
  const handleTaskSelected = (task: Task, index: number, finalAngle: number) => {
    setSelectedTask(task)
    setSelectedIndex(index)
    setWheelAngle(finalAngle)
    saveSelectedTask(task.id, finalAngle)
    setAppState('TASK_CARD')
  }

  // ── TASK_CARD → ALL_DONE or WHEEL_IDLE (complete) ──────────────────────────
  // Reusable completion logic — called by TaskCard's complete flow (via
  // handleTaskComplete, using the currently selected task) AND by the wheel
  // slice popover's "Mark as complete" option (via completeTaskById, using an
  // arbitrary task id without going through the wheel-spin flow).
  const completeTaskById = useCallback((taskId: string) => {
    const updated = tasks.map(t =>
      t.id === taskId ? { ...t, completed: true } : t
    )
    setTasks(updated)
    saveTasks(updated)

    const remaining = updated.filter(t => !t.completed)
    if (remaining.length === 0) {
      setSelectedTask(null)
      setSelectedIndex(null)
      saveSelectedTask(null, 0)

      // 🎆 Wheel explosion — fires BEFORE screen transition so it bursts from
      // the wheel's position. 8 radial shards + a central shower.
      const wheelOrigin = { x: 0.5, y: 0.42 } // wheel center on TaskCard
      const shardColors = ['#F05A22','#E09B00','#82C900','#1EAA4A','#00A89A','#1D6AFF','#7B2FE0','#E01B7A']
      // Fire 8 directional bursts — one per wheel color / slice
      for (let i = 0; i < 8; i++) {
        const angleDeg = (i / 8) * 360
        confetti({
          particleCount: 18,
          angle: angleDeg,
          spread: 22,
          origin: wheelOrigin,
          colors: [shardColors[i], '#ffffff', shardColors[(i + 1) % 8]],
          startVelocity: 55,
          scalar: 0.9,
          gravity: 0.8,
          drift: 0,
        })
      }
      // Central burst — pops outward like the hub blowing off
      confetti({
        particleCount: 60,
        spread: 360,
        origin: wheelOrigin,
        colors: shardColors,
        startVelocity: 30,
        scalar: 1.1,
        gravity: 0.6,
        ticks: 200,
      })

      recordSessionComplete()
      setAppState('ALL_DONE')
    } else if (remaining.length === 1) {
      // Go directly to TASK_CARD for the last task — skipping WHEEL_IDLE avoids
      // the AnimatePresence double-transition race that causes a black screen.
      setSelectedTask(remaining[0])
      setSelectedIndex(0)
      setWheelAngle(0)
      saveSelectedTask(remaining[0].id, 0)
      setAppState('TASK_CARD')
    } else {
      setSelectedTask(null)
      setSelectedIndex(null)
      saveSelectedTask(null, 0)
      setAppState('WHEEL_IDLE')
    }
  }, [tasks])

  const handleTaskComplete = () => {
    if (!selectedTask) return
    completeTaskById(selectedTask.id)
  }

  // ── WHEEL_IDLE → TASK_CARD (skip spin) — wheel slice popover "Set as active task" ──
  const handleSetActiveTask = useCallback((task: Task, index: number) => {
    setSelectedTask(task)
    setSelectedIndex(index)
    setWheelAngle(wheelAngle)
    saveSelectedTask(task.id, wheelAngle)
    setAppState('TASK_CARD')
  }, [wheelAngle])

  // ── TASK_CARD → WHEEL_IDLE (skip — do NOT auto-spin) ────────────────────────
  const handleSkip = () => {
    setSelectedTask(null)
    setSelectedIndex(null)
    saveSelectedTask(null, 0)
    setAppState('WHEEL_IDLE')
  }

  // ── ALL_DONE → DUMP ─────────────────────────────────────────────────────────
  const handleStartFresh = () => {
    clearAll()
    setTasks([])
    setSelectedTask(null)
    setSelectedIndex(null)
    setDumpPhoto(null)
    setAppState('DUMP')
  }

  // ── Edit modal (only from WHEEL_IDLE) ───────────────────────────────────────
  const handleOpenEdit = () => {
    if (appState === 'WHEEL_IDLE') {
      setIsEditModalOpen(true)
    }
  }

  const handleCloseEdit = () => {
    setIsEditModalOpen(false)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-base)',
        color: 'var(--color-ink)',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        // iOS notch/status-bar safe area — viewport-fit=cover in index.html
        // makes env() resolve to the real inset on notched devices, 0 elsewhere.
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, position: 'relative', minHeight: '100dvh' }}>
      <AppLayout
        showHomeIcon={
          appState === 'LIST_EDIT' ||
          appState === 'WHEEL_IDLE' ||
          appState === 'WHEEL_SPINNING' ||
          appState === 'TASK_CARD'
        }
        onHomeIconActivate={() => setShowBackConfirm(true)}
        headerRight={
          appState === 'WHEEL_IDLE' ? (
            <button
              type="button"
              data-testid="edit-tasks-btn"
              onClick={handleOpenEdit}
              aria-label="Edit tasks"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--rounded-md)',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-ink-muted)',
              }}
            >
              <PencilIcon />
            </button>
          ) : undefined
        }
      >
      <AnimatePresence>
        {appState === 'DUMP' && (
          <motion.div
            key="dump"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'absolute', width: '100%' }}
          >
            <DumpScreen onSubmit={handleDumpSubmit} error={parseError ?? sessionLimitMsg ?? undefined} photoFile={dumpPhoto} onPhotoChange={setDumpPhoto} />
          </motion.div>
        )}

        {appState === 'PARSING' && (
          <motion.div
            key="parsing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'absolute', width: '100%' }}
          >
            <ParsingScreen />
          </motion.div>
        )}

        {appState === 'LIST_EDIT' && (
          <motion.div
            key="list-edit"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'absolute', width: '100%' }}
          >
            <ListEditScreen
              tasks={tasks}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onProceed={handleProceed}
              canAddMore={tasks.filter(t => !t.completed).length < MAX_TASKS}
              onAppendDump={handleAppendDump}
              appendLoading={appendLoading}
              appendError={appendError}
              appendResetSignal={appendResetSignal}
              appendToast={appendToast}
              dumpPhoto={editSheetPhoto}
              onDumpPhotoChange={setEditSheetPhoto}
            />
          </motion.div>
        )}

        {(appState === 'WHEEL_IDLE' || appState === 'WHEEL_SPINNING' || appState === 'TASK_CARD') && (
          <motion.div
            key="wheel"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            // Start the box BELOW the AppLayout header (top:68) rather than at
            // top:0 with paddingTop — a full-height box at top:0 overlays the
            // header, and its (transparent) top band intercepts clicks on the
            // home icon + edit-tasks button behind it. top:68 + bottom:0 still
            // gives a DEFINITE height (viewport - header) so the inner flex:1
            // has slack to distribute — without which excess space piled up
            // ABOVE the wheel (the "too much top margin" bug). 68 = header
            // height 44 + 12+12 margins.
            style={{
              position: 'absolute',
              width: '100%',
              top: 68,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <WheelScreen
                tasks={activeTasks}
                onSpinStart={handleSpinStart}
                onTaskSelected={handleTaskSelected}
                autoSpinSignal={autoSpinSignal}
                frozen={appState === 'TASK_CARD'}
                frozenAngle={wheelAngle}
                frozenWinnerIndex={selectedIndex}
                onSetActiveTask={handleSetActiveTask}
                onMarkComplete={completeTaskById}
                onDeleteTask={handleDeleteTask}
              />
            </div>
            <EditModal
              isOpen={isEditModalOpen}
              tasks={tasks}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onClose={handleCloseEdit}
              canAddMore={tasks.filter(t => !t.completed).length < MAX_TASKS}
              onAppendDump={handleAppendDump}
              appendLoading={appendLoading}
              appendError={appendError}
              appendResetSignal={appendResetSignal}
              appendToast={appendToast}
              dumpPhoto={editSheetPhoto}
              onDumpPhotoChange={setEditSheetPhoto}
            />
            <AnimatePresence>
              {appState === 'TASK_CARD' && selectedTask && (
                <motion.div
                  key={`task-card-${selectedTask.id}`}
                  variants={taskCardVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={taskCardTransition}
                  style={{ flexShrink: 0, zIndex: 10 }}
                >
                  <TaskCard
                    task={selectedTask}
                    onComplete={handleTaskComplete}
                    onSkip={handleSkip}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {appState === 'ALL_DONE' && (
          <motion.div
            key="all-done"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ position: 'absolute', width: '100%' }}
          >
            <AllDoneScreen
              completedCount={completedCount}
              onStartFresh={handleStartFresh}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </AppLayout>
      </div>
      {/* Email gate modal — shown when session limit hit and no email yet */}
      {showEmailModal && (
        <EmailGateModal
          onSuccess={() => setShowEmailModal(false)}
          onDismiss={() => setShowEmailModal(false)}
        />
      )}
      {/* Back confirmation modal — shown when user presses browser Back on LIST_EDIT */}
      {showBackConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
            padding: '0 20px',
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--rounded-lg)',
              padding: '28px 24px 24px',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
            }}
          >
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                marginBottom: 8,
                letterSpacing: '-0.01em',
              }}
            >
              Go back?
            </h2>
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--color-ink-muted)',
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              Are you sure you want to go back? You&apos;ll lose all your current tasks!
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowBackConfirm(false)}
                style={{
                  flex: 1,
                  background: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--rounded-md)',
                  padding: '0 20px',
                  minHeight: 48,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="back-confirm-btn"
                onClick={() => {
                  setShowBackConfirm(false)
                  clearAll()
                  setTasks([])
                  setSelectedTask(null)
                  setSelectedIndex(null)
                  setDumpPhoto(null)
                  setAppState('DUMP')
                  history.replaceState({ state: 'DUMP' }, '')
                }}
                style={{
                  flex: 1,
                  background: 'oklch(40% 0.18 25)',
                  border: 'none',
                  borderRadius: 'var(--rounded-md)',
                  padding: '0 20px',
                  minHeight: 48,
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Dev-only reset button — clears localStorage + reloads. Positioned
          BELOW the app header row (not flush with the top-right corner)
          because the edit-tasks button now lives in that same header row
          (see AppLayout's headerRight) — sharing the corner made this fixed
          overlay intercept clicks meant for the edit button. Dev-only, so
          prod is unaffected. */}
      {import.meta.env.DEV && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 64px)', right: 8, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => { localStorage.clear(); window.location.reload() }}
            style={{
              background: 'rgba(255,0,0,0.15)', border: '1px solid rgba(255,0,0,0.3)',
              color: '#f88', borderRadius: 6, padding: '4px 8px',
              fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
            }}
          >
            reset
          </button>
          {localStorage.getItem('trEmail') && (
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#0f0', background: 'rgba(0,255,0,0.1)', borderRadius: 6, padding: '4px 8px', border: '1px solid rgba(0,255,0,0.2)' }}>
              {localStorage.getItem('trEmail')}
            </span>
          )}
        </div>
      )}
      <Analytics />
    </div>
  )
}

export default App
// test PR - vercel preview check Sun Jul 19 13:01:34 EDT 2026
