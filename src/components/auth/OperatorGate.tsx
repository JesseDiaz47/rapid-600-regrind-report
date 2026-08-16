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
  const [newName, setNewName] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recovered, setRecovered] = useState(false)

  const pendingEmployee = roster.activeRoster.find((e) => e.id === pendingId) ?? null
  const anyPins = roster.activeRoster.some((e) => e.pin)

  /**
   * Escape hatch for a PIN nobody remembers. Without it the gate covers the
   * whole app with no way past, which on a tablet at the machine means the
   * shift cannot be logged at all.
   */
  function clearPins() {
    roster.clearPins()
    setRecovering(false)
    setRecovered(true)
    setPendingId(null)
    setPin('')
    setError(null)
  }

  function addFirstEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    roster.addEmployee(newName, null)
    setNewName('')
  }

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
          <form onSubmit={addFirstEmployee} className="operator-gate__first">
            <p className="hint-text">
              No employees on the roster yet. Add the first name to get started — once someone&apos;s
              on the roster, new names get added from Reference → Employees instead.
            </p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="First name / initials"
              className="operator-gate__text-input"
            />
            <button type="submit" className="btn btn-primary btn-lg btn-block">
              Add employee
            </button>
          </form>
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

        {recovered && (
          <p className="restore-ok" role="status">
            PINs cleared. Tap your name to sign in — you can set a new PIN in Reference →
            Employees.
          </p>
        )}

        {anyPins && !recovered && (
          <div className="operator-gate__recovery">
            {recovering ? (
              <>
                <p className="hint-text">
                  Clear the PIN from every name on this device? Names and logged runs are kept —
                  this only removes the PIN guard, and a new one can be set from Reference →
                  Employees.
                </p>
                <div className="button-stack">
                  <button type="button" className="btn btn-primary btn-block" onClick={clearPins}>
                    Clear PINs on this device
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => setRecovering(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => setRecovering(true)}
              >
                Can&apos;t sign in?
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
