import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { ROSTER_KEY, CURRENT_OPERATOR_KEY } from './hooks/useRoster'

function nav(name: RegExp) {
  return screen.getByRole('button', { name })
}

/** Seed a signed-in operator so tests land past the sign-in gate. */
function signInTestOperator() {
  const id = 'employee-test'
  window.localStorage.setItem(
    ROSTER_KEY,
    JSON.stringify([{ id, name: 'Test Operator', pin: null, active: true }]),
  )
  window.localStorage.setItem(CURRENT_OPERATOR_KEY, id)
}

describe('App workflow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    signInTestOperator()
  })
  afterEach(() => vi.useRealTimers())

  it('renders the Pulse screen with an idle state by default', () => {
    render(<App />)
    expect(screen.getByText('No active roll')).toBeInTheDocument()
    expect(screen.getAllByText(/VFD 20/i).length).toBeGreaterThan(0)
  })

  it('starts and finishes a roll and shows computed throughput', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(nav(/^Log$/))

    // Start a roll: Micro, 10:00, 600 lb
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '600' } })
    await user.click(screen.getByRole('button', { name: /Start Roll/i }))

    // Now in the active/finish state
    expect(screen.getByRole('button', { name: /Finish Roll/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '11:00' } })
    await user.click(screen.getByRole('button', { name: /Finish Roll/i }))

    // The completed run appears in the shift list with 600 lb/hr throughput
    expect(screen.getByText('This shift (1)')).toBeInTheDocument()
    expect(screen.getByText('600 lb/hr')).toBeInTheDocument()
  })

  it('uses the action time for untouched start and finish defaults', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-12T10:00:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(nav(/^Log$/))
    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '600' } })

    vi.setSystemTime(new Date('2026-07-12T10:05:00'))
    await user.click(screen.getByRole('button', { name: /Start Roll/i }))
    expect(screen.getByText(/Started 10:05/)).toBeInTheDocument()

    vi.setSystemTime(new Date('2026-07-12T10:35:00'))
    await user.click(screen.getByRole('button', { name: /Finish Roll/i }))

    expect(screen.getByText('This shift (1)')).toBeInTheDocument()
    expect(screen.getByText('1,200 lb/hr')).toBeInTheDocument()
  })

  it('blocks invalid nonblank input weight when starting a roll', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav(/^Log$/))

    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '-5' } })
    await user.click(screen.getByRole('button', { name: /Start Roll/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('cannot be negative')
    expect(screen.queryByRole('button', { name: /Finish Roll/i })).not.toBeInTheDocument()
  })

  it('builds and opens a shareable PDF from Reference', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shift-report')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    render(<App />)

    await user.click(nav(/^Reference$/))
    await user.click(screen.getByRole('button', { name: /Export PDF report/i }))

    expect(click).toHaveBeenCalledOnce()
    expect(await screen.findByRole('status')).toHaveTextContent(/PDF opened/i)
  })

  it('supports manual entry and confirmed deletion with undo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav(/^Log$/))

    await user.click(screen.getByRole('button', { name: /Manual entry/i }))
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '08:30' } })
    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '300' } })
    await user.click(screen.getByRole('button', { name: /Save run/i }))

    expect(screen.getByText('This shift (1)')).toBeInTheDocument()

    // Expand the card (its summary button name includes the throughput)
    await user.click(screen.getByRole('button', { name: /600 lb\/hr/i }))
    const card = screen.getByText('300 lb').closest('.run-card') as HTMLElement
    await user.click(within(card).getByRole('button', { name: /^Delete$/i }))
    await user.click(within(card).getByRole('button', { name: /Confirm delete/i }))

    expect(screen.getByText('This shift (0)')).toBeInTheDocument()

    // Undo restores it
    await user.click(screen.getByRole('button', { name: /Undo/i }))
    expect(screen.getByText('This shift (1)')).toBeInTheDocument()
  })
})

describe('Operator sign-in gate', () => {
  beforeEach(() => window.localStorage.clear())

  it('blocks the app until an operator is picked from the roster', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      ROSTER_KEY,
      JSON.stringify([{ id: 'employee-a', name: 'Alex Rivera', pin: null, active: true }]),
    )
    render(<App />)

    expect(screen.getByText("Who's working?")).toBeInTheDocument()
    expect(screen.queryByText('No active roll')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Alex Rivera' }))
    expect(screen.getByText('No active roll')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alex Rivera' })).toBeInTheDocument()
  })

  it('lets the first employee be added directly from the gate when the roster is empty', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText("Who's working?")).toBeInTheDocument()
    expect(screen.getByText(/No employees on the roster yet/)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('First name / initials'), 'Lenny')
    await user.click(screen.getByRole('button', { name: /Add employee/i }))

    // The new name now appears as a pickable tile — no reload required.
    const tile = screen.getByRole('button', { name: 'Lenny' })
    expect(tile).toBeInTheDocument()
    await user.click(tile)
    expect(screen.getByText('No active roll')).toBeInTheDocument()
  })
})
