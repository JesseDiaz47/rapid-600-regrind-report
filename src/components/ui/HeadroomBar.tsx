import type { HeadroomStatus, MachineSettings } from '../../types/domain'
import { fmtAmps } from '../../lib/format'

const STATUS_LABEL: Record<HeadroomStatus, string> = {
  safe: 'Safe',
  near: 'Near ceiling',
  trip: 'At / over trip',
  unknown: 'No amp data',
}

interface HeadroomBarProps {
  peakAmps: number | null
  status: HeadroomStatus
  settings: MachineSettings
}

/**
 * Amp headroom relative to the safe ceiling and trip threshold. Status is
 * conveyed by an explicit text label as well as color, so it never depends on
 * color perception alone.
 */
export function HeadroomBar({ peakAmps, status, settings }: HeadroomBarProps) {
  const max = Math.max(settings.tripAmps * 1.05, peakAmps ?? 0)
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  const fill = peakAmps === null ? 0 : Math.min(100, (peakAmps / max) * 100)

  return (
    <div className="headroom">
      <div className="headroom__head">
        <span className={`headroom__status status-${status}`}>
          <span className="headroom__dot" aria-hidden="true" /> {STATUS_LABEL[status]}
        </span>
        <span className="headroom__peak">Peak {fmtAmps(peakAmps)}</span>
      </div>
      <div className="headroom__track" role="img" aria-label={`Peak amps ${fmtAmps(peakAmps)}, ${STATUS_LABEL[status]}`}>
        <div className={`headroom__fill status-fill-${status}`} style={{ width: `${fill}%` }} />
        <div className="headroom__mark headroom__mark--safe" style={{ left: pct(settings.safeAmps) }}>
          <span>safe {settings.safeAmps}</span>
        </div>
        <div className="headroom__mark headroom__mark--trip" style={{ left: pct(settings.tripAmps) }}>
          <span>trip {settings.tripAmps}</span>
        </div>
      </div>
    </div>
  )
}
