import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRoster } from './useRoster'

describe('useRoster', () => {
  beforeEach(() => window.localStorage.clear())

  it('starts with an empty roster and no signed-in operator', () => {
    const { result } = renderHook(() => useRoster())
    expect(result.current.roster).toEqual([])
    expect(result.current.currentOperator).toBeNull()
  })

  it('adds an employee and signs them in without a PIN', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))
    expect(result.current.activeRoster).toHaveLength(1)

    const id = result.current.activeRoster[0].id
    let ok = false
    act(() => {
      ok = result.current.selectOperator(id)
    })
    expect(ok).toBe(true)
    expect(result.current.currentOperator?.name).toBe('Alex Rivera')
  })

  it('requires the correct PIN to sign in when one is set', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Sam Lee', '4821'))
    const id = result.current.activeRoster[0].id

    let wrong = true
    act(() => {
      wrong = result.current.selectOperator(id, '0000')
    })
    expect(wrong).toBe(false)
    expect(result.current.currentOperator).toBeNull()

    let right = false
    act(() => {
      right = result.current.selectOperator(id, '4821')
    })
    expect(right).toBe(true)
    expect(result.current.currentOperator?.name).toBe('Sam Lee')
  })

  it('signs out without touching the roster', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))
    const id = result.current.activeRoster[0].id
    act(() => {
      result.current.selectOperator(id)
    })
    expect(result.current.currentOperator).not.toBeNull()

    act(() => result.current.signOut())
    expect(result.current.currentOperator).toBeNull()
    expect(result.current.roster).toHaveLength(1)
  })

  it('deactivating the signed-in operator signs them out and drops them from activeRoster', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))
    const id = result.current.activeRoster[0].id
    act(() => {
      result.current.selectOperator(id)
    })

    act(() => result.current.deactivateEmployee(id))
    expect(result.current.currentOperator).toBeNull()
    expect(result.current.activeRoster).toHaveLength(0)
    // Still on the full roster, just inactive — history stays resolvable.
    expect(result.current.roster).toHaveLength(1)
    expect(result.current.roster[0].active).toBe(false)
  })

  it('reactivating a former employee brings them back to activeRoster', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))
    const id = result.current.activeRoster[0].id
    act(() => result.current.deactivateEmployee(id))
    expect(result.current.activeRoster).toHaveLength(0)

    act(() => result.current.reactivateEmployee(id))
    expect(result.current.activeRoster).toHaveLength(1)
  })

  it('persists the roster and current operator across remounts', () => {
    const first = renderHook(() => useRoster())
    act(() => first.result.current.addEmployee('Alex Rivera', null))
    const id = first.result.current.activeRoster[0].id
    act(() => {
      first.result.current.selectOperator(id)
    })
    first.unmount()

    const second = renderHook(() => useRoster())
    expect(second.result.current.roster).toHaveLength(1)
    expect(second.result.current.currentOperator?.name).toBe('Alex Rivera')
  })
})
