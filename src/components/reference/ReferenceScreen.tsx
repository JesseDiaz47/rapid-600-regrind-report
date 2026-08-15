import { useEffect, useRef, useState } from 'react'
import type { UseAppState } from '../../hooks/useAppState'
import type { UseRoster } from '../../hooks/useRoster'
import type { MachineSettings, MaterialType } from '../../types/domain'
import { FIXED_VFD, MATERIAL_TYPES } from '../../types/domain'
import {
  MAX_WEIGHT,
  MAX_YIELD,
  numberToInput,
  validateNumberField,
  validateThresholds,
} from '../../lib/forms'
import { runsToCsv, serializeBackup, parseBackup } from '../../lib/importExport'
import { downloadTextFile, timestampSlug } from '../../lib/download'
import { buildShiftReportPdf, openOrSharePdf, pdfFilename } from '../../lib/pdfReport'
import {
  canSaveDirectly,
  hoursSinceLastBackup,
  readLastBackup,
  saveBackup,
  writeLastBackup,
  type LastBackupRecord,
} from '../../lib/localBackup'
import { fmtNum } from '../../lib/format'

interface ReferenceScreenProps {
  app: UseAppState
  quiet: boolean
  onQuietChange: (value: boolean) => void
  roster: UseRoster
}

export function ReferenceScreen({ app, quiet, onQuietChange, roster }: ReferenceScreenProps) {
  const { state, hasDemo, actions } = app
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pdfMsg, setPdfMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmNewShift, setConfirmNewShift] = useState(false)
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState<LastBackupRecord | null>(() => readLastBackup())

  // Refresh the "last backup" indicator whenever the screen mounts or the
  // saved state changes (a different shift date means the stale value should
  // stop counting as a recent backup).
  useEffect(() => {
    setLastBackup(readLastBackup())
  }, [state.shiftDate])

  function exportCsv() {
    const csv = runsToCsv(state.runs, state.settings)
    downloadTextFile(`regrind-${state.shiftDate}-${timestampSlug()}.csv`, csv, 'text/csv')
  }

  function exportJson() {
    const json = serializeBackup(state)
    downloadTextFile(`regrind-backup-${state.shiftDate}-${timestampSlug()}.json`, json, 'application/json')
  }

  async function saveBackupToFolder() {
    setBackupBusy(true)
    setBackupMsg(null)
    try {
      const result = await saveBackup(state)
      const record: LastBackupRecord = {
        exportedAt: new Date().toISOString(),
        filename: result.filename,
        destination: result.destination,
        bytes: result.bytes,
        shiftDate: state.shiftDate,
        runCount: state.runs.length,
      }
      writeLastBackup(record)
      setLastBackup(record)
      setBackupMsg({
        ok: true,
        text:
          result.destination === 'direct'
            ? `Saved ${result.filename} (${fmtNum(result.bytes)} bytes).`
            : `Downloaded ${result.filename}.`,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setBackupMsg({ ok: true, text: 'Backup canceled.' })
      } else {
        setBackupMsg({ ok: false, text: 'Could not save the backup. Reload the app and try again.' })
      }
    } finally {
      setBackupBusy(false)
    }
  }

  async function exportPdf() {
    setPdfBusy(true)
    setPdfMsg(null)
    try {
      const blob = buildShiftReportPdf(state)
      const delivery = await openOrSharePdf(blob, pdfFilename(state))
      setPdfMsg({
        ok: true,
        text:
          delivery === 'shared'
            ? 'PDF shared.'
            : 'PDF opened. Use the browser Share button to send or save it.',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setPdfMsg({ ok: true, text: 'PDF sharing canceled.' })
      } else {
        setPdfMsg({ ok: false, text: 'Could not create the PDF. Reload the app and try again.' })
      }
    } finally {
      setPdfBusy(false)
    }
  }

  function onRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseBackup(String(reader.result))
      if (result.ok) {
        actions.restore(result.state)
        setRestoreMsg({ ok: true, text: `Restored ${result.state.runs.length} runs.` })
      } else {
        setRestoreMsg({ ok: false, text: result.error })
      }
    }
    reader.onerror = () => setRestoreMsg({ ok: false, text: 'Could not read the file.' })
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="screen screen-reference">
      <p className="screen-intro">
        Every run is performed at a locked <b>VFD of {FIXED_VFD}</b>. This screen holds thresholds,
        material notes, formulas, and your local data tools.
      </p>

      {/* Thresholds */}
      <ThresholdEditor settings={state.settings} onUpdate={actions.updateSettings} />

      {/* Employees */}
      <EmployeesCard roster={roster} />

      {/* Material profiles */}
      <section className="card">
        <div className="card-title">Material notes</div>
        <div className="profile-list">
          {MATERIAL_TYPES.map((type) => (
            <ProfileEditor key={type} type={type} app={app} />
          ))}
        </div>
      </section>

      {/* Formulas */}
      <section className="card">
        <div className="card-title">Formulas</div>
        <ul className="formula-list">
          <li>
            <code>Duration</code> = end − start (adds 24h when the run crosses midnight)
          </li>
          <li>
            <code>lb/hr</code> = input weight ÷ (duration ÷ 60)
          </li>
          <li>
            <code>Yield %</code> = output weight ÷ input weight × 100 (blank if no output recorded)
          </li>
          <li>
            <code>A per 1k lb/hr</code> = peak amps ÷ lb/hr × 1000
          </li>
          <li>
            <code>Headroom</code> = trip threshold − peak amps
          </li>
        </ul>
        <p className="hint-text">
          Missing optional values stay blank — the app never invents amps, output weight, or times.
        </p>
      </section>

      {/* Data tools */}
      <section className="card">
        <div className="card-title">Data (local only)</div>
        <p className="hint-text">
          Runs live in this browser&apos;s storage. Backups are the only copy that survives
          clearing browser data — export one at the end of every shift.
        </p>
        <LastBackupStatus record={lastBackup} />
        <div className="button-stack">
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveBackupToFolder}
            disabled={backupBusy}
          >
            {backupBusy ? 'Saving backup…' : 'Save backup to folder…'}
          </button>
          <p className="hint-text">
            {canSaveDirectly()
              ? 'Opens a save dialog and writes the JSON directly to the folder you choose — pick a shared drive so the shift record is off this device.'
              : 'Downloads a JSON named with the shift date and time. Move it to a shared drive so the shift record is off this device.'}
          </p>
          {backupMsg && (
            <p className={backupMsg.ok ? 'restore-ok' : 'form-error'} role="status">
              {backupMsg.text}
            </p>
          )}
          <button type="button" className="btn" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            Export JSON backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Restore from JSON…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={onRestoreFile}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportPdf}
            disabled={pdfBusy}
          >
            {pdfBusy ? 'Creating PDF…' : 'Export PDF report'}
          </button>
          <p className="hint-text">
            Creates a shareable PDF with Shift Pulse, material insights, observed highlights, shift
            notes, and the complete run log.
          </p>
          {pdfMsg && (
            <p className={pdfMsg.ok ? 'restore-ok' : 'form-error'} role="status">
              {pdfMsg.text}
            </p>
          )}
        </div>
        {restoreMsg && (
          <p className={restoreMsg.ok ? 'restore-ok' : 'form-error'} role="status">
            {restoreMsg.text}
          </p>
        )}
      </section>

      {/* Shift notes */}
      <section className="card">
        <div className="card-title">Shift notes</div>
        <textarea
          value={state.shiftNotes}
          onChange={(e) => actions.setShiftNotes(e.target.value)}
          placeholder="Jams, thermal trips, knife condition, screen changes…"
        />
      </section>

      {/* Appearance */}
      <section className="card">
        <div className="card-title">Appearance</div>
        <label className="toggle-row">
          <span>Quiet Mode — stop the breathing geometry &amp; glow</span>
          <input
            type="checkbox"
            className="toggle-input"
            checked={quiet}
            onChange={(e) => onQuietChange(e.target.checked)}
          />
        </label>
      </section>

      {/* Demo data */}
      <section className="card">
        <div className="card-title">Demo data</div>
        <p className="hint-text">Load clearly-labeled sample runs to explore the app, then clear them.</p>
        <div className="button-stack">
          <button type="button" className="btn" onClick={actions.seedDemo}>
            Load demo runs
          </button>
          <button type="button" className="btn" onClick={actions.clearDemo} disabled={!hasDemo}>
            Clear demo runs
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="card danger-card">
        <div className="card-title">Shift controls</div>
        {confirmNewShift ? (
          <ConfirmRow
            text="Start a new shift? Runs and shift notes clear; thresholds and material notes stay."
            confirmLabel="New shift"
            onConfirm={() => {
              actions.newShift()
              setConfirmNewShift(false)
            }}
            onCancel={() => setConfirmNewShift(false)}
          />
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmNewShift(true)}>
            New shift
          </button>
        )}
        {confirmClear ? (
          <ConfirmRow
            text="Clear ALL data including thresholds and material notes? This cannot be undone."
            confirmLabel="Clear everything"
            danger
            onConfirm={() => {
              actions.clearAll()
              setConfirmClear(false)
            }}
            onCancel={() => setConfirmClear(false)}
          />
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)}>
            Clear all data
          </button>
        )}
      </section>

      <p className="disclaimer">
        Non-goals: no machine control, no VFD changes, no cloud, no cloud accounts or passwords, no
        telemetry. The employee picker is a local, on-device name selector for attribution only. All
        data stays in this browser — export a backup regularly, because clearing browser data erases
        it.
      </p>
    </div>
  )
}

