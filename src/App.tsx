import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppState, Task } from './types'
import DumpScreen from './components/DumpScreen'
import ParsingScreen from './components/ParsingScreen'
import ListEditScreen from './components/ListEditScreen'
import WheelScreen from './components/WheelScreen'
import TaskCard from './components/TaskCard'
import EditModal from './components/EditModal'
import AllDoneScreen from './components/AllDoneScreen'
import { parseTasks } from './api'
import {
  saveTasks,
  loadTasks,
  saveAppState,
  loadAppState,
  saveCompletedCount,
  loadCompletedCount,
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

// Page transition variants
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
const pageTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }

function App() {
  const [appState, setAppState] = useState<AppState>(
    () => (loadAppState() as AppState | null) ?? 'DUMP'
  )
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [completedCount, setCompletedCount] = useState<number>(() => loadCompletedCount())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [parseError, setParseError] = useState<string | undefined>()
  const [wheelAngle, setWheelAngle] = useState(0)

  // Auto-spin signal — incremented each time user hits "spin again"
  // Using a counter (not a ref) so WheelScreen's useEffect detects the change
  const [autoSpinSignal, setAutoSpinSignal] = useState(0)

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
  const handleDumpSubmit = async (dump: string) => {
    setParseError(undefined)
    setAppState('PARSING')
    try {
      const parsed = await parseTasks(dump)
      const newTasks: Task[] = parsed.map((text, i) => ({
        id: String(Date.now() + i),
        text,
        position: i,
        completed: false,
      }))
      setTasks(newTasks)
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
      setAppState('ALL_DONE')
    } else if (remaining.length === 1) {
      // Go directly to TASK_CARD for the last task — skipping WHEEL_IDLE avoids
      // the AnimatePresence double-transition race that causes a black screen.
      setSelectedTask(remaining[0])
      setSelectedIndex(0)
      setWheelAngle(0)
      setAppState('TASK_CARD')
    } else {
      setSelectedTask(null)
      setSelectedIndex(null)
      setAppState('WHEEL_IDLE')
    }
  }

  // ── TASK_CARD → WHEEL_IDLE (skip/spin again) ────────────────────────────────
  const handleSpinAgain = () => {
    setSelectedTask(null)
    setSelectedIndex(null)
    setAutoSpinSignal(prev => prev + 1)  // increment signal → WheelScreen auto-spins
    setAppState('WHEEL_IDLE')
  }

  // ── ALL_DONE → DUMP ─────────────────────────────────────────────────────────
  const handleStartFresh = () => {
    clearAll()
    setTasks([])
    setCompletedCount(0)
    setSelectedTask(null)
    setSelectedIndex(null)
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
      <div style={{ width: '100%', maxWidth: 480, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">
        {appState === 'DUMP' && (
          <motion.div
            key="dump"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <DumpScreen onSubmit={handleDumpSubmit} error={parseError} />
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

        {(appState === 'WHEEL_IDLE' || appState === 'WHEEL_SPINNING') && (
          <motion.div
            key="wheel"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <WheelScreen
              tasks={activeTasks}
              onSpinStart={handleSpinStart}
              onTaskSelected={handleTaskSelected}
              onEditTasks={handleOpenEdit}
              autoSpinSignal={autoSpinSignal}
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
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {selectedTask && (
              <TaskCard
                task={selectedTask}
                onComplete={handleTaskComplete}
                onSpinAgain={handleSpinAgain}
                wheelAngle={wheelAngle}
                winningIndex={selectedIndex}
                activeTasks={activeTasks}
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
          >
            <AllDoneScreen
              completedCount={completedCount}
              onStartFresh={handleStartFresh}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

export default App
