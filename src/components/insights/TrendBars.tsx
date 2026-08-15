import { fmtNum } from '../../lib/format'

interface TrendPoint {
  label: string
  value: number | null
}

interface TrendBarsProps {
  data: TrendPoint[]
  unit: string
  /** Optional trip threshold — bars at/over turn red. */
  threshold?: number
  /** Optional safe ceiling — bars at/over (but under trip) turn amber. */
  safe?: number
}

/**
 * Dependency-free vertical bar trend. Bars scale to the max value in the
 * series; missing values render as a hollow "no data" tick rather than zero.
 */
export function TrendBars({ data, unit, threshold, safe }: TrendBarsProps) {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null)
  if (values.length === 0) {
    return <p className="empty-hint">No data yet for this trend.</p>
  }
  const max = Math.max(...values, threshold ?? 0)

  function statusClass(v: number): string {
    if (threshold !== undefined && v >= threshold) return 'trend-bar__fill--trip'
    if (safe !== undefined && v >= safe) return 'trend-bar__fill--near'
    return 'trend-bar__fill--ok'
  }

  return (
    <div className="trend">
      <div className="trend-bars" role="img" aria-label={`Trend of ${data.length} values in ${unit}`}>
        {data.map((d, i) => (
          <div className="trend-bar" key={i} title={d.value === null ? 'No data' : `${fmtNum(d.value, 0)} ${unit}`}>
            {d.value === null ? (
              <div className="trend-bar__missing" aria-hidden="true" />
            ) : (
              <div
                className={`trend-bar__fill ${statusClass(d.value)}`}
                style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
              />
            )}
            <span className="trend-bar__label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
