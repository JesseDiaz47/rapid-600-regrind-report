import { useState } from 'react'
import type { UseRoster } from '../../hooks/useRoster'

/**
 * Full-screen "who's working?" picker shown whenever no operator is signed
 * in. This is the app's sign-in surface: local roster attribution for
 * accountability, not authentication — no backend, no password, a PIN (if
 * set) only guards against tapping the wrong name on a shared device.
 */
export function OperatorGate({ roster }: { roster: UseRoster }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pendingEmployee = roster.activeRoster.find((e) => e.id === pendingId) ?? null

  function pick(id: string) {
    setError(null)
    const employee = roster.activeRoster.find((e) => e.id === id)
    if (!employee) return
    if (!employee.pin) {
      roster.selectOperator(id)
      return
    }
    setPendingId(id)
    setPin('')
  }

  function submitPin(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingId) return
    const ok = roster.selectOperator(pendingId, pin)
    if (!ok) {
      setError('Wrong PIN.')
      setPin('')
      return
    }
  }

  return (
    <div className="operator-gate">
      <div className="operator-gate__card">
        <p className="operator-gate__kicker">Rapid 600 · Regrind Log</p>
        <h1>Who&apos;s working?</h1>

        {roster.activeRoster.length === 0 ? (
          <p className="hint-text">
            No employees on the roster yet. Ask a manager to add names in Reference →
            Employees.
          </p>
        ) : pendingEmployee ? (
          <form onSubmit={submitPin} className="operator-gate__pin">
            <p>
              PIN for <b>{pendingEmployee.name}</b>
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError(null)
              }}
              className="operator-gate__pin-input"
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="button-stack">
              <button type="submit" className="btn btn-primary btn-lg btn-block">
                Sign in
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setPendingId(null)
                  setPin('')
                  setError(null)
                }}
              >
                Not you? Pick another name
              </button>
            </div>
          </form>
        ) : (
          <div className="operator-gate__roster">
            {roster.activeRoster.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className="operator-gate__name"
                onClick={() => pick(employee.id)}
              >
                {employee.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
