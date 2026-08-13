import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditModal from '../../src/components/EditModal'
import { MAX_TASKS } from '../../src/constants'
import type { Task } from '../../src/types'

const makeTask = (id: string, text: string, completed = false, position = 0): Task => ({
  id,
  text,
  position,
  completed,
})

const defaultProps = {
  isOpen: true,
  onAddTask: vi.fn(),
  onEditTask: vi.fn(),
  onDeleteTask: vi.fn(),
  onClose: vi.fn(),
  canAddMore: true,
  onAppendDump: vi.fn(async () => ({ added: 0, dropped: 0 })),
  appendLoading: false,
  appendResetSignal: 0,
  appendToast: null,
  dumpPhoto: null,
  onDumpPhotoChange: vi.fn(),
}

describe('EditModal', () => {
  it('renders active tasks without strikethrough', () => {
    render(
      <EditModal {...defaultProps} tasks={[makeTask('1', 'Active task', false)]} />
    )
    const item = screen.getByTestId('edit-modal-task')
    expect(item).toHaveAttribute('data-completed', 'false')
    const text = screen.getByText('Active task')
    expect(text).toHaveStyle({ textDecoration: 'none' })
  })

  it('renders completed tasks with a strikethrough', () => {
    render(
      <EditModal {...defaultProps} tasks={[makeTask('1', 'Done task', true)]} />
    )
    const item = screen.getByTestId('edit-modal-task')
    expect(item).toHaveAttribute('data-completed', 'true')
    const text = screen.getByText('Done task')
    expect(text).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('sorts active tasks before completed tasks, preserving relative order within each group', () => {
    const tasks: Task[] = [
      makeTask('1', 'Active A', false, 0),
      makeTask('2', 'Completed A', true, 1),
      makeTask('3', 'Active B', false, 2),
      makeTask('4', 'Completed B', true, 3),
      makeTask('5', 'Active C', false, 4),
    ]
    render(<EditModal {...defaultProps} tasks={tasks} />)
    const items = screen.getAllByTestId('edit-modal-task')
    const texts = items.map(el => el.textContent)
    expect(texts).toEqual([
      expect.stringContaining('Active A'),
      expect.stringContaining('Active B'),
      expect.stringContaining('Active C'),
      expect.stringContaining('Completed A'),
      expect.stringContaining('Completed B'),
    ])
    const completedFlags = items.map(el => el.getAttribute('data-completed'))
    expect(completedFlags).toEqual(['false', 'false', 'false', 'true', 'true'])
  })

  it('header badge counts only active tasks against the cap, ignoring completed tasks', () => {
    const tasks: Task[] = [
      makeTask('1', 'Active 1', false),
      makeTask('2', 'Active 2', false),
      makeTask('3', 'Completed 1', true),
      makeTask('4', 'Completed 2', true),
      makeTask('5', 'Completed 3', true),
    ]
    render(<EditModal {...defaultProps} tasks={tasks} />)
    // Only 2 active tasks, even though 5 total tasks (3 completed) exist.
    expect(screen.getByTestId('edit-modal-count')).toHaveTextContent(`2/${MAX_TASKS}`)
  })

  it('does not show the warning badge color when active count is low, even with many completed tasks', () => {
    const tasks: Task[] = [
      makeTask('1', 'Active 1', false),
      ...Array.from({ length: MAX_TASKS - 1 }, (_, i) => makeTask(`c${i}`, `Completed ${i}`, true)),
    ]
    render(<EditModal {...defaultProps} tasks={tasks} />)
    const badge = screen.getByTestId('edit-modal-count')
    expect(badge).toHaveTextContent(`1/${MAX_TASKS}`)
    expect(badge).toHaveStyle({ color: 'var(--color-accent)' })
  })

  it('shows warning badge color when active count alone hits the cap threshold', () => {
    const tasks: Task[] = Array.from({ length: MAX_TASKS - 1 }, (_, i) =>
      makeTask(`a${i}`, `Active ${i}`, false)
    )
    render(<EditModal {...defaultProps} tasks={tasks} />)
    const badge = screen.getByTestId('edit-modal-count')
    expect(badge).toHaveTextContent(`${MAX_TASKS - 1}/${MAX_TASKS}`)
    expect(badge).toHaveStyle({ color: 'var(--color-accent-glow)' })
  })

  it('deleting a completed task still calls onDeleteTask', () => {
    const onDeleteTask = vi.fn()
    render(
      <EditModal
        {...defaultProps}
        onDeleteTask={onDeleteTask}
        tasks={[makeTask('1', 'Done task', true)]}
      />
    )
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    deleteBtn.click()
    expect(onDeleteTask).toHaveBeenCalledWith('1')
  })

  // ── Brain-dump toggle ──────────────────────────────────────────────────────

  it('defaults to Quick add mode — shows the task list, not the brain-dump form', () => {
    render(<EditModal {...defaultProps} tasks={[makeTask('1', 'A task', false)]} />)
    expect(screen.getByTestId('edit-mode-quick')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('edit-mode-dump')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('edit-modal-task')).toBeInTheDocument()
    expect(screen.queryByTestId('brain-dump-explainer')).not.toBeInTheDocument()
  })

  it('switching to Brain dump reveals the append form + explainer that says nothing is replaced', async () => {
    const user = userEvent.setup()
    render(<EditModal {...defaultProps} tasks={[makeTask('1', 'A task', false)]} />)
    await user.click(screen.getByTestId('edit-mode-dump'))

    expect(screen.getByTestId('edit-mode-dump')).toHaveAttribute('aria-selected', 'true')
    // The shared brain-dump form is now mounted
    expect(screen.getByTestId('brain-dump-submit')).toBeInTheDocument()
    // Explainer makes append-vs-replace unmistakable
    const explainer = screen.getByTestId('brain-dump-explainer')
    expect(explainer).toHaveTextContent(/added to your current list/i)
    expect(explainer).toHaveTextContent(/nothing gets replaced/i)
  })

  it('brain-dump mode shows live capacity reflecting active count and room left', async () => {
    const user = userEvent.setup()
    const tasks = Array.from({ length: 14 }, (_, i) => makeTask(`a${i}`, `Task ${i}`, false))
    render(<EditModal {...defaultProps} tasks={tasks} />)
    await user.click(screen.getByTestId('edit-mode-dump'))
    const capacity = screen.getByTestId('brain-dump-capacity')
    // 14 active, cap 20 → room for 6
    expect(capacity).toHaveTextContent(`14/${MAX_TASKS}`)
    expect(capacity).toHaveTextContent(/room for 6 more/i)
  })

  it('brain-dump capacity shows the limit message when active count is at the cap', async () => {
    const user = userEvent.setup()
    const tasks = Array.from({ length: MAX_TASKS }, (_, i) => makeTask(`a${i}`, `Task ${i}`, false))
    render(<EditModal {...defaultProps} tasks={tasks} />)
    await user.click(screen.getByTestId('edit-mode-dump'))
    expect(screen.getByTestId('brain-dump-capacity')).toHaveTextContent(
      new RegExp(`at the ${MAX_TASKS}-task limit`, 'i')
    )
  })

  it('renders the append toast when provided', async () => {
    const user = userEvent.setup()
    render(
      <EditModal
        {...defaultProps}
        tasks={[makeTask('1', 'A task', false)]}
        appendToast="Added 3 tasks."
      />
    )
    await user.click(screen.getByTestId('edit-mode-dump'))
    expect(screen.getByTestId('brain-dump-toast')).toHaveTextContent('Added 3 tasks.')
  })
})
