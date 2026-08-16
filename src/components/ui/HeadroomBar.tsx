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
        <div className="headroom__mark headroom__mark--safe" style={{ left: pct(settings.safeAmps) }} />
        <div className="headroom__mark headroom__mark--trip" style={{ left: pct(settings.tripAmps) }} />
      </div>
      {/*
       * The threshold numbers sit in a fixed legend row rather than hanging off
       * the marks themselves. When they were absolutely positioned under each
       * mark they collided: safe and trip are close together in amp terms (130
       * and 140 by default) but each label is far wider than the gap between
       * them on a phone-width track, so the two rendered on top of each other
       * as unreadable overlapping text. A legend can't overlap at any threshold
       * values, and it also can't overflow the end of the track the way a
       * centered label on a mark near 100% did.
       */}
      <div className="headroom__legend">
        <span className="headroom__key headroom__key--safe">safe {settings.safeAmps}</span>
        <span className="headroom__key headroom__key--trip">trip {settings.tripAmps}</span>
      </div>
    </div>
  )
}
