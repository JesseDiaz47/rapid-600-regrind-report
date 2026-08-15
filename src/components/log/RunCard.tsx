import { useState } from 'react'
import type { MachineSettings, Run } from '../../types/domain'
import { ISSUE_FLAGS } from '../../types/domain'
import { computeRunMetrics } from '../../lib/calculations'
import {
  DASH,
  fmtAmps,
  fmtDuration,
  fmtPercent,
  fmtRate,
  fmtWeight,
} from '../../lib/format'

interface RunCardProps {
  run: Run
  settings: MachineSettings
  onEdit: (run: Run) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export function RunCard({ run, settings, onEdit, onDuplicate, onDelete }: RunCardProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const m = computeRunMetrics(run, settings)
  const issueLabels = run.issues
    .map((id) => ISSUE_FLAGS.find((f) => f.id === id)?.label ?? id)
    .join(', ')

  return (
    <div className={`run-card${run.demo ? ' run-card--demo' : ''}`}>
      <button
        type="button"
        className="run-card__summary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="run-card__id">
          <strong>{run.materialType}</strong>
          {run.rollId && <span className="run-card__tag">#{run.rollId}</span>}
          {run.demo && <span className="run-card__demo-badge">DEMO</span>}
          <span className="run-card__time">
            {run.startTime}–{run.endTime ?? DASH}
          </span>
        </div>
        <div className="run-card__key">
          <span className={`status-${m.headroomStatus}`}>{fmtRate(m.throughput)}</span>
          <span className="run-card__chev" aria-hidden="true">
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {open && (
        <div className="run-card__body">
          <dl className="run-card__grid">
            <div>
              <dt>Duration</dt>
              <dd>{fmtDuration(m.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Input</dt>
              <dd>{fmtWeight(run.inputWeight)}</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>{fmtWeight(run.outputWeight)}</dd>
            </div>
            <div>
              <dt>Yield</dt>
              <dd>{fmtPercent(m.yieldPercent)}</dd>
            </div>
            <div>
              <dt>Peak amps</dt>
              <dd className={`status-${m.headroomStatus}`}>{fmtAmps(run.peakAmps)}</dd>
            </div>
            <div>
              <dt>A / 1k lb/hr</dt>
              <dd>{m.ampsPer1kRate === null ? DASH : m.ampsPer1kRate.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Headroom to trip</dt>
              <dd className={`status-${m.headroomStatus}`}>{fmtAmps(m.headroomToTrip)}</dd>
            </div>
            <div>
              <dt>Running-out A</dt>
              <dd>{fmtAmps(run.runningOutAmps)}</dd>
            </div>
          </dl>

          {issueLabels && (
            <p className="run-card__issues">
              <span className="status-near">⚠</span> {issueLabels}
            </p>
          )}
          {run.notes && <p className="run-card__notes">{run.notes}</p>}

          <div className="run-card__actions">
            <button type="button" className="btn btn-ghost" onClick={() => onEdit(run)}>
              Edit
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onDuplicate(run.id)}>
              Duplicate
            </button>
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => onDelete(run.id)}
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
