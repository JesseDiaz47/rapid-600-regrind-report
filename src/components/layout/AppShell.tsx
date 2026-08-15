import type { ScreenId } from '../../App'
import type { Employee } from '../../types/domain'
import { PrimaryNav } from './PrimaryNav'
import { GeometryField } from '../ui/GeometryMark'

interface AppShellProps {
  active: ScreenId
  onNavigate: (id: ScreenId) => void
  shiftDate: string
  currentOperator: Employee
  onSwitchOperator: () => void
  children: React.ReactNode
}

const TITLES: Record<ScreenId, string> = {
  pulse: 'Pulse',
  log: 'Log',
  insights: 'Insights',
  reference: 'Reference',
}

export function AppShell({
  active,
  onNavigate,
  shiftDate,
  currentOperator,
  onSwitchOperator,
  children,
}: AppShellProps) {
  return (
    <>
      <GeometryField />
      <div className="app">
        <PrimaryNav active={active} onNavigate={onNavigate} />
        <div className="app-shell-body">
          <header className="app-header">
            <div className="app-header__title">
              <h1>{TITLES[active]}</h1>
              <span className="app-header__meta">Shift {shiftDate} · Fixed VFD 20</span>
            </div>
            <div className="app-header__badges">
              <button type="button" className="operator-badge" onClick={onSwitchOperator}>
                {currentOperator.name}
              </button>
              <span className="local-badge">Local only</span>
            </div>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </div>
    </>
  )
}
