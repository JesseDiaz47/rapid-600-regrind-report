import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useRoster } from './useRoster'
import * as reportsFolder from '../lib/reportsFolder'

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

  it('merges a restored roster onto an empty device', () => {
    const { result } = renderHook(() => useRoster())
    let added = 0
    act(() => {
      added = result.current.mergeRoster([
        { id: 'employee-1', name: 'Jesse D', pin: null, active: true },
        { id: 'employee-2', name: 'Sam', pin: '1234', active: true },
      ])
    })

    expect(added).toBe(2)
    expect(result.current.activeRoster.map((e) => e.name)).toEqual(['Jesse D', 'Sam'])
  })

  it('keeps people the device has that the backup does not', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Hired Yesterday', null))

    act(() => {
      result.current.mergeRoster([{ id: 'employee-1', name: 'Jesse D', pin: null, active: true }])
    })

    expect(result.current.activeRoster.map((e) => e.name)).toEqual(['Hired Yesterday', 'Jesse D'])
  })

  it('does not resurrect an employee removed since the backup was taken', () => {
    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Departed', null))
    const id = result.current.activeRoster[0].id
    act(() => result.current.deactivateEmployee(id))

    // The backup still has them active, from before they were removed.
    let added = 0
    act(() => {
      added = result.current.mergeRoster([{ id, name: 'Departed', pin: null, active: true }])
    })

    expect(added).toBe(0)
    expect(result.current.activeRoster).toHaveLength(0)
    expect(result.current.roster[0].active).toBe(false)
  })

  it('does not duplicate someone retyped by hand before the restore', () => {
    const { result } = renderHook(() => useRoster())
    // Retyped after a wipe, so the same person carries a brand-new id.
    act(() => result.current.addEmployee('Sam', null))

    let added = 0
    act(() => {
      added = result.current.mergeRoster([
        { id: 'employee-old-sam', name: ' sam ', pin: '1234', active: true },
        { id: 'employee-old-alex', name: 'Alex', pin: null, active: true },
      ])
    })

    expect(added).toBe(1)
    expect(result.current.roster.map((e) => e.name)).toEqual(['Sam', 'Alex'])
    // The device's Sam wins, so the stale PIN does not silently reappear.
    expect(result.current.roster[0].pin).toBeNull()
  })

  it('survives a remount after merging', () => {
    const first = renderHook(() => useRoster())
    act(() => {
      first.result.current.mergeRoster([
        { id: 'employee-1', name: 'Jesse D', pin: null, active: true },
      ])
    })
    first.unmount()

    const second = renderHook(() => useRoster())
    expect(second.result.current.roster.map((e) => e.name)).toEqual(['Jesse D'])
  })

  it('mirrors the roster into the reports folder when one is connected', async () => {
    const fakeFolder = { name: 'Reports' } as unknown as FileSystemDirectoryHandle
    vi.spyOn(reportsFolder, 'getGrantedReportsFolder').mockResolvedValue(fakeFolder)
    const writeFileSpy = vi.spyOn(reportsFolder, 'writeFile').mockResolvedValue(42)

    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))

    await waitFor(() => expect(writeFileSpy).toHaveBeenCalled())
    const [folderArg, filename, contents, mime] = writeFileSpy.mock.calls.at(-1)!
    expect(folderArg).toBe(fakeFolder)
    expect(filename).toBe('rapid-600-roster.json')
    expect(mime).toBe('application/json')
    expect(JSON.parse(contents as string).roster[0].name).toBe('Alex Rivera')

    vi.restoreAllMocks()
  })

  it('does not throw when no reports folder is connected', async () => {
    vi.spyOn(reportsFolder, 'getGrantedReportsFolder').mockResolvedValue(null)
    const writeFileSpy = vi.spyOn(reportsFolder, 'writeFile')

    const { result } = renderHook(() => useRoster())
    act(() => result.current.addEmployee('Alex Rivera', null))

    await waitFor(() => expect(result.current.activeRoster).toHaveLength(1))
    expect(writeFileSpy).not.toHaveBeenCalled()

    vi.restoreAllMocks()
  })
})
