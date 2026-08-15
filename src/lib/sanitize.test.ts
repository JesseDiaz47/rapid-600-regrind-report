import { describe, it, expect } from 'vitest'
import { normalizeActiveRuns, sanitizeRoster, sanitizeState } from './sanitize'
import { defaultState } from './defaults'
import type { Run } from '../types/domain'

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    materialType: 'Micro',
    rollId: null,
    startTime: '10:00',
    endTime: '11:00',
    inputWeight: 500,
    outputWeight: 450,
    peakAmps: 120,
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

describe('normalizeActiveRuns', () => {
  it('leaves a single active run untouched', () => {
    const runs = [makeRun({ id: 'a', active: true, createdAt: 1 })]
    expect(normalizeActiveRuns(runs)).toEqual(runs)
  })

  it('keeps only the most recently created active run active', () => {
    const runs = [
      makeRun({ id: 'a', active: true, createdAt: 1 }),
      makeRun({ id: 'b', active: true, createdAt: 3 }),
      makeRun({ id: 'c', active: true, createdAt: 2 }),
    ]
    const out = normalizeActiveRuns(runs)
    expect(out.filter((r) => r.active).map((r) => r.id)).toEqual(['b'])
    expect(out.length).toBe(3)
  })
})

describe('sanitizeState', () => {
  it('accepts a clean state', () => {
    const res = sanitizeState(defaultState())
    expect(res.ok).toBe(true)
  })

  it('coerces an unknown material to Other and blanks an invalid time', () => {
    const raw = {
      ...defaultState(),
      runs: [{ ...makeRun(), materialType: 'Zzz', startTime: 123 }],
    }
    const res = sanitizeState(raw)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.state.runs[0].materialType).toBe('Other')
      expect(res.state.runs[0].startTime).toBe('')
    }
  })

  it('rejects a run that is not an object', () => {
    const raw = { ...defaultState(), runs: [42] }
    expect(sanitizeState(raw).ok).toBe(false)
  })

  it('rejects an out-of-range numeric value', () => {
    const raw = { ...defaultState(), runs: [makeRun({ inputWeight: -5 })] }
    expect(sanitizeState(raw).ok).toBe(false)
  })

  it('rejects a non-finite numeric value', () => {
    const raw = { ...defaultState(), runs: [{ ...makeRun(), peakAmps: Number.POSITIVE_INFINITY }] }
    // JSON has no Infinity, but tampered in-memory objects can; guard anyway.
    expect(sanitizeState(raw).ok).toBe(false)
  })

  it('falls back to default profiles when profiles are malformed', () => {
    const res = sanitizeState({ ...defaultState(), profiles: 'nope' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.state.profiles.length).toBeGreaterThan(0)
  })

  it('falls back to default settings when settings are malformed', () => {
    const res = sanitizeState({ ...defaultState(), settings: { safeAmps: -1, tripAmps: 'x' } })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.state.settings.safeAmps).toBeGreaterThan(0)
      expect(res.state.settings.tripAmps).toBeGreaterThan(res.state.settings.safeAmps)
    }
  })

  it('normalizes multiple active runs to at most one', () => {
    const raw = {
      ...defaultState(),
      runs: [
        makeRun({ id: 'a', active: true, createdAt: 1, endTime: null }),
        makeRun({ id: 'b', active: true, createdAt: 2, endTime: null }),
      ],
    }
    const res = sanitizeState(raw)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.state.runs.filter((r) => r.active).length).toBe(1)
  })

  it('normalizes duplicate run IDs without dropping records', () => {
    const raw = {
      ...defaultState(),
      runs: [makeRun({ id: 'duplicate' }), makeRun({ id: 'duplicate', createdAt: 2 })],
    }
    const res = sanitizeState(raw)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.state.runs).toHaveLength(2)
      expect(new Set(res.state.runs.map((r) => r.id)).size).toBe(2)
    }
  })
})

describe('sanitizeRoster', () => {
  it('falls back to an empty roster for corrupt or non-array payloads', () => {
    expect(sanitizeRoster(null)).toEqual([])
    expect(sanitizeRoster('not an array')).toEqual([])
    expect(sanitizeRoster({ id: 'x' })).toEqual([])
  })

  it('drops entries without a usable name', () => {
    const roster = sanitizeRoster([{ id: 'a', name: '   ', pin: null, active: true }, null, 42])
    expect(roster).toEqual([])
  })

  it('keeps valid entries and trims names', () => {
    const roster = sanitizeRoster([
      { id: 'a', name: '  Alex Rivera  ', pin: '1234', active: true },
      { id: 'b', name: 'Sam Lee', pin: null, active: false },
    ])
    expect(roster).toEqual([
      { id: 'a', name: 'Alex Rivera', pin: '1234', active: true },
      { id: 'b', name: 'Sam Lee', pin: null, active: false },
    ])
  })

  it('drops a second entry that reuses an id, keeping the first', () => {
    const roster = sanitizeRoster([
      { id: 'dup', name: 'First', pin: null, active: true },
      { id: 'dup', name: 'Second', pin: null, active: true },
    ])
    expect(roster).toHaveLength(1)
    expect(roster[0].name).toBe('First')
  })

  it('rejects an overlong PIN rather than truncating it silently', () => {
    const roster = sanitizeRoster([
      { id: 'a', name: 'Alex', pin: '1234567890123', active: true },
    ])
    expect(roster[0].pin).toBeNull()
  })
})
