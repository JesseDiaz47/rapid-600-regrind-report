import type { AppState, Run } from '../../types/domain'
import { FIXED_VFD, ISSUE_FLAGS, MATERIAL_CODE } from '../../types/domain'
import {
  computeRunMetrics,
  isCompleted,
  materialSummaries,
  shiftTotals,
} from '../../lib/calculations'
import { DASH, fmtNum } from '../../lib/format'

function valueWithUnit(value: number | null, unit: string, digits = 0): string {
  return value === null ? DASH : `${fmtNum(value, digits)} ${unit}`
}

function issuesFor(run: Run): string {
  if (run.issues.length === 0) return DASH
  return run.issues
    .map((id) => ISSUE_FLAGS.find((flag) => flag.id === id)?.label ?? id)
    .join(', ')
}

/**
 * Print-only shift report. The browser's print/share sheet turns this into a
 * multi-page landscape PDF containing Pulse, Insights, and the complete run log.
 * Missing optional measurements remain visibly missing rather than becoming 0.
 */
export function PrintSheet({ state }: { state: AppState }) {
  const runs = [...state.runs].filter(isCompleted).sort((a, b) => a.createdAt - b.createdAt)
  const totals = shiftTotals(runs, state.settings)
  const summaries = materialSummaries(runs, state.settings)
  const latest = runs.at(-1) ?? null
  const latestMetrics = latest ? computeRunMetrics(latest, state.settings) : null

  const recordedOutputs = runs.filter((run) => run.outputWeight !== null)
  const peakValues = runs.flatMap((run) => (run.peakAmps === null ? [] : [run.peakAmps]))
  const maxPeak = peakValues.length > 0 ? Math.max(...peakValues) : null
  const minTripHeadroom =
    peakValues.length > 0 ? Math.min(...peakValues.map((peak) => state.settings.tripAmps - peak)) : null
  const topMaterial = summaries
    .filter((summary) => summary.avgThroughput !== null)
    .sort((a, b) => (b.avgThroughput ?? 0) - (a.avgThroughput ?? 0))[0]
  const missingOutput = runs.filter((run) => run.outputWeight === null).length
  const missingPeak = runs.filter((run) => run.peakAmps === null).length
  const operators = Array.from(new Set(runs.flatMap((run) => (run.operatorName ? [run.operatorName] : []))))

  return (
    <div className="print-sheet" aria-hidden="true">
      <div className="print-conf">
        Operational record · logging &amp; reference only · not machine control
      </div>

      <header className="print-head">
        <div className="print-brand">
          <img src="./agru-logo.svg" alt="AGRU" />
          <div>
            <p className="print-kicker">Fernley regrind operations</p>
            <h1>Rapid 600 Regrind Report</h1>
            <p>
              Fixed VFD {FIXED_VFD} · Screen {state.settings.screenSize || DASH}
            </p>
          </div>
        </div>
        <div className="print-head__meta">
          <p className="print-date">Shift {state.shiftDate}</p>
          <p>Operators: {operators.length > 0 ? operators.join(', ') : DASH}</p>
          <p>
            Safe {state.settings.safeAmps} A · Trip {state.settings.tripAmps} A
          </p>
        </div>
      </header>

      <main className="print-overview">
        <section className="print-section">
          <h2>Shift pulse</h2>
          <div className="print-kpis">
            <PrintKpi label="Input weight" value={`${fmtNum(totals.totalInputWeight)} lb`} />
            <PrintKpi
              label="Recorded output"
              value={
                recordedOutputs.length === 0 ? DASH : `${fmtNum(totals.totalOutputWeight)} lb`
              }
            />
            <PrintKpi label="Average rate" value={valueWithUnit(totals.avgThroughput, 'lb/hr')} />
            <PrintKpi
              label="Average roll time"
              value={valueWithUnit(totals.avgDurationMinutes, 'min')}
            />
            <PrintKpi label="Rolls completed" value={`${totals.rollCount} rolls`} />
            <PrintKpi label="Highest peak" value={valueWithUnit(maxPeak, 'A')} />
          </div>

          <div className="print-latest">
            <div>
              <span className="print-label">Latest completed run</span>
              {latest && latestMetrics ? (
                <strong>
                  {latest.materialType} · {latest.startTime}–{latest.endTime ?? DASH} ·{' '}
                  {valueWithUnit(latestMetrics.throughput, 'lb/hr')}
                </strong>
              ) : (
                <strong>No completed runs recorded for this shift.</strong>
              )}
            </div>
            <div>
              <span className="print-label">Closest observed trip headroom</span>
              <strong>{valueWithUnit(minTripHeadroom, 'A')}</strong>
            </div>
          </div>
        </section>

        <section className="print-section">
          <h2>Material insights</h2>
          {summaries.length > 0 ? (
            <table className="print-insight-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Runs</th>
                  <th>Total input</th>
                  <th>Avg lb/hr</th>
                  <th>Avg roll</th>
                  <th>Avg peak A</th>
                  <th>Avg yield</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => (
                  <tr key={summary.type}>
                    <td>{summary.type}</td>
                    <td>{summary.count}</td>
                    <td>{valueWithUnit(summary.totalInputWeight, 'lb')}</td>
                    <td>{valueWithUnit(summary.avgThroughput, 'lb/hr')}</td>
                    <td>{valueWithUnit(summary.avgDurationMinutes, 'min')}</td>
                    <td>{valueWithUnit(summary.avgPeakAmps, 'A', 1)}</td>
                    <td>
                      {summary.avgYieldPercent === null
                        ? DASH
                        : `${fmtNum(summary.avgYieldPercent, 1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="print-empty">No completed runs recorded for this shift.</p>
          )}

          <div className="print-observations">
            <h3>Observed highlights</h3>
            <ul>
              <li>
                Highest observed material average:{' '}
                <b>
                  {topMaterial
                    ? `${topMaterial.type} · ${valueWithUnit(topMaterial.avgThroughput, 'lb/hr')}`
                    : DASH}
                </b>
              </li>
              <li>
                Highest recorded peak current: <b>{valueWithUnit(maxPeak, 'A')}</b>
              </li>
              <li>
                Data completeness: <b>{missingOutput}</b> run(s) missing output weight;{' '}
                <b>{missingPeak}</b> run(s) missing peak amps. Missing measurements remain unrecorded.
              </li>
            </ul>
          </div>
        </section>

        {state.shiftNotes && (
          <section className="print-notes">
            <h2>Shift notes</h2>
            <p>{state.shiftNotes}</p>
          </section>
        )}
      </main>

      <section className="print-log-page">
        <h2>Complete run log</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Operator</th>
              <th>Material</th>
              <th>Code</th>
              <th>Roll</th>
              <th>VFD</th>
              <th>Start</th>
              <th>End</th>
              <th>Min</th>
              <th>In lb</th>
              <th>Out lb</th>
              <th>Yield</th>
              <th>lb/hr</th>
              <th>Peak A</th>
              <th>Running-out A</th>
              <th>A/1k</th>
              <th>Head A</th>
              <th>Issues</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={19}>No completed runs recorded for this shift.</td>
              </tr>
            ) : (
              runs.map((run, i) => {
                const metrics = computeRunMetrics(run, state.settings)
                return (
                  <tr key={run.id}>
                    <td>{i + 1}</td>
                    <td>{run.operatorName ?? DASH}</td>
                    <td>{run.materialType}</td>
                    <td>{MATERIAL_CODE[run.materialType]}</td>
                    <td>{run.rollId ?? DASH}</td>
                    <td>{FIXED_VFD}</td>
                    <td>{run.startTime}</td>
                    <td>{run.endTime ?? DASH}</td>
                    <td>{fmtNum(metrics.durationMinutes)}</td>
                    <td>{fmtNum(run.inputWeight)}</td>
                    <td>{fmtNum(run.outputWeight)}</td>
                    <td>
                      {metrics.yieldPercent === null
                        ? DASH
                        : `${fmtNum(metrics.yieldPercent, 1)}%`}
                    </td>
                    <td>{fmtNum(metrics.throughput)}</td>
                    <td>{fmtNum(run.peakAmps)}</td>
                    <td>{fmtNum(run.runningOutAmps)}</td>
                    <td>{fmtNum(metrics.ampsPer1kRate, 1)}</td>
                    <td>{fmtNum(metrics.headroomToTrip)}</td>
                    <td>{issuesFor(run)}</td>
                    <td>{run.notes || DASH}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <p className="print-footnote">
          All displayed metrics are recalculated from recorded raw values. “{DASH}” means the value
          was not recorded or could not be calculated from the available measurements.
        </p>
      </section>
    </div>
  )
}

function PrintKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
