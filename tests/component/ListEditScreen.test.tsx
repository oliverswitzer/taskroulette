import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListEditScreen from '../../src/components/ListEditScreen'
import { MAX_TASKS } from '../../src/constants'
import type { Task } from '../../src/types'

const makeTasks = (count: number): Task[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    text: `Task ${i + 1}`,
    position: i,
    completed: false,
  }))

const defaultProps = {
  onAddTask: vi.fn(),
  onEditTask: vi.fn(),
  onDeleteTask: vi.fn(),
  onProceed: vi.fn(),
  canAddMore: true,
  onAppendDump: vi.fn(async () => ({ added: 0, dropped: 0 })),
  appendLoading: false,
  appendResetSignal: 0,
  appendToast: null,
  dumpPhoto: null,
  onDumpPhotoChange: vi.fn(),
}

describe('ListEditScreen', () => {
  it('renders list of tasks', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} />)
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
  })

  it('each task has an edit button and delete button', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(2)} />)
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2)
  })

  it("'Let's spin' CTA disabled when 0 tasks", () => {
    render(<ListEditScreen {...defaultProps} tasks={[]} />)
    const btn = screen.getByRole('button', { name: /spin/i })
    expect(btn).toBeDisabled()
  })

  it("'Let's spin' CTA disabled when over MAX_TASKS", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(MAX_TASKS + 1)} canAddMore={false} />)
    const btn = screen.getByRole('button', { name: /spin/i })
    expect(btn).toBeDisabled()
  })

  it("'Let's spin' CTA enabled when 1..MAX_TASKS", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} />)
    const btn = screen.getByRole('button', { name: /spin/i })
    expect(btn).not.toBeDisabled()
  })

  it("counter shows 'X/MAX_TASKS'", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} />)
    expect(screen.getByText(new RegExp(`3\\/${MAX_TASKS}`))).toBeInTheDocument()
  })

  it('counter shows warning color when at MAX_TASKS', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(MAX_TASKS)} canAddMore={false} />)
    const badge = screen.getByText(new RegExp(`${MAX_TASKS}\\/${MAX_TASKS}`))
    expect(badge).toHaveAttribute('data-warning', 'true')
  })

  it('add task button visible when < MAX_TASKS', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} canAddMore={true} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('add task button NOT visible when at MAX_TASKS', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(MAX_TASKS)} canAddMore={false} />)
    // The add-task dashed button shouldn't appear
    expect(screen.queryByRole('button', { name: /\+ add/i })).not.toBeInTheDocument()
  })

  it("clicking Let's spin calls onProceed", async () => {
    const onProceed = vi.fn()
    const user = userEvent.setup()
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} onProceed={onProceed} />)
    await user.click(screen.getByRole('button', { name: /spin/i }))
    expect(onProceed).toHaveBeenCalled()
  })

  it('counter counts only active tasks, ignoring completed tasks in the array', () => {
    const tasks: Task[] = [
      ...makeTasks(2),
      { id: 'c1', text: 'Completed 1', position: 2, completed: true },
      { id: 'c2', text: 'Completed 2', position: 3, completed: true },
    ]
    render(<ListEditScreen {...defaultProps} tasks={tasks} />)
    // Only 2 active tasks even though the array has 4 total entries.
    expect(screen.getByText(new RegExp(`2\\/${MAX_TASKS}`))).toBeInTheDocument()
  })

  // ── Brain-dump toggle (shared with the wheel's edit sheet) ──────────────────

  it('defaults to Quick add mode — task list + add affordance visible, no brain-dump panel', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(2)} />)
    expect(screen.getByTestId('edit-mode-quick')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('edit-mode-dump')).toHaveAttribute('aria-selected', 'false')
    // The task list stays visible on the page (NOT hidden behind the toggle)
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    // Brain-dump panel not shown yet
    expect(screen.queryByTestId('brain-dump-explainer')).not.toBeInTheDocument()
  })

  it('the task list stays visible even in Brain dump mode (list is not behind the toggle)', async () => {
    const user = userEvent.setup()
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(2)} />)
    await user.click(screen.getByTestId('edit-mode-dump'))
    // List still on the page
    expect(screen.getByText('Task 1')).toBeInTheDocument()
    // And the brain-dump panel is now shown
    expect(screen.getByTestId('brain-dump-submit')).toBeInTheDocument()
  })

  it('switching to Brain dump reveals the append explainer that says nothing is replaced', async () => {
    const user = userEvent.setup()
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(2)} />)
    await user.click(screen.getByTestId('edit-mode-dump'))
    const explainer = screen.getByTestId('brain-dump-explainer')
    expect(explainer).toHaveTextContent(/added to your current list/i)
    expect(explainer).toHaveTextContent(/nothing gets replaced/i)
  })

  it('brain-dump mode shows live capacity reflecting active count and room left', async () => {
    const user = userEvent.setup()
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(14)} />)
    await user.click(screen.getByTestId('edit-mode-dump'))
    const capacity = screen.getByTestId('brain-dump-capacity')
    expect(capacity).toHaveTextContent(`14/${MAX_TASKS}`)
    expect(capacity).toHaveTextContent(/room for 6 more/i)
  })

  it('brain-dump submit calls onAppendDump (append), never onProceed (which would replace/advance)', async () => {
    const user = userEvent.setup()
    const onAppendDump = vi.fn(async () => ({ added: 1, dropped: 0 }))
    const onProceed = vi.fn()
    render(
      <ListEditScreen
        {...defaultProps}
        tasks={makeTasks(2)}
        onAppendDump={onAppendDump}
        onProceed={onProceed}
      />
    )
    await user.click(screen.getByTestId('edit-mode-dump'))
    await user.type(screen.getByRole('textbox'), 'call the dentist')
    await user.click(screen.getByTestId('brain-dump-submit'))
    expect(onAppendDump).toHaveBeenCalledTimes(1)
    expect(onProceed).not.toHaveBeenCalled()
  })
})
