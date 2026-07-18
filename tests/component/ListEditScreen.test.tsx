import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListEditScreen from '../../src/components/ListEditScreen'
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

  it("'Let's spin' CTA disabled when > 15 tasks", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(16)} canAddMore={false} />)
    const btn = screen.getByRole('button', { name: /spin/i })
    expect(btn).toBeDisabled()
  })

  it("'Let's spin' CTA enabled when 1-15 tasks", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} />)
    const btn = screen.getByRole('button', { name: /spin/i })
    expect(btn).not.toBeDisabled()
  })

  it("counter shows 'X/15'", () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} />)
    expect(screen.getByText(/3\/15/)).toBeInTheDocument()
  })

  it('counter shows warning color when at 15', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(15)} canAddMore={false} />)
    const badge = screen.getByText(/15\/15/)
    expect(badge).toHaveAttribute('data-warning', 'true')
  })

  it('add task button visible when < 15 tasks', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(3)} canAddMore={true} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('add task button NOT visible when at 15 tasks', () => {
    render(<ListEditScreen {...defaultProps} tasks={makeTasks(15)} canAddMore={false} />)
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
})
