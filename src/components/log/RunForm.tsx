import { useState } from 'react'
import type { IssueFlag, MaterialType, Run } from '../../types/domain'
import { FIXED_VFD, ISSUE_FLAGS, MATERIAL_TYPES } from '../../types/domain'
import type { RunDraft } from '../../hooks/useAppState'
import { MAX_AMPS, MAX_WEIGHT, numberToInput, validateNumberField } from '../../lib/forms'
import { nowTimeString } from '../../lib/format'

interface RunFormProps {
  /** Existing run to edit, or null for a fresh manual entry. */
  initial: Run | null
  /** Current signed-in operator, used as the default for a fresh manual entry. */
  defaultOperatorName: string
  onSave: (draft: RunDraft) => void
  onCancel: () => void
}

/** Full completed-run form used for manual entry and for editing any run. */
export function RunForm({ initial, defaultOperatorName, onSave, onCancel }: RunFormProps) {
  const [materialType, setMaterialType] = useState<MaterialType>(
    initial?.materialType ?? 'Micro',
  )
  const [rollId, setRollId] = useState(initial?.rollId ?? '')
  const [startTime, setStartTime] = useState(initial?.startTime ?? nowTimeString())
  const [endTime, setEndTime] = useState(initial?.endTime ?? nowTimeString())
  const [inputWeight, setInputWeight] = useState(numberToInput(initial?.inputWeight ?? null))
  const [outputWeight, setOutputWeight] = useState(numberToInput(initial?.outputWeight ?? null))
  const [peakAmps, setPeakAmps] = useState(numberToInput(initial?.peakAmps ?? null))
  const [runningOutAmps, setRunningOutAmps] = useState(
    numberToInput(initial?.runningOutAmps ?? null),
  )
  const [issues, setIssues] = useState<IssueFlag[]>(initial?.issues ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [operatorName, setOperatorName] = useState(initial?.operatorName ?? defaultOperatorName)
  const [error, setError] = useState<string | null>(null)

  function toggleIssue(id: IssueFlag) {
    setIssues((cur) => (cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const inW = validateNumberField(inputWeight, {
      label: 'Input weight',
      required: true,
      positive: true,
      max: MAX_WEIGHT,
    })
    const outW = validateNumberField(outputWeight, { label: 'Output weight', max: MAX_WEIGHT })
    const peak = validateNumberField(peakAmps, { label: 'Peak amps', max: MAX_AMPS })
    const outA = validateNumberField(runningOutAmps, { label: 'Running-out amps', max: MAX_AMPS })

    const invalid = [inW, outW, peak, outA].find((r) => !r.ok)
    if (invalid && !invalid.ok) {
      setError(invalid.error)
      return
    }
    // All four validated ok above; narrow for TypeScript.
    if (!inW.ok || !outW.ok || !peak.ok || !outA.ok) return
    setError(null)
    onSave({
      id: initial?.id,
      materialType,
      rollId: rollId.trim() || null,
      startTime,
      endTime: endTime || null,
      inputWeight: inW.value,
      outputWeight: outW.value,
      peakAmps: peak.value,
      runningOutAmps: outA.value,
      issues,
      notes: notes.trim(),
      operatorName: operatorName.trim() || null,
    })
  }

  return (
    <form className="run-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="rf-material">Material</label>
        <select
          id="rf-material"
          value={materialType}
          onChange={(e) => setMaterialType(e.target.value as MaterialType)}
        >
          {MATERIAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rf-operator">Operator</label>
        <input
          id="rf-operator"
          value={operatorName}
          onChange={(e) => setOperatorName(e.target.value)}
          placeholder="Who ran this roll"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="rf-roll">Roll / tag ID (optional)</label>
          <input
            id="rf-roll"
            value={rollId}
            onChange={(e) => setRollId(e.target.value)}
            placeholder="e.g. R-204"
          />
        </div>
        <div className="field field--locked">
          <label>VFD (locked)</label>
          <div className="locked-value">{FIXED_VFD}</div>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="rf-start">Start time</label>
          <input id="rf-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rf-end">End time</label>
          <input id="rf-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="rf-in">Input weight (lb)</label>
          <input
            id="rf-in"
            type="number"
            inputMode="decimal"
            min="0"
            value={inputWeight}
            onChange={(e) => setInputWeight(e.target.value)}
            placeholder="lb"
          />
        </div>
        <div className="field">
          <label htmlFor="rf-out">Output / regrind (lb)</label>
          <input
            id="rf-out"
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
          <label htmlFor="rf-peak">Peak amps</label>
          <input
            id="rf-peak"
            type="number"
            inputMode="decimal"
            min="0"
            value={peakAmps}
            onChange={(e) => setPeakAmps(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div className="field">
          <label htmlFor="rf-outa">Running-out amps</label>
          <input
            id="rf-outa"
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
        <label htmlFor="rf-notes">Notes</label>
        <textarea
          id="rf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jams, screen changes, knife condition…"
        />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save changes' : 'Save run'}
        </button>
      </div>
    </form>
  )
}
