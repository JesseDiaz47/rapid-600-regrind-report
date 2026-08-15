import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrintSheet } from './PrintSheet'
import { defaultState } from '../../lib/defaults'
import type { AppState, Run } from '../../types/domain'

function run(overrides: Partial<Run>): Run {
  return {
    id: 'run-1',
    materialType: 'Micro',
    rollId: 'M-1',
    startTime: '06:00',
    endTime: '06:30',
    inputWeight: 600,
    outputWeight: 590,
    peakAmps: 135,
    runningOutAmps: 108,
    issues: ['knife'],
    notes: 'Grinder loose ends',
    active: false,
    createdAt: 1,
    updatedAt: 1,
    operatorName: null,
    ...overrides,
  }
}

function reportState(): AppState {
  return {
    ...defaultState(),
    shiftDate: '2026-07-19',
    shiftNotes: 'Shift completed without a thermal trip.',
    runs: [
      run({ id: 'micro-1', operatorName: 'Alex Rivera' }),
      run({
        id: 'smooth-1',
        materialType: 'Smooth',
        rollId: 'S-1',
        startTime: '07:00',
        endTime: '07:20',
        inputWeight: 500,
        outputWeight: null,
        peakAmps: 128,
        runningOutAmps: null,
        issues: [],
        notes: '',
        createdAt: 2,
        operatorName: 'Sam Lee',
      }),
    ],
  }
}

describe('PrintSheet PDF report', () => {
  it('combines Pulse totals, Insights summaries, and the complete run log', () => {
    const { container } = render(<PrintSheet state={reportState()} />)
    const report = container.querySelector('.print-sheet') as HTMLElement
    const reportText = report.textContent ?? ''
    const insightText = container.querySelector('.print-insight-table')?.textContent ?? ''
    const logText = container.querySelector('.print-table')?.textContent ?? ''

    expect(report.querySelector('h1')).toHaveTextContent('Rapid 600 Regrind Report')
    expect(report.querySelector('img[alt="AGRU"]')).not.toBeNull()
    expect(reportText).toContain('Operators: Alex Rivera, Sam Lee')
    expect(logText).toContain('Alex Rivera')
    expect(logText).toContain('Sam Lee')
    expect(reportText).toContain('Shift pulse')
    expect(reportText).toContain('1,100 lb')
    expect(reportText).toContain('2 rolls')
    expect(reportText).toContain('Material insights')
    expect(insightText).toContain('Micro')
    expect(insightText).toContain('Smooth')
    expect(reportText).toContain('Complete run log')
    expect(logText).toContain('Running-out A')
    expect(logText).toContain('Knife')
    expect(logText).toContain('Grinder loose ends')
    expect(logText).toContain('—')
    expect(reportText).toContain('Shift completed without a thermal trip.')
  })

  it('keeps an empty shift honest instead of inventing metrics', () => {
    const { container } = render(
      <PrintSheet state={{ ...defaultState(), shiftDate: '2026-07-19' }} />,
    )
    const reportText = container.querySelector('.print-sheet')?.textContent ?? ''

    expect(reportText).toContain('0 rolls')
    expect(reportText).toContain('No completed runs recorded for this shift.')
    expect(reportText).toContain('—')
  })
})
