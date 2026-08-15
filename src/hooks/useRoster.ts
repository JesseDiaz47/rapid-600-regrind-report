import { useCallback, useEffect, useState } from 'react'
import type { Employee } from '../types/domain'
import { sanitizeRoster } from '../lib/sanitize'
import { createId } from '../lib/id'

/**
 * Employee roster and current-operator identity. Persisted separately from
 * shift data (its own localStorage keys) so it survives New Shift and Clear
 * All — an employee list and who's currently signed in are organizational
 * state, not shift state.
 *
 * This is local-only attribution for accountability and reporting, not
 * authentication: no backend, no session, no password. A PIN (if an employee
 * sets one) only guards against tapping the wrong name on a shared device.
 */
export const ROSTER_KEY = 'regrind-vfd-roster'
export const CURRENT_OPERATOR_KEY = 'regrind-vfd-current-operator'

function loadRoster(): Employee[] {
  try {
    const raw = window.localStorage.getItem(ROSTER_KEY)
    if (!raw) return []
    return sanitizeRoster(JSON.parse(raw))
  } catch {
    return []
  }
}

function saveRoster(roster: Employee[]): void {
  try {
    window.localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
  } catch {
    /* storage may be unavailable; in-memory roster remains authoritative */
  }
}

function loadCurrentOperatorId(): string | null {
  try {
    return window.localStorage.getItem(CURRENT_OPERATOR_KEY)
  } catch {
    return null
  }
}

function saveCurrentOperatorId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CURRENT_OPERATOR_KEY, id)
    else window.localStorage.removeItem(CURRENT_OPERATOR_KEY)
  } catch {
    /* ignore */
  }
}

export interface UseRoster {
  roster: Employee[]
  activeRoster: Employee[]
  currentOperator: Employee | null
  addEmployee: (name: string, pin: string | null) => void
  deactivateEmployee: (id: string) => void
  reactivateEmployee: (id: string) => void
  /** Returns false if a PIN is set and doesn't match. */
  selectOperator: (id: string, pin?: string) => boolean
  signOut: () => void
}

export function useRoster(): UseRoster {
  const [roster, setRoster] = useState<Employee[]>(() => loadRoster())
  const [currentOperatorId, setCurrentOperatorId] = useState<string | null>(() =>
    loadCurrentOperatorId(),
  )

  useEffect(() => saveRoster(roster), [roster])
  useEffect(() => saveCurrentOperatorId(currentOperatorId), [currentOperatorId])

  const currentOperator = roster.find((e) => e.id === currentOperatorId) ?? null

  // If the signed-in employee was deactivated or removed, drop back to signed-out.
  useEffect(() => {
    if (currentOperatorId && !currentOperator) setCurrentOperatorId(null)
  }, [currentOperatorId, currentOperator])

  const addEmployee = useCallback((name: string, pin: string | null) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setRoster((r) => [...r, { id: createId('employee'), name: trimmed, pin, active: true }])
  }, [])

  const deactivateEmployee = useCallback((id: string) => {
    setRoster((r) => r.map((e) => (e.id === id ? { ...e, active: false } : e)))
    setCurrentOperatorId((cur) => (cur === id ? null : cur))
  }, [])

  const reactivateEmployee = useCallback((id: string) => {
    setRoster((r) => r.map((e) => (e.id === id ? { ...e, active: true } : e)))
  }, [])

  const selectOperator = useCallback(
    (id: string, pin?: string): boolean => {
      const employee = roster.find((e) => e.id === id)
      if (!employee) return false
      if (employee.pin && employee.pin !== pin) return false
      setCurrentOperatorId(id)
      return true
    },
    [roster],
  )

  const signOut = useCallback(() => setCurrentOperatorId(null), [])

  return {
    roster,
    activeRoster: roster.filter((e) => e.active),
    currentOperator,
    addEmployee,
    deactivateEmployee,
    reactivateEmployee,
    selectOperator,
    signOut,
  }
}
