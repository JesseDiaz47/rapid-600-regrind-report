import { useState } from 'react'
import type { UseAppState } from '../../hooks/useAppState'
import type { IssueFlag, MaterialType, Run } from '../../types/domain'
import { FIXED_VFD, ISSUE_FLAGS, MATERIAL_TYPES } from '../../types/domain'
import { RunForm } from './RunForm'
import { RunCard } from './RunCard'
import { useNow } from '../../hooks/useNow'
import { MAX_AMPS, MAX_WEIGHT, validateNumberField } from '../../lib/forms'
import { computeRunMetrics, parseTimeToMinutes } from '../../lib/calculations'
import { fmtElapsedClock, fmtRate, fmtWeight, nowTimeString } from '../../lib/format'
import { PlayIcon, CheckIcon, PlusIcon } from '../ui/icons'

interface LogScreenProps {
  app: UseAppState
  /** Name of the currently signed-in operator, attached to runs as they're logged. */
  operatorName: string
}

export function LogScreen({ app, operatorName }: LogScreenProps) {
  const { state, activeRun, canUndo, actions } = app
  const [editing, setEditing] = useState<Run | null>(null)
  const [manualNew, setManualNew] = useState(false)

  const completed = state.runs.filter((r) => !r.active)
  const ordered = [...completed].sort((a, b) => b.createdAt - a.createdAt)
  const lastRun = completed[completed.length - 1] ?? null

  // A recently-used material list for one-tap presets.
  const recent: MaterialType[] = []
  for (let i = completed.length - 1; i >= 0 && recent.length < 3; i--) {
    const t = completed[i].materialType
    if (!recent.includes(t)) recent.push(t)
  }

  return (
    <div className="screen screen-log">
      {editing ? (
        <section className="card">
          <div className="card-title">Edit run</div>
          <RunForm
            initial={editing}
            defaultOperatorName={operatorName}
            onSave={(draft) => {
              actions.saveManualRun(draft)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : activeRun ? (
        <FinishPanel app={app} activeRun={activeRun} />
      ) : manualNew ? (
        <section className="card">
          <div className="card-title">Manual completed run</div>
          <RunForm
            initial={null}
            defaultOperatorName={operatorName}
            onSave={(draft) => {
              actions.saveManualRun(draft)
              setManualNew(false)
            }}
            onCancel={() => setManualNew(false)}
          />
        </section>
      ) : (
        <StartPanel
          app={app}
          operatorName={operatorName}
          recent={recent}
          onManual={() => setManualNew(true)}
          canDuplicate={lastRun !== null}
          onDuplicate={() => lastRun && actions.duplicateRun(lastRun.id)}
        />
      )}

      {canUndo && (
        <div className="undo-banner" role="status">
          <span>Run deleted.</span>
          <button type="button" className="btn btn-ghost" onClick={actions.undoDelete}>
            Undo
          </button>
        </div>
      )}

      <h2 className="section-heading">This shift ({completed.length})</h2>
      {ordered.length === 0 ? (
        <p className="empty-hint card">
          No completed runs yet. Start a roll above, or add a completed run manually.
        </p>
      ) : (
        <div className="run-list">
          {ordered.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              settings={state.settings}
              onEdit={setEditing}
              onDuplicate={actions.duplicateRun}
              onDelete={actions.deleteRun}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Start Roll ---------------- */
function StartPanel({
  app,
  operatorName,
  recent,
  onManual,
  canDuplicate,
  onDuplicate,
}: {
  app: UseAppState
  operatorName: string
  recent: MaterialType[]
  onManual: () => void
  canDuplicate: boolean
  onDuplicate: () => void
}) {
  const [material, setMaterial] = useState<MaterialType>(recent[0] ?? 'Micro')
  const [rollId, setRollId] = useState('')
  const [startTime, setStartTime] = useState(nowTimeString())
  const [startTimeEdited, setStartTimeEdited] = useState(false)
  const [inputWeight, setInputWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function start() {
    const weight = validateNumberField(inputWeight, {
      label: 'Input weight',
      positive: true,
      max: MAX_WEIGHT,
    })
    if (!weight.ok) {
      setError(weight.error)
      return
    }
    setError(null)
    app.actions.startRoll({
      materialType: material,
      rollId: rollId.trim() || null,
      startTime: startTimeEdited ? startTime : nowTimeString(),
      inputWeight: weight.value,
      notes: notes.trim(),
      operatorName,
    })
    setRollId('')
    setInputWeight('')
    setNotes('')
  }

  return (
    <section className="card start-panel">
      <div className="card-title">Start a roll</div>

      {recent.length > 0 && (
        <div className="preset-row" aria-label="Recent materials">
          {recent.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${material === t ? ' chip--on' : ''}`}
              onClick={() => setMaterial(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="start-material">Material</label>
        <select
          id="start-material"
          value={material}
          onChange={(e) => setMaterial(e.target.value as MaterialType)}
        >
          {MATERIAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start-time">Start time</label>
          <input
            id="start-time"
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value)
              setStartTimeEdited(true)
            }}
          />
        </div>
        <div className="field field--locked">
          <label>VFD (locked)</label>
          <div className="locked-value">{FIXED_VFD}</div>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="start-weight">Input weight (lb)</label>
          <input
            id="start-weight"
            type="number"
            inputMode="decimal"
            min="0"
            max={MAX_WEIGHT}
            value={inputWeight}
            onChange={(e) => setInputWeight(e.target.value)}
            placeholder="lb"
          />
        </div>
        <div className="field">
          <label htmlFor="start-roll">Roll ID (optional)</label>
          <input
            id="start-roll"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            placeholder="e.g. R-204"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="start-notes">Notes (optional)</label>
        <textarea id="start-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="sticky-action">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>
          <PlayIcon /> Start Roll
        </button>
      </div>

      <div className="secondary-actions">
        <button type="button" className="btn btn-ghost" onClick={onManual}>
          <PlusIcon /> Manual entry
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onDuplicate}
          disabled={!canDuplicate}
        >
          Duplicate last run
        </button>
      </div>
    </section>
  )
}

/* ---------------- Finish Roll ---------------- */
function FinishPanel({ app, activeRun }: { app: UseAppState; activeRun: Run }) {
  const now = useNow(true)
  const [endTime, setEndTime] = useState(nowTimeString())
  const [endTimeEdited, setEndTimeEdited] = useState(false)
  const [peakAmps, setPeakAmps] = useState('')
  const [runningOutAmps, setRunningOutAmps] = useState('')
  const [outputWeight, setOutputWeight] = useState('')
  const [issues, setIssues] = useState<IssueFlag[]>([])
  const [notes, setNotes] = useState(activeRun.notes)
  const [error, setError] = useState<string | null>(null)

  const startMin = parseTimeToMinutes(activeRun.startTime)
  const nowDate = new Date(now)
  let elapsed = startMin === null ? 0 : nowDate.getHours() * 60 + nowDate.getMinutes() - startMin
  if (elapsed < 0) elapsed += 1440
  const elapsedSeconds = elapsed * 60 + nowDate.getSeconds()
  const liveEndTime = endTimeEdited ? endTime : nowTimeString(nowDate)

  function toggleIssue(id: IssueFlag) {
    setIssues((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]))
  }

  function finish() {
    const outW = validateNumberField(outputWeight, { label: 'Output weight', max: MAX_WEIGHT })
    const peak = validateNumberField(peakAmps, { label: 'Peak amps', max: MAX_AMPS })
    const outA = validateNumberField(runningOutAmps, { label: 'Running-out amps', max: MAX_AMPS })
    const invalid = [outW, peak, outA].find((r) => !r.ok)
    if (invalid && !invalid.ok) {
      setError(invalid.error)
      return
    }
    if (!outW.ok || !peak.ok || !outA.ok) return
    setError(null)
    app.actions.finishRoll(activeRun.id, {
      endTime: endTimeEdited ? endTime : nowTimeString(),
      peakAmps: peak.value,
      runningOutAmps: outA.value,
      outputWeight: outW.value,
      issues,
      notes: notes.trim(),
    })
  }

  // Live throughput preview from current input weight + elapsed.
  const previewMetrics = computeRunMetrics(
    { ...activeRun, endTime: liveEndTime },
    app.state.settings,
  )

  return (
    <section className="card finish-panel">
      <div className="finish-panel__banner">
        <span className="status-near">● Running</span>
        <div className="finish-panel__timer" aria-live="polite">
          {fmtElapsedClock(elapsedSeconds)}
        </div>
      </div>
      <h2 className="finish-panel__material">
        {activeRun.materialType}
        {activeRun.rollId ? ` · #${activeRun.rollId}` : ''}
      </h2>
      <p className="finish-panel__meta">
        VFD {FIXED_VFD} · Started {activeRun.startTime} · In {fmtWeight(activeRun.inputWeight)} ·
        Live {fmtRate(previewMetrics.throughput)}
      </p>

      <div className="card-title" style={{ marginTop: 'var(--sp-4)' }}>
        Finish roll
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="finish-end">End time</label>
          <input
            id="finish-end"
            type="time"
            value={liveEndTime}
            onChange={(e) => {
              setEndTime(e.target.value)
              setEndTimeEdited(true)
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="finish-output">Output / regrind (lb)</label>
          <input
            id="finish-output"
            type="number"
            inputMode="decimal"
            min="0"
            value={outputWeight}
            onChange={(e) => setOutputWeight(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="finish-peak">Peak amps</label>
          <input
            id="finish-peak"
            type="number"
            inputMode="decimal"
            min="0"
            value={peakAmps}
            onChange={(e) => setPeakAmps(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div className="field">
          <label htmlFor="finish-outa">Running-out amps</label>
          <input
            id="finish-outa"
            type="number"
            inputMode="decimal"
            min="0"
            value={runningOutAmps}
            onChange={(e) => setRunningOutAmps(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>

      <fieldset className="field issue-fieldset">
        <legend>Issue flags</legend>
        <div className="chip-group">
          {ISSUE_FLAGS.map((flag) => (
            <button
              key={flag.id}
              type="button"
              className={`chip${issues.includes(flag.id) ? ' chip--on' : ''}`}
              aria-pressed={issues.includes(flag.id)}
              onClick={() => toggleIssue(flag.id)}
            >
              {flag.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="finish-notes">Notes</label>
        <textarea id="finish-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="sticky-action">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={finish}>
          <CheckIcon /> Finish Roll
        </button>
      </div>
    </section>
  )
}
