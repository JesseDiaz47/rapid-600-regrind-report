import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppState } from './useAppState'

const start = {
  materialType: 'Micro' as const,
  rollId: null,
  startTime: '10:00',
  inputWeight: 500,
  notes: '',
  operatorName: 'Test Operator',
}

describe('useAppState single active run', () => {
  beforeEach(() => window.localStorage.clear())

  it('starts exactly one run', () => {
    const { result } = renderHook(() => useAppState())
    act(() => result.current.actions.startRoll(start))
    expect(result.current.state.runs.length).toBe(1)
    expect(result.current.activeRun).not.toBeNull()
  })

  it('ignores a second start while a run is active', () => {
    const { result } = renderHook(() => useAppState())
    act(() => result.current.actions.startRoll(start))
    act(() => result.current.actions.startRoll({ ...start, startTime: '11:00' }))
    expect(result.current.state.runs.length).toBe(1)
    expect(result.current.state.runs.filter((r) => r.active).length).toBe(1)
  })

  it('is a no-op under a rapid double invocation in the same tick', () => {
    const { result } = renderHook(() => useAppState())
    act(() => {
      result.current.actions.startRoll(start)
      result.current.actions.startRoll({ ...start, startTime: '11:00' })
    })
    expect(result.current.state.runs.filter((r) => r.active).length).toBe(1)
    expect(result.current.state.runs.length).toBe(1)
  })

  it('allows a new start after the active run is finished', () => {
    const { result } = renderHook(() => useAppState())
    act(() => result.current.actions.startRoll(start))
    const id = result.current.state.runs[0].id
    act(() =>
      result.current.actions.finishRoll(id, {
        endTime: '11:00',
        peakAmps: null,
        runningOutAmps: null,
        outputWeight: null,
        issues: [],
        notes: '',
      }),
    )
    act(() => result.current.actions.startRoll({ ...start, startTime: '12:00' }))
    expect(result.current.state.runs.length).toBe(2)
    expect(result.current.state.runs.filter((r) => r.active).length).toBe(1)
  })
})
