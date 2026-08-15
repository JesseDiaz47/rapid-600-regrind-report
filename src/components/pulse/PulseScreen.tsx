import type { ScreenId } from '../../App'
import type { UseAppState } from '../../hooks/useAppState'
import { useNow } from '../../hooks/useNow'
import { computeRunMetrics, shiftTotals } from '../../lib/calculations'
import { GeometryMark } from '../ui/GeometryMark'
import { MetricTile } from '../ui/MetricTile'
import { HeadroomBar } from '../ui/HeadroomBar'
import {
  DASH,
  fmtDuration,
  fmtElapsedClock,
  fmtRate,
  fmtWeight,
  nowTimeString,
} from '../../lib/format'
import { parseTimeToMinutes } from '../../lib/calculations'
import { collectDataPrompts } from '../../lib/prompts'

interface PulseScreenProps {
  app: UseAppState
  quiet: boolean
  onNavigate: (id: ScreenId) => void
}

export function PulseScreen({ app, quiet, onNavigate }: PulseScreenProps) {
  const { state, activeRun } = app
  const now = useNow(activeRun !== null)
  const totals = shiftTotals(state.runs, state.settings)
  const prompts = collectDataPrompts(state.runs, state.settings)

  const completed = state.runs.filter((r) => !r.active)
  const latest = completed[completed.length - 1] ?? null
  const latestMetrics = latest ? computeRunMetrics(latest, state.settings) : null

  // Elapsed time for the active run, from its start clock to now.
  let elapsedSeconds = 0
  if (activeRun) {
    const startMin = parseTimeToMinutes(activeRun.startTime)
    const nowDate = new Date(now)
    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes()
    let diff = startMin === null ? 0 : nowMin - startMin
    if (diff < 0) diff += 1440
    elapsedSeconds = diff * 60 + nowDate.getSeconds()
  }

  return (
    <div className="screen screen-pulse">
      {/* Hero: current material inside sacred geometry */}
      <section className="pulse-hero card">
        <GeometryMark breathe={!quiet} size={130}>
          <div className="pulse-hero__center">
            <span className="pulse-hero__vfd">VFD 20</span>
          </div>
        </GeometryMark>
        <div className="pulse-hero__body">
          {activeRun ? (
            <>
              <span className="pulse-hero__eyebrow status-near">● Running</span>
              <h2 className="pulse-hero__material">{activeRun.materialType}</h2>
              <div className="pulse-hero__timer" aria-live="polite">
                {fmtElapsedClock(elapsedSeconds)}
              </div>
              <p className="pulse-hero__meta">
                Started {activeRun.startTime} · In {fmtWeight(activeRun.inputWeight)}
              </p>
            </>
          ) : (
            <>
              <span className="pulse-hero__eyebrow">Idle</span>
              <h2 className="pulse-hero__material">No active roll</h2>
              <p className="pulse-hero__meta">
                All runs are performed at a locked VFD of 20.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Shift totals */}
      <div className="metric-grid">
        <MetricTile label="Shift weight" value={fmtWeight(totals.totalInputWeight)} accent />
        <MetricTile label="Avg lb/hr" value={fmtRate(totals.avgThroughput)} />
        <MetricTile label="Avg roll time" value={fmtDuration(totals.avgDurationMinutes)} />
        <MetricTile label="Rolls done" value={String(totals.rollCount)} />
      </div>

      {/* Latest run */}
      <section className="card">
        <div className="card-title">Latest run</div>
        {latest && latestMetrics ? (
          <div className="pulse-latest">
            <div className="pulse-latest__head">
              <strong>{latest.materialType}</strong>
              <span className="pulse-latest__time">
                {latest.startTime}–{latest.endTime ?? DASH}
              </span>
            </div>
            <div className="pulse-latest__stats">
              <span>{fmtRate(latestMetrics.throughput)}</span>
              <span>{fmtDuration(latestMetrics.durationMinutes)}</span>
              <span>{fmtWeight(latest.inputWeight)}</span>
            </div>
            <HeadroomBar
              peakAmps={latest.peakAmps}
              status={latestMetrics.headroomStatus}
              settings={state.settings}
            />
          </div>
        ) : (
          <p className="empty-hint">
            No runs yet this shift. Start a roll to see live throughput and safety headroom here.
          </p>
        )}
      </section>

      {/* Next best action / missing data */}
      <section className="card">
        <div className="card-title">Next best action</div>
        {activeRun ? (
          <p className="next-action next-action--go">
            Finish the active <b>{activeRun.materialType}</b> roll when it clears.
          </p>
        ) : (
          <p className="next-action">Start the next roll when the machine is ready.</p>
        )}
        {prompts.length > 0 && (
          <ul className="prompt-list">
            {prompts.map((p) => (
              <li key={p.id} className="prompt-list__item">
                <button
                  type="button"
                  className="prompt-link"
                  onClick={() => onNavigate('log')}
                >
                  {p.message}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky-action">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => onNavigate('log')}
        >
          {activeRun ? 'Finish active roll' : 'Log a roll'}
        </button>
      </div>

      <p className="disclaimer">
        Logging &amp; reference only — this app never starts, stops, or configures the granulator.
        Data lives on this device. Time now {nowTimeString(new Date(now))}.
      </p>
    </div>
  )
}
