import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DumpScreen from '../../src/components/DumpScreen'

// Helper: render DumpScreen with the required new props (photoFile + onPhotoChange)
function renderDump(overrides: Partial<React.ComponentProps<typeof DumpScreen>> = {}) {
  const defaults = {
    onSubmit: vi.fn(),
    photoFile: null,
    onPhotoChange: vi.fn(),
  }
  return render(<DumpScreen {...defaults} {...overrides} />)
}

describe('DumpScreen', () => {
  it('renders a textarea', () => {
    renderDump()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders a submit button disabled when textarea is empty and no photo', () => {
    renderDump()
    const btn = screen.getByRole('button', { name: /parse/i })
    expect(btn).toBeDisabled()
  })

  it('submit button enabled when textarea has text', async () => {
    const user = userEvent.setup()
    renderDump()
    await user.type(screen.getByRole('textbox'), 'call dentist')
    const btn = screen.getByRole('button', { name: /parse/i })
    expect(btn).not.toBeDisabled()
  })

  it('submit button enabled when photo is attached (even with empty textarea)', () => {
    const mockFile = new File(['img'], 'list.png', { type: 'image/png' })
    renderDump({ photoFile: mockFile })
    const btn = screen.getByRole('button', { name: /parse/i })
    expect(btn).not.toBeDisabled()
  })

  it('clicking submit calls onSubmit with textarea value and no photo when no photo attached', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderDump({ onSubmit })
    await user.type(screen.getByRole('textbox'), 'call dentist')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(onSubmit).toHaveBeenCalledWith('call dentist', undefined)
  })

  it('clicking submit passes photo file when photo is attached', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    const mockFile = new File(['img'], 'list.png', { type: 'image/png' })
    renderDump({ onSubmit, photoFile: mockFile })
    // Type something so textarea is not empty (or just photo is enough)
    await user.type(screen.getByRole('textbox'), 'also these tasks')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    expect(onSubmit).toHaveBeenCalledWith('also these tasks', mockFile)
  })

  it('shows photo preview when photoFile is provided', () => {
    const mockFile = new File(['img'], 'my-list.png', { type: 'image/png' })
    renderDump({ photoFile: mockFile })
    expect(screen.getByTestId('photo-preview')).toBeInTheDocument()
  })

  it('calls onPhotoChange(null) when remove button is clicked', async () => {
    const user = userEvent.setup()
    const onPhotoChange = vi.fn()
    const mockFile = new File(['img'], 'my-list.png', { type: 'image/png' })
    renderDump({ photoFile: mockFile, onPhotoChange })
    await user.click(screen.getByTestId('remove-photo-btn'))
    expect(onPhotoChange).toHaveBeenCalledWith(null)
  })

  it('placeholder text is warm and inviting (not generic)', () => {
    renderDump()
    const textarea = screen.getByRole('textbox')
    const placeholder = textarea.getAttribute('placeholder') ?? ''
    expect(placeholder.toLowerCase()).not.toBe('enter text')
    expect(placeholder.toLowerCase()).not.toBe('type here')
    expect(placeholder.length).toBeGreaterThan(20)
  })
})
