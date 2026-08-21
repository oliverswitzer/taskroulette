import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GoogleTask } from '../../src/types'

// Mock the hook so we can drive auth/task/loading/error states directly and
// assert on refetch being called, without a real Supabase/Google round-trip.
const mockUseGoogleTasks = vi.fn()
vi.mock('../../src/hooks/useGoogleTasks', () => ({
  useGoogleTasks: () => mockUseGoogleTasks(),
}))

// Import AFTER the mock is registered.
import GoogleTasksSheet from '../../src/components/GoogleTasksSheet'

const TASK_A: GoogleTask[] = [
  { id: 'g1', title: 'Buy milk', listId: 'l1', listTitle: 'Errands', status: 'needsAction' },
  { id: 'g2', title: 'Call dentist', listId: 'l1', listTitle: 'Errands', status: 'needsAction' },
]

// A DIFFERENT, smaller set — g1 removed (as if completed/deleted in Google),
// g3 added. Proves the drawer reflects a hard replace, not a union.
const TASK_B: GoogleTask[] = [
  { id: 'g2', title: 'Call dentist', listId: 'l1', listTitle: 'Errands', status: 'needsAction' },
  { id: 'g3', title: 'Water plants', listId: 'l1', listTitle: 'Errands', status: 'needsAction' },
]

function baseState(overrides = {}) {
  return {
    authState: 'authenticated' as const,
    tasks: TASK_A,
    isLoading: false,
    error: null,
    isMockMode: false as const,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderSheet(props: Partial<React.ComponentProps<typeof GoogleTasksSheet>> = {}) {
  const defaults = {
    isOpen: true,
    onClose: vi.fn(),
    currentTaskCount: 0,
    onImport: vi.fn(),
  }
  return render(<GoogleTasksSheet {...defaults} {...props} />)
}

beforeEach(() => {
  cleanup()
  mockUseGoogleTasks.mockReturnValue(baseState())
})

describe('GoogleTasksSheet — refetch on open', () => {
  it('fires refetch on the rising edge of isOpen (closed → open)', async () => {
    const refetch = vi.fn()
    mockUseGoogleTasks.mockReturnValue(baseState({ refetch }))

    const { rerender } = renderSheet({ isOpen: false })
    expect(refetch).not.toHaveBeenCalled() // closed → no fetch

    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={0} onImport={vi.fn()} />)
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  })

  it('does NOT fire refetch on re-renders while already open', async () => {
    const refetch = vi.fn()
    mockUseGoogleTasks.mockReturnValue(baseState({ refetch }))

    const { rerender } = renderSheet({ isOpen: true })
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))

    // Unrelated prop change while staying open — must not refetch again.
    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={3} onImport={vi.fn()} />)
    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={5} onImport={vi.fn()} />)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('fires refetch again on close → reopen (edge-triggered, not once-ever)', async () => {
    const refetch = vi.fn()
    mockUseGoogleTasks.mockReturnValue(baseState({ refetch }))

    const { rerender } = renderSheet({ isOpen: true })
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))

    rerender(<GoogleTasksSheet isOpen={false} onClose={vi.fn()} currentTaskCount={0} onImport={vi.fn()} />)
    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={0} onImport={vi.fn()} />)
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(2))
  })

  it('does NOT fire refetch when opened while not authenticated', async () => {
    const refetch = vi.fn()
    mockUseGoogleTasks.mockReturnValue(baseState({ authState: 'idle', tasks: [], refetch }))

    const { rerender } = renderSheet({ isOpen: false })
    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={0} onImport={vi.fn()} />)
    // Give any effect a tick.
    await new Promise(r => setTimeout(r, 0))
    expect(refetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('google-login-btn')).toBeInTheDocument()
  })
})

describe('GoogleTasksSheet — reflects exactly what Google returns (no additive merge)', () => {
  it('shows exactly the new set after a refetch replaces the tasks', async () => {
    // First render: set A.
    const { rerender } = renderSheet()
    await user_openList()
    expect(screen.getByTestId('google-task-row-g1')).toBeInTheDocument()
    expect(screen.getByTestId('google-task-row-g2')).toBeInTheDocument()

    // Simulate a refetch that returns set B (g1 gone, g3 new). We're already
    // drilled into list l1 (selectedListId persists), and TASK_B keeps l1, so
    // the task-list view re-renders in place against the new data.
    mockUseGoogleTasks.mockReturnValue(baseState({ tasks: TASK_B }))
    rerender(<GoogleTasksSheet isOpen onClose={vi.fn()} currentTaskCount={0} onImport={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('google-task-row-g3')).toBeInTheDocument())
    // g1 must be GONE (not merged), g2 kept, g3 present.
    expect(screen.queryByTestId('google-task-row-g1')).not.toBeInTheDocument()
    expect(screen.getByTestId('google-task-row-g2')).toBeInTheDocument()
  })
})

describe('GoogleTasksSheet — loading and error states', () => {
  it('shows the full loading screen on first load (no cached tasks)', () => {
    mockUseGoogleTasks.mockReturnValue(baseState({ tasks: [], isLoading: true }))
    renderSheet()
    expect(screen.getByText(/loading your tasks/i)).toBeInTheDocument()
  })

  it('shows a non-blocking refresh overlay (list stays visible) when refreshing with cached tasks', async () => {
    mockUseGoogleTasks.mockReturnValue(baseState({ tasks: TASK_A, isLoading: true }))
    renderSheet()
    // List picker still rendered underneath the overlay.
    expect(screen.getByTestId('google-list-picker')).toBeInTheDocument()
    expect(screen.getByTestId('google-refresh-overlay')).toBeInTheDocument()
    // Full loading screen must NOT be shown.
    expect(screen.queryByText(/loading your tasks/i)).not.toBeInTheDocument()
  })

  it('keeps the cached list visible with an inline error banner when a refresh fails', () => {
    mockUseGoogleTasks.mockReturnValue(
      baseState({ tasks: TASK_A, error: 'Network error', authState: 'authenticated' })
    )
    renderSheet()
    expect(screen.getByTestId('google-inline-error')).toBeInTheDocument()
    expect(screen.getByTestId('google-list-picker')).toBeInTheDocument() // list preserved
  })

  it('inline error Retry button calls refetch', async () => {
    const refetch = vi.fn()
    mockUseGoogleTasks.mockReturnValue(
      baseState({ tasks: TASK_A, error: 'Network error', refetch })
    )
    const user = userEvent.setup()
    renderSheet()
    await user.click(screen.getByTestId('google-inline-retry'))
    // refetch is called once on open + once on retry click.
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the full error screen when there is no cached data', () => {
    mockUseGoogleTasks.mockReturnValue(baseState({ authState: 'error', tasks: [], error: 'Boom' }))
    renderSheet()
    expect(screen.getByText('Boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

// Helper: drill from the list picker into the single "Errands" list so the
// per-task rows (google-task-row-*) are on screen.
async function user_openList() {
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByTestId('google-list-picker')).toBeInTheDocument())
  await user.click(screen.getAllByTestId('google-list-row')[0])
  await waitFor(() => expect(screen.getByTestId('google-task-list')).toBeInTheDocument())
}
