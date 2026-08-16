import { useCallback, useEffect, useState } from 'react'
import type { Employee } from '../types/domain'
import { sanitizeRoster } from '../lib/sanitize'
import { createId } from '../lib/id'
import { getGrantedReportsFolder, writeFile } from '../lib/reportsFolder'

const ROSTER_BACKUP_FILENAME = 'rapid-600-roster.json'

/**
 * Best-effort mirror of the roster into the connected Reports folder (see
 * reportsFolder.ts), so the employee list isn't solely trapped in this
 * browser's localStorage. Silently does nothing if no folder is connected or
 * permission has lapsed — the roster's source of truth stays localStorage;
 * this is a convenience copy, not a requirement for the app to function.
 */
async function mirrorRosterToReportsFolder(roster: Employee[]): Promise<void> {
  try {
    const folder = await getGrantedReportsFolder()
    if (!folder) return
    const envelope = { app: 'rapid-600-regrind-report', exportedAt: new Date().toISOString(), roster }
    await writeFile(folder, ROSTER_BACKUP_FILENAME, JSON.stringify(envelope, null, 2), 'application/json')
  } catch {
    /* best-effort only; localStorage remains authoritative */
  }
}

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
  /** Add employees from a restored backup. Returns how many were added. */
  mergeRoster: (incoming: Employee[]) => number
  /** Drop the PIN from every name on this device. Returns how many were cleared. */
  clearPins: () => number
}

export function useRoster(): UseRoster {
  const [roster, setRoster] = useState<Employee[]>(() => loadRoster())
  const [currentOperatorId, setCurrentOperatorId] = useState<string | null>(() =>
    loadCurrentOperatorId(),
  )

  useEffect(() => saveRoster(roster), [roster])
  useEffect(() => saveCurrentOperatorId(currentOperatorId), [currentOperatorId])
  useEffect(() => {
    void mirrorRosterToReportsFolder(roster)
  }, [roster])

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

  /**
   * Merge a restored roster into this device's, adding only people the device
   * doesn't already have. The device is "now" and the backup is "then", so an
   * entry on both sides keeps the device's version — otherwise restoring an
   * older backup onto a tablet that's in use would resurrect employees who
   * have since been removed.
   *
   * Names are matched alongside ids because the common recovery is to retype
   * a couple of names after a wipe and only then remember the backup: those
   * people have fresh ids, and matching on id alone would list every one of
   * them twice on the sign-in screen.
   */
  const mergeRoster = useCallback(
    (incoming: Employee[]): number => {
      const ids = new Set(roster.map((e) => e.id))
      const names = new Set(roster.map((e) => e.name.trim().toLowerCase()))
      const additions: Employee[] = []

      for (const employee of incoming) {
        const name = employee.name.trim().toLowerCase()
        if (ids.has(employee.id) || names.has(name)) continue
        ids.add(employee.id)
        names.add(name)
        additions.push(employee)
      }

      if (additions.length > 0) setRoster((current) => [...current, ...additions])
      return additions.length
    },
    [roster],
  )

  /**
   * Drop every PIN on this device, so a forgotten one stops being a dead end.
   *
   * A PIN only guards against tapping the wrong name on a shared device, but
   * the sign-in gate covers the whole app, so a name whose PIN nobody
   * remembers locked the tablet out entirely — with no way back that didn't
   * involve a developer console. Names and logged runs are deliberately left
   * alone: this clears the guard, not the shift.
   */
  const clearPins = useCallback((): number => {
    const cleared = roster.filter((e) => e.pin !== null).length
    if (cleared > 0) {
      setRoster((current) => current.map((e) => (e.pin === null ? e : { ...e, pin: null })))
    }
    return cleared
  }, [roster])

  return {
    roster,
    activeRoster: roster.filter((e) => e.active),
    currentOperator,
    addEmployee,
    deactivateEmployee,
    reactivateEmployee,
    selectOperator,
    signOut,
    mergeRoster,
    clearPins,
  }
}