/**
 * Amp thresholds edited through local string state so a temporarily blank field
 * never corrupts the stored settings with a 0. Only a fully valid pair (both
 * positive and safe < trip) is committed; anything else surfaces an inline
 * error while the last good values stay in effect for headroom math.
 */
function ThresholdEditor({
  settings,
  onUpdate,
}: {
  settings: MachineSettings
  onUpdate: (patch: Partial<MachineSettings>) => void
}) {
  const [safe, setSafe] = useState(numberToInput(settings.safeAmps))
  const [trip, setTrip] = useState(numberToInput(settings.tripAmps))
  const result = validateThresholds(safe, trip)

  function commit(nextSafe: string, nextTrip: string) {
    const res = validateThresholds(nextSafe, nextTrip)
    if (res.ok) onUpdate({ safeAmps: res.safeAmps, tripAmps: res.tripAmps })
  }

  return (
    <section className="card">
      <div className="card-title">Amp thresholds &amp; machine</div>
      <p className="hint-text">
        Values must match the approved SOP. Safe is the amber ceiling; trip is the red limit.
      </p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="safe">Safe ceiling (A)</label>
          <input
            id="safe"
            type="number"
            inputMode="decimal"
            min="0"
            value={safe}
            onChange={(e) => {
              setSafe(e.target.value)
              commit(e.target.value, trip)
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="trip">Trip threshold (A)</label>
          <input
            id="trip"
            type="number"
            inputMode="decimal"
            min="0"
            value={trip}
            onChange={(e) => {
              setTrip(e.target.value)
              commit(safe, e.target.value)
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="screen">Screen size</label>
        <input
          id="screen"
          value={settings.screenSize}
          onChange={(e) => onUpdate({ screenSize: e.target.value })}
          placeholder='e.g. 3/8"'
        />
      </div>
      {!result.ok && (
        <p className="form-error" role="alert">
          {result.error} Last valid thresholds stay in effect until this is fixed.
        </p>
      )}
    </section>
  )
}

/**
 * Employee roster management. Local-only attribution, not accounts — adding
 * a name here just makes it selectable at sign-in; an optional PIN only
 * guards against tapping the wrong name on a shared device.
 */
function EmployeesCard({ roster }: { roster: UseRoster }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const inactive = roster.roster.filter((e) => !e.active)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    roster.addEmployee(name, pin.trim() || null)
    setName('')
    setPin('')
  }

  return (
    <section className="card">
      <div className="card-title">Employees</div>
      <p className="hint-text">
        Names here appear on the sign-in screen and are attached to the runs each person logs.
        An optional PIN just guards against picking the wrong name on a shared device — it is
        not a password or account.
      </p>

      {roster.activeRoster.length > 0 && (
        <ul className="employee-list">
          {roster.activeRoster.map((employee) => (
            <li key={employee.id} className="employee-row">
              <span>
                {employee.name}
                {employee.pin ? ' · PIN set' : ''}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => roster.deactivateEmployee(employee.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit}>
        <div className="field-row employee-form">
          <div className="field">
            <label htmlFor="emp-name">Name</label>
            <input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name / initials"
            />
          </div>
          <div className="field">
            <label htmlFor="emp-pin">PIN (optional)</label>
            <input
              id="emp-pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="e.g. 4821"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          Add employee
        </button>
      </form>

      {inactive.length > 0 && (
        <div className="employee-inactive">
          <p className="hint-text">Removed: {inactive.map((e) => e.name).join(', ')}</p>
        </div>
      )}
    </section>
  )
}

function ProfileEditor({ type, app }: { type: MaterialType; app: UseAppState }) {
  const profile = app.state.profiles.find((p) => p.type === type)
  const [rate, setRate] = useState(numberToInput(profile?.targetRate ?? null))
  const [expectedYield, setExpectedYield] = useState(numberToInput(profile?.expectedYield ?? null))
  if (!profile) return null

  const rateRes = validateNumberField(rate, { label: 'Target lb/hr', max: MAX_WEIGHT })
  const yieldRes = validateNumberField(expectedYield, { label: 'Target yield', max: MAX_YIELD })
  const error = !rateRes.ok ? rateRes.error : !yieldRes.ok ? yieldRes.error : null

  function commitRate(v: string) {
    setRate(v)
    const res = validateNumberField(v, { label: 'Target lb/hr', max: MAX_WEIGHT })
    if (res.ok) app.actions.updateProfile(type, { targetRate: res.value })
  }
  function commitYield(v: string) {
    setExpectedYield(v)
    const res = validateNumberField(v, { label: 'Target yield', max: MAX_YIELD })
    if (res.ok) app.actions.updateProfile(type, { expectedYield: res.value })
  }

  return (
    <div className="profile-editor">
      <div className="profile-editor__head">{type}</div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`pr-rate-${type}`}>Target lb/hr</label>
          <input
            id={`pr-rate-${type}`}
            type="number"
            inputMode="decimal"
            min="0"
            value={rate}
            onChange={(e) => commitRate(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="field">
          <label htmlFor={`pr-yield-${type}`}>Target yield %</label>
          <input
            id={`pr-yield-${type}`}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={expectedYield}
            onChange={(e) => commitYield(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`pr-note-${type}`}>Notes</label>
        <input
          id={`pr-note-${type}`}
          value={profile.notes}
          onChange={(e) => app.actions.updateProfile(type, { notes: e.target.value })}
          placeholder="Operating notes for this material"
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function ConfirmRow({
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  text: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="confirm-row" role="alertdialog" aria-label={text}>
      <p>{text}</p>
      <div className="confirm-row__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const last = Date.parse(iso)
  if (Number.isNaN(last)) return 'unknown time'
  const diffMin = Math.round((Date.now() - last) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
}

function LastBackupStatus({ record }: { record: LastBackupRecord | null }) {
  if (!record) {
    return (
      <p className="hint-text" data-testid="last-backup-status">
        <b>No backup on this device yet.</b> Tap <i>Save shift backup</i> at the end of every shift.
      </p>
    )
  }
  const hours = hoursSinceLastBackup(record)
  const stale = hours === null || hours > 12
  return (
    <p
      className={stale ? 'form-error' : 'restore-ok'}
      data-testid="last-backup-status"
      role="status"
    >
      Last backup: {record.filename} · {formatRelative(record.exportedAt)} ·{' '}
      {record.destination === 'direct' ? 'saved in place' : 'download'} ·{' '}
      {record.runCount} run{record.runCount === 1 ? '' : 's'}.{' '}
      {stale ? 'This is older than 12 hours — back up again.' : 'Recent.'}
    </p>
  )
}
