import { useMemo, useState } from 'react'
import type { UseAppState } from '../../hooks/useAppState'
import type { MaterialSummary, MaterialType } from '../../types/domain'
import { computeRunMetrics, isCompleted, materialSummaries } from '../../lib/calculations'
import { DASH, fmtDuration, fmtNum, fmtPercent, fmtRate, fmtWeight } from '../../lib/format'
import { TrendBars } from './TrendBars'

interface InsightsScreenProps {
  app: UseAppState
}

export function InsightsScreen({ app }: InsightsScreenProps) {
  const { state } = app
  const summaries = useMemo(
    () => materialSummaries(state.runs, state.settings),
    [state.runs, state.settings],
  )

  const maxRate = Math.max(1, ...summaries.map((s) => s.avgThroughput ?? 0))

  const completedOrdered = useMemo(
    () =>
      state.runs
        .filter(isCompleted)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({
          label: r.materialType.slice(0, 2),
          value: computeRunMetrics(r, state.settings).throughput,
        })),
    [state.runs, state.settings],
  )

  const ampSeries = useMemo(
    () =>
      state.runs
        .filter(isCompleted)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((r) => ({ label: r.materialType.slice(0, 2), value: r.peakAmps })),
    [state.runs],
  )

  if (summaries.length === 0) {
    return (
      <div className="screen">
        <p className="screen-intro">
          Insights compare materials once you have completed runs. Everything here is measured at
          the fixed VFD of 20.
        </p>
        <p className="empty-hint card">
          No completed runs yet. Log a few rolls and this screen will show per-material throughput,
          roll time, and amp trends.
        </p>
      </div>
    )
  }

  return (
    <div className="screen screen-insights">
      <p className="screen-intro">
        Per-material performance at a fixed VFD of 20 — no VFD comparisons, just what each material
        actually did this shift.
      </p>

      <section className="card">
        <div className="card-title">Average throughput by material</div>
        <div className="bar-chart">
          {summaries.map((s) => (
            <div key={s.type} className="bar-row">
              <span className="bar-row__label">{s.type}</span>
              <div className="bar-row__track">
                <div
                  className="bar-row__fill"
                  style={{ width: `${((s.avgThroughput ?? 0) / maxRate) * 100}%` }}
                />
              </div>
              <span className="bar-row__value">{fmtRate(s.avgThroughput)}</span>
            </div>
          ))}
        </div>
      </section>

      <h2 className="section-heading">Material breakdown</h2>
      <div className="summary-grid">
        {summaries.map((s) => (
          <MaterialSummaryCard key={s.type} summary={s} />
        ))}
      </div>

      <ComparePanel summaries={summaries} />

      <section className="card">
        <div className="card-title">lb/hr over the shift</div>
        <TrendBars data={completedOrdered} unit="lb/hr" />
      </section>

      <section className="card">
        <div className="card-title">Peak amps over the shift</div>
        <TrendBars
          data={ampSeries}
          unit="A"
          threshold={state.settings.tripAmps}
          safe={state.settings.safeAmps}
        />
      </section>
    </div>
  )
}

function MaterialSummaryCard({ summary }: { summary: MaterialSummary }) {
  return (
    <div className="card summary-card">
      <div className="summary-card__head">
        <strong>{summary.type}</strong>
        <span className="summary-card__count">
          {summary.count} run{summary.count === 1 ? '' : 's'}
        </span>
      </div>
      <dl className="summary-card__stats">
        <div>
          <dt>Total weight</dt>
          <dd>{fmtWeight(summary.totalInputWeight)}</dd>
        </div>
        <div>
          <dt>Avg lb/hr</dt>
          <dd>{fmtRate(summary.avgThroughput)}</dd>
        </div>
        <div>
          <dt>Avg roll time</dt>
          <dd>{fmtDuration(summary.avgDurationMinutes)}</dd>
        </div>
        <div>
          <dt>Avg peak A</dt>
          <dd>{summary.avgPeakAmps === null ? DASH : fmtNum(summary.avgPeakAmps, 1)}</dd>
        </div>
        <div>
          <dt>Avg yield</dt>
          <dd>{fmtPercent(summary.avgYieldPercent)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ComparePanel({ summaries }: { summaries: MaterialSummary[] }) {
  const types = summaries.map((s) => s.type)
  const [a, setA] = useState<MaterialType>(types[0])
  const [b, setB] = useState<MaterialType>(types[1] ?? types[0])
  const left = summaries.find((s) => s.type === a)
  const right = summaries.find((s) => s.type === b)

  return (
    <section className="card compare-panel">
      <div className="card-title">Compare materials</div>
      <div className="compare-selectors">
        <select value={a} onChange={(e) => setA(e.target.value as MaterialType)} aria-label="First material">
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="compare-vs">vs</span>
        <select value={b} onChange={(e) => setB(e.target.value as MaterialType)} aria-label="Second material">
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {left && right && (
        <table className="compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{left.type}</th>
              <th>{right.type}</th>
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Runs" l={String(left.count)} r={String(right.count)} />
            <CompareRow label="Total weight" l={fmtWeight(left.totalInputWeight)} r={fmtWeight(right.totalInputWeight)} />
            <CompareRow label="Avg lb/hr" l={fmtRate(left.avgThroughput)} r={fmtRate(right.avgThroughput)} />
            <CompareRow label="Avg roll time" l={fmtDuration(left.avgDurationMinutes)} r={fmtDuration(right.avgDurationMinutes)} />
            <CompareRow
              label="Avg peak A"
              l={left.avgPeakAmps === null ? DASH : fmtNum(left.avgPeakAmps, 1)}
              r={right.avgPeakAmps === null ? DASH : fmtNum(right.avgPeakAmps, 1)}
            />
            <CompareRow label="Avg yield" l={fmtPercent(left.avgYieldPercent)} r={fmtPercent(right.avgYieldPercent)} />
          </tbody>
        </table>
      )}
    </section>
  )
}

function CompareRow({ label, l, r }: { label: string; l: string; r: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{l}</td>
      <td>{r}</td>
    </tr>
  )
}
