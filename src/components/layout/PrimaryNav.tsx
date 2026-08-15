import type { ScreenId } from '../../App'
import { PulseIcon, LogIcon, InsightsIcon, ReferenceIcon } from '../ui/icons'

const ITEMS: { id: ScreenId; label: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { id: 'pulse', label: 'Pulse', Icon: PulseIcon },
  { id: 'log', label: 'Log', Icon: LogIcon },
  { id: 'insights', label: 'Insights', Icon: InsightsIcon },
  { id: 'reference', label: 'Reference', Icon: ReferenceIcon },
]

interface PrimaryNavProps {
  active: ScreenId
  onNavigate: (id: ScreenId) => void
}

export function PrimaryNav({ active, onNavigate }: PrimaryNavProps) {
  return (
    <nav className="primary-nav" aria-label="Primary">
      <div className="app-brand-rail" aria-hidden="true">
        <div>
          <b>Rapid 600</b>
          <br />
          <span>Regrind Report</span>
        </div>
      </div>
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="nav-item"
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon />
          <span>{label}</span>
          <span className="nav-dot" aria-hidden="true" />
        </button>
      ))}
    </nav>
  )
}
