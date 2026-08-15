import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunForm } from './RunForm'

describe('RunForm validation', () => {
  it('blocks saving without an input weight', () => {
    const onSave = vi.fn()
    render(
      <RunForm
        initial={null}
        defaultOperatorName="Test Operator"
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Save run/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/input weight/i)
  })

  it('blocks saving an out-of-range peak amps value in code, beyond HTML attrs', () => {
    // Peak amps carries no HTML max attribute, so this exercises the JS guard.
    const onSave = vi.fn()
    render(
      <RunForm
        initial={null}
        defaultOperatorName="Test Operator"
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Peak amps'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /Save run/i }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/too large/i)
  })

  it('saves a valid run and keeps blank optionals null', () => {
    const onSave = vi.fn()
    render(
      <RunForm
        initial={null}
        defaultOperatorName="Test Operator"
        onSave={onSave}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '08:30' } })
    fireEvent.change(screen.getByLabelText('Input weight (lb)'), { target: { value: '300' } })
    fireEvent.click(screen.getByRole('button', { name: /Save run/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    const draft = onSave.mock.calls[0][0]
    expect(draft.inputWeight).toBe(300)
    expect(draft.outputWeight).toBeNull()
    expect(draft.peakAmps).toBeNull()
    expect(draft.operatorName).toBe('Test Operator')
  })
})
