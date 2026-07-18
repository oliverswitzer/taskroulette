import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DumpScreen from '../../src/components/DumpScreen'

describe('DumpScreen', () => {
  it('renders a textarea', () => {
    render(<DumpScreen onSubmit={vi.fn()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders a submit button disabled when textarea is empty', () => {
    render(<DumpScreen onSubmit={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /parse/i })
    expect(btn).toBeDisabled()
  })

  it('submit button enabled when textarea has text', async () => {
    const user = userEvent.setup()
    render(<DumpScreen onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'call dentist')
    const btn = screen.getByRole('button', { name: /parse/i })
    expect(btn).not.toBeDisabled()
  })

  it('clicking submit calls onSubmit with textarea value', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<DumpScreen onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'call dentist')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(onSubmit).toHaveBeenCalledWith('call dentist')
  })

  it('placeholder text is warm and inviting (not generic)', () => {
    render(<DumpScreen onSubmit={vi.fn()} />)
    const textarea = screen.getByRole('textbox')
    const placeholder = textarea.getAttribute('placeholder') ?? ''
    // Should not be generic phrases
    expect(placeholder.toLowerCase()).not.toBe('enter text')
    expect(placeholder.toLowerCase()).not.toBe('type here')
    // Should be at least somewhat descriptive
    expect(placeholder.length).toBeGreaterThan(20)
  })
})
