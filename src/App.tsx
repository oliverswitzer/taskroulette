import { useState, useEffect } from 'react'
import type { AppState, Task } from './types'
import DumpScreen from './components/DumpScreen'
import ParsingScreen from './components/ParsingScreen'
import ListEditScreen from './components/ListEditScreen'
import { parseTasks } from './api'

// Expose state setter for Playwright testing
declare global {
  interface Window {
    __setAppState: (state: AppState) => void
    __setTasks: (tasks: Task[]) => void
  }
}

function App() {
  const [appState, setAppState] = useState<AppState>('DUMP')
  const [tasks, setTasks] = useState<Task[]>([])
  const [parseError, setParseError] = useState<string | undefined>()

  useEffect(() => {
    window.__setAppState = setAppState
    window.__setTasks = setTasks
  }, [])

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
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, text } : t))
    )
  }

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleProceed = () => {
    setAppState('WHEEL_IDLE')
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-base)',
        color: 'var(--color-ink)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {appState === 'DUMP' && (
        <DumpScreen onSubmit={handleDumpSubmit} error={parseError} />
      )}
      {appState === 'PARSING' && (
        <ParsingScreen />
      )}
      {appState === 'LIST_EDIT' && (
        <ListEditScreen
          tasks={tasks}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onProceed={handleProceed}
          canAddMore={tasks.length < 15}
        />
      )}
      {!['DUMP', 'PARSING', 'LIST_EDIT'].includes(appState) && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-ink-muted)' }}>
          <p>Screen: {appState} (not yet implemented in Phase 2B)</p>
          <button
            type="button"
            onClick={() => setAppState('DUMP')}
            style={{
              marginTop: 16,
              background: 'var(--color-accent)',
              color: 'oklch(10% 0.01 30)',
              border: 'none',
              borderRadius: 'var(--rounded-md)',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Back to Dump
          </button>
        </div>
      )}
    </div>
  )
}

export default App
