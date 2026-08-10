import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditModal from '../../src/components/EditModal'
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
    // Active tasks first (in original relative order), then completed
    // tasks (in original relative order).
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
    expect(screen.getByText('2/15')).toBeInTheDocument()
  })

  it('does not show the warning badge color when active count is low, even with many completed tasks', () => {
    const tasks: Task[] = [
      makeTask('1', 'Active 1', false),
      ...Array.from({ length: 14 }, (_, i) => makeTask(`c${i}`, `Completed ${i}`, true)),
    ]
    render(<EditModal {...defaultProps} tasks={tasks} />)
    const badge = screen.getByText('1/15')
    expect(badge).toHaveStyle({ color: 'var(--color-accent)' })
  })

  it('shows warning badge color when active count alone hits the cap threshold', () => {
    const tasks: Task[] = Array.from({ length: 14 }, (_, i) =>
      makeTask(`a${i}`, `Active ${i}`, false)
    )
    render(<EditModal {...defaultProps} tasks={tasks} />)
    const badge = screen.getByText('14/15')
    expect(badge).toHaveStyle({ color: 'var(--color-accent-glow)' })
  })

  it('deleting a completed task still calls onDeleteTask', async () => {
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
})
