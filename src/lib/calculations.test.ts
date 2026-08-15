import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  durationMinutes,
  throughput,
  yieldPercent,
  ampsPer1kRate,
  headroom,
  computeRunMetrics,
  shiftTotals,
  materialSummaries,
} from './calculations'
import type { MachineSettings, Run } from '../types/domain'

const settings: MachineSettings = { safeAmps: 130, tripAmps: 140, screenSize: '3/8"' }

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    materialType: 'Micro',
    rollId: null,
    startTime: '10:00',
    endTime: '11:00',
    inputWeight: 500,
    outputWeight: null,
    peakAmps: null,
    runningOutAmps: null,
    issues: [],
    notes: '',
    active: false,
    createdAt: 0,
    updatedAt: 0,
    operatorName: null,
    ...overrides,
  }
}

describe('parseTimeToMinutes', () => {
  it('parses HH:MM into minutes since midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('10:30')).toBe(630)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })

  it('returns null for empty or malformed input', () => {
    expect(parseTimeToMinutes('')).toBeNull()
    expect(parseTimeToMinutes(null)).toBeNull()
    expect(parseTimeToMinutes('25:00')).toBeNull()
    expect(parseTimeToMinutes('10:99')).toBeNull()
    expect(parseTimeToMinutes('nonsense')).toBeNull()
  })
})

describe('durationMinutes', () => {
  it('computes a same-day duration', () => {
    expect(durationMinutes('16:37', '16:54')).toBe(17)
    expect(durationMinutes('10:00', '11:30')).toBe(90)
  })

  it('handles a midnight crossover by adding a full day', () => {
    expect(durationMinutes('23:50', '00:10')).toBe(20)
    expect(durationMinutes('22:00', '01:00')).toBe(180)
  })

  it('returns null when either endpoint is missing', () => {
    expect(durationMinutes('10:00', null)).toBeNull()
    expect(durationMinutes(null, '10:00')).toBeNull()
    expect(durationMinutes('', '')).toBeNull()
  })
})

describe('throughput (lb/hr)', () => {
  it('computes pounds per hour', () => {
    expect(throughput(500, 60)).toBe(500)
    expect(throughput(447, 17)).toBeCloseTo(1577.6, 1)
  })

  it('returns null for missing or non-positive values', () => {
    expect(throughput(null, 60)).toBeNull()
    expect(throughput(500, null)).toBeNull()
    expect(throughput(500, 0)).toBeNull()
    expect(throughput(0, 60)).toBeNull()
  })
})

describe('yieldPercent', () => {
  it('computes output as a percentage of input', () => {
    expect(yieldPercent(500, 450)).toBe(90)
    expect(yieldPercent(447, 111)).toBeCloseTo(24.83, 1)
  })

  it('returns null when output is missing — never invents a full-yield value', () => {
    expect(yieldPercent(500, null)).toBeNull()
    expect(yieldPercent(null, 450)).toBeNull()
    expect(yieldPercent(0, 450)).toBeNull()
  })
})

describe('ampsPer1kRate', () => {
  it('computes amps drawn per 1,000 lb/hr of throughput', () => {
    expect(ampsPer1kRate(130, 1000)).toBe(130)
    expect(ampsPer1kRate(134, 1507)).toBeCloseTo(88.9, 1)
  })

  it('returns null when amps or rate are missing', () => {
    expect(ampsPer1kRate(null, 1000)).toBeNull()
    expect(ampsPer1kRate(130, null)).toBeNull()
    expect(ampsPer1kRate(130, 0)).toBeNull()
  })
})

describe('headroom', () => {
  it('reports safe status well below the ceiling', () => {
    const h = headroom(120, settings)
    expect(h.toSafe).toBe(10)
    expect(h.toTrip).toBe(20)
    expect(h.status).toBe('safe')
  })

  it('reports near status at/above the safe ceiling but below trip', () => {
    expect(headroom(130, settings).status).toBe('near')
    expect(headroom(135, settings).status).toBe('near')
  })

  it('reports trip status at/above the trip threshold', () => {
    expect(headroom(140, settings).status).toBe('trip')
    expect(headroom(145, settings).status).toBe('trip')
  })

  it('reports unknown status and null headroom when amps are missing', () => {
    const h = headroom(null, settings)
    expect(h.status).toBe('unknown')
    expect(h.toSafe).toBeNull()
    expect(h.toTrip).toBeNull()
  })
})

describe('computeRunMetrics', () => {
  it('recomputes all metrics from raw values', () => {
    const m = computeRunMetrics(
      makeRun({ inputWeight: 500, outputWeight: 450, peakAmps: 120, startTime: '10:00', endTime: '11:00' }),
      settings,
    )
    expect(m.durationMinutes).toBe(60)
    expect(m.throughput).toBe(500)
    expect(m.yieldPercent).toBe(90)
    expect(m.ampsPer1kRate).toBe(240)
    expect(m.headroomStatus).toBe('safe')
    expect(m.headroomToTrip).toBe(20)
  })

  it('keeps optional metrics null when their inputs are absent', () => {
    const m = computeRunMetrics(
      makeRun({ inputWeight: 500, outputWeight: null, peakAmps: null, endTime: null }),
      settings,
    )
    expect(m.durationMinutes).toBeNull()
    expect(m.throughput).toBeNull()
    expect(m.yieldPercent).toBeNull()
    expect(m.ampsPer1kRate).toBeNull()
    expect(m.headroomStatus).toBe('unknown')
  })
})

describe('shiftTotals', () => {
  it('sums weights and averages throughput/duration over completed runs', () => {
    const runs = [
      makeRun({ id: 'a', inputWeight: 500, outputWeight: 400, startTime: '10:00', endTime: '11:00' }),
      makeRun({ id: 'b', inputWeight: 300, outputWeight: null, startTime: '11:00', endTime: '11:30' }),
    ]
    const t = shiftTotals(runs, settings)
    expect(t.rollCount).toBe(2)
    expect(t.totalInputWeight).toBe(800)
    expect(t.totalOutputWeight).toBe(400)
    expect(t.totalMinutes).toBe(90)
    // rates: 500 lb/hr and 600 lb/hr -> avg 550
    expect(t.avgThroughput).toBe(550)
    expect(t.avgDurationMinutes).toBe(45)
  })

  it('ignores active runs and missing values without inventing data', () => {
    const runs = [
      makeRun({ id: 'a', inputWeight: 500, startTime: '10:00', endTime: '11:00' }),
      makeRun({ id: 'b', inputWeight: 480, active: true, endTime: null }),
    ]
    const t = shiftTotals(runs, settings)
    expect(t.rollCount).toBe(1)
    expect(t.totalInputWeight).toBe(500)
    expect(t.avgThroughput).toBe(500)
  })

  it('returns null averages when there is no qualifying data', () => {
    const t = shiftTotals([], settings)
    expect(t.rollCount).toBe(0)
    expect(t.avgThroughput).toBeNull()
    expect(t.avgDurationMinutes).toBeNull()
  })
})

describe('materialSummaries', () => {
  it('groups completed runs by material with per-material averages', () => {
    const runs = [
      makeRun({ id: 'a', materialType: 'Micro', inputWeight: 500, peakAmps: 130, startTime: '10:00', endTime: '11:00' }),
      makeRun({ id: 'b', materialType: 'Micro', inputWeight: 300, peakAmps: 120, startTime: '11:00', endTime: '11:30' }),
      makeRun({ id: 'c', materialType: 'Smooth', inputWeight: 450, peakAmps: null, startTime: '12:00', endTime: '12:15' }),
    ]
    const summaries = materialSummaries(runs, settings)
    const micro = summaries.find((s) => s.type === 'Micro')!
    expect(micro.count).toBe(2)
    expect(micro.totalInputWeight).toBe(800)
    expect(micro.avgThroughput).toBe(550)
    expect(micro.avgPeakAmps).toBe(125)
    expect(micro.avgDurationMinutes).toBe(45)

    const smooth = summaries.find((s) => s.type === 'Smooth')!
    expect(smooth.count).toBe(1)
    // no amps recorded -> stays null, not zero
    expect(smooth.avgPeakAmps).toBeNull()

    // materials with no runs are omitted
    expect(summaries.find((s) => s.type === 'Other')).toBeUndefined()
  })
})
