import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import type { AppState, Task } from './types'
import DumpScreen from './components/DumpScreen'
import ParsingScreen from './components/ParsingScreen'
import ListEditScreen from './components/ListEditScreen'
import WheelScreen from './components/WheelScreen'
import TaskCard from './components/TaskCard'
import EditModal from './components/EditModal'
import AllDoneScreen from './components/AllDoneScreen'
import { parseTasks, parseTasksFromImage, getSessionStatus, recordSessionComplete } from './api'
import EmailGateModal, { TR_EMAIL_KEY } from './components/EmailGateModal'
import {
  saveTasks,
  loadTasks,
  saveAppState,
  loadAppState,
  saveCompletedCount,
  loadCompletedCount,
  saveSelectedTask,
  loadSelectedTask,
  clearAll,
} from './storage'
import { MAX_TASKS } from './constants'

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
  const [completedCount, setCompletedCount] = useState<number>(() => loadCompletedCount())
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

  const [wheelAngle, setWheelAngle] = useState<number>(() => {
    const sel = loadSelectedTask()
    return sel?.angle ?? 0
  })
  const [dumpPhoto, setDumpPhoto] = useState<File | null>(null)

  // Auto-spin signal — incremented each time user hits "spin again"
  // Using a counter (not a ref) so WheelScreen's useEffect detects the change
  const [autoSpinSignal] = useState(0)

  // Active (non-completed) tasks
  const activeTasks = tasks.filter(t => !t.completed)

  // Persist to localStorage on every relevant state change
  useEffect(() => { saveAppState(appState) }, [appState])
  useEffect(() => { saveTasks(tasks) }, [tasks])
  useEffect(() => { saveCompletedCount(completedCount) }, [completedCount])

  // Expose window helpers for Playwright tests
  useEffect(() => {
    window.__setAppState = (state: AppState) => setAppState(state)
    window.__setTasks = (t: Task[]) => setTasks(t)
    window.__setCompletedCount = (count: number) => setCompletedCount(count)
  }, [])

  // ── DUMP → PARSING ──────────────────────────────────────────────────────────
  const handleDumpSubmit = async (dump: string, photo?: File) => {
    setParseError(undefined)
    setSessionLimitMsg(null)

    // Check session limit before spending API call / showing loading state
    const status = await getSessionStatus()
    if (!status.allowed) {
      if (status.reason === 'come_back_tomorrow') {
        setSessionLimitMsg("You've hit your limit of 3 sessions today. Come back tomorrow 💪")
      } else if (status.reason === 'needs_email') {
        setShowEmailModal(true)
      }
      return
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setParseError(msg)
      setAppState('DUMP')
    }
  }

  // ── LIST_EDIT task management ────────────────────────────────────────────────
  const handleAddTask = (text: string) => {
    const newTask: Task = {
      id: String(Date.now()),
      text,
      position: tasks.length,
      completed: false,
    }
    setTasks(prev => [...prev, newTask])
  }

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
  const handleTaskComplete = () => {
    if (!selectedTask) return
    const updated = tasks.map(t =>
      t.id === selectedTask.id ? { ...t, completed: true } : t
    )
    setTasks(updated)
    saveTasks(updated)

    const newCount = completedCount + 1
    setCompletedCount(newCount)
    saveCompletedCount(newCount)

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
  }

  // ── Back to dump (from anywhere mid-session) ────────────────────────────────
  const handleBackToDump = () => {
    setSelectedTask(null)
    setSelectedIndex(null)
    saveSelectedTask(null, 0)
    setAppState('DUMP')
  }

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
    setCompletedCount(0)
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
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, position: 'relative', minHeight: '100dvh' }}>
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
              canAddMore={tasks.length < MAX_TASKS}
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
            style={{ position: 'absolute', width: '100%' }}
          >
            <WheelScreen
              tasks={activeTasks}
              onSpinStart={handleSpinStart}
              onTaskSelected={handleTaskSelected}
              onEditTasks={handleOpenEdit}
              onBackToDump={handleBackToDump}
              autoSpinSignal={autoSpinSignal}
              frozen={appState === 'TASK_CARD'}
              frozenAngle={wheelAngle}
              frozenWinnerIndex={selectedIndex}
            />
            <EditModal
              isOpen={isEditModalOpen}
              tasks={tasks}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onClose={handleCloseEdit}
              canAddMore={tasks.length < MAX_TASKS}
            />
          </motion.div>
        )}

        {appState === 'TASK_CARD' && (
          <motion.div
            key={`task-card-${selectedTask?.id ?? 'none'}`}
            variants={taskCardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={taskCardTransition}
            style={{ 
              position: 'absolute', 
              width: '100%', 
              bottom: 0,
              zIndex: 10,
            }}
          >
            {selectedTask && (
              <TaskCard
                task={selectedTask}
                onComplete={handleTaskComplete}
                onSkip={handleSkip}
                onBackToDump={handleBackToDump}
              />
            )}
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
      </div>
      {/* Email gate modal — shown when session limit hit and no email yet */}
      {showEmailModal && (
        <EmailGateModal
          onSuccess={() => setShowEmailModal(false)}
          onDismiss={() => setShowEmailModal(false)}
        />
      )}
    </div>
  )
}

export default App
// test PR - vercel preview check Sun Jul 19 13:01:34 EDT 2026
