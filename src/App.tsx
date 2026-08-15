import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { PulseScreen } from './components/pulse/PulseScreen'
import { LogScreen } from './components/log/LogScreen'
import { InsightsScreen } from './components/insights/InsightsScreen'
import { ReferenceScreen } from './components/reference/ReferenceScreen'
import { OperatorGate } from './components/auth/OperatorGate'
import { useAppState } from './hooks/useAppState'
import { useQuietMode } from './hooks/usePreferences'
import { useRoster } from './hooks/useRoster'
import { PrintSheet } from './components/reference/PrintSheet'

export type ScreenId = 'pulse' | 'log' | 'insights' | 'reference'

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('pulse')
  const app = useAppState()
  const { quiet, setQuiet } = useQuietMode()
  const roster = useRoster()

  if (!roster.currentOperator) {
    return <OperatorGate roster={roster} />
  }

  return (
    <>
      <AppShell
        active={screen}
        onNavigate={setScreen}
        shiftDate={app.state.shiftDate}
        currentOperator={roster.currentOperator}
        onSwitchOperator={roster.signOut}
      >
        {screen === 'pulse' && (
          <PulseScreen app={app} quiet={quiet} onNavigate={setScreen} />
        )}
        {screen === 'log' && (
          <LogScreen app={app} operatorName={roster.currentOperator.name} />
        )}
        {screen === 'insights' && <InsightsScreen app={app} />}
        {screen === 'reference' && (
          <ReferenceScreen app={app} quiet={quiet} onQuietChange={setQuiet} roster={roster} />
        )}
      </AppShell>
      {screen === 'reference' && <PrintSheet state={app.state} />}
    </>
  )
}
