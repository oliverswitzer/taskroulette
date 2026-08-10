import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DumpScreen from '../../src/components/DumpScreen'

// Mock the Google Tasks hook so we can drive an "authenticated with tasks"
// state without a real OAuth/Supabase round-trip.
const mockUseGoogleTasks = vi.fn()
vi.mock('../../src/hooks/useGoogleTasks', () => ({
  useGoogleTasks: () => mockUseGoogleTasks(),
}))

function idleGoogleTasksState() {
  return {
    authState: 'idle' as const,
    tasks: [],
    isLoading: false,
    error: null,
    isMockMode: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  }
}

function authenticatedGoogleTasksState() {
  return {
    authState: 'authenticated' as const,
    tasks: [
      { id: 'g1', title: 'Buy milk', listId: 'l1', listTitle: 'Errands', status: 'needsAction' as const },
      { id: 'g2', title: 'Call dentist', listId: 'l1', listTitle: 'Errands', status: 'needsAction' as const },
    ],
    isLoading: false,
    error: null,
    isMockMode: false,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  }
}

beforeEach(() => {
  mockUseGoogleTasks.mockReturnValue(idleGoogleTasksState())
})

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

  it('renders an "Add Google Tasks" button next to the photo attach button', () => {
    mockUseGoogleTasks.mockReturnValue(authenticatedGoogleTasksState())
    renderDump()
    expect(screen.getByTestId('add-google-tasks-btn')).toBeInTheDocument()
  })

  it('clicking "Add Google Tasks" opens the Google Tasks sheet', async () => {
    mockUseGoogleTasks.mockReturnValue(authenticatedGoogleTasksState())
    const user = userEvent.setup()
    renderDump()
    expect(screen.queryByTestId('google-tasks-sheet')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('add-google-tasks-btn'))
    expect(screen.getByTestId('google-tasks-sheet')).toBeInTheDocument()
  })
})

describe('DumpScreen — Google Tasks freeform import', () => {
  it('appends imported Google task titles as newline-separated text into the empty textarea', async () => {
    mockUseGoogleTasks.mockReturnValue(authenticatedGoogleTasksState())
    const user = userEvent.setup()
    renderDump()

    await user.click(screen.getByTestId('add-google-tasks-btn'))
    await waitFor(() => expect(screen.getByTestId('google-list-picker')).toBeInTheDocument())
    await user.click(screen.getByTestId('google-list-row'))
    await waitFor(() => expect(screen.getByTestId('google-task-list')).toBeInTheDocument())

    await user.click(screen.getByTestId('google-task-row-g1'))
    await user.click(screen.getByTestId('google-task-row-g2'))
    await user.click(screen.getByTestId('google-import-btn'))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toBe('Buy milk\nCall dentist'))
  })

  it('appends with a newline separator when textarea already has content', async () => {
    mockUseGoogleTasks.mockReturnValue(authenticatedGoogleTasksState())
    const user = userEvent.setup()
    renderDump()

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.type(textarea, 'Existing task')

    await user.click(screen.getByTestId('add-google-tasks-btn'))
    await waitFor(() => expect(screen.getByTestId('google-list-picker')).toBeInTheDocument())
    await user.click(screen.getByTestId('google-list-row'))
    await waitFor(() => expect(screen.getByTestId('google-task-list')).toBeInTheDocument())
    await user.click(screen.getByTestId('google-task-row-g1'))
    await user.click(screen.getByTestId('google-import-btn'))

    await waitFor(() => expect(textarea.value).toBe('Existing task\nBuy milk'))
  })

  it('closes the sheet after import without touching the textarea when the sheet is dismissed unused', async () => {
    mockUseGoogleTasks.mockReturnValue(authenticatedGoogleTasksState())
    const user = userEvent.setup()
    renderDump()

    await user.click(screen.getByTestId('add-google-tasks-btn'))
    await waitFor(() => expect(screen.getByTestId('google-tasks-sheet')).toBeInTheDocument())
    await user.click(screen.getByLabelText('Close'))

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })
})
