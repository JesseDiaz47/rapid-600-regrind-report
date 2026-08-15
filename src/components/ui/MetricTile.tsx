interface MetricTileProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

export function MetricTile({ label, value, sub, accent }: MetricTileProps) {
  return (
    <div className={`metric-tile${accent ? ' metric-tile--accent' : ''}`}>
      <span className="metric-tile__label">{label}</span>
      <strong className="metric-tile__value">{value}</strong>
      {sub && <span className="metric-tile__sub">{sub}</span>}
    </div>
  )
}
