import { describe, it, expect, beforeEach } from 'vitest'
import {
  QUARANTINE_KEY,
  STORAGE_KEY,
  clearQuarantine,
  defaultState,
  loadState,
  readQuarantine,
  saveState,
} from './storage'
import { SCHEMA_VERSION } from '../types/domain'

describe('storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns a valid default state when nothing is stored', () => {
    const state = loadState()
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.runs).toEqual([])
    expect(state.settings.safeAmps).toBeGreaterThan(0)
    expect(state.settings.tripAmps).toBeGreaterThan(state.settings.safeAmps)
    expect(state.profiles.length).toBeGreaterThan(0)
  })

  it('round-trips a saved state', () => {
    const state = defaultState()
    state.shiftNotes = 'thermal trip at 14:00'
    saveState(state)
    const loaded = loadState()
    expect(loaded.shiftNotes).toBe('thermal trip at 14:00')
  })

  it('falls back to default when stored JSON is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    const state = loadState()
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.runs).toEqual([])
  })

  it('falls back to default when the stored schema version is unknown', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, runs: [{ id: 'x' }] }),
    )
    const state = loadState()
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.runs).toEqual([])
  })

  function store(state: unknown) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  it('falls back to default when a stored run is not an object', () => {
    store({ ...defaultState(), runs: [42] })
    expect(loadState().runs).toEqual([])
  })

  it('falls back to default when a stored run has an out-of-range number', () => {
    store({ ...defaultState(), runs: [{ ...validRun(), inputWeight: -10 }] })
    expect(loadState().runs).toEqual([])
  })

  it('coerces an invalid material and time rather than crashing', () => {
    store({ ...defaultState(), runs: [{ ...validRun(), materialType: 'BOGUS', startTime: 123 }] })
    const state = loadState()
    expect(state.runs.length).toBe(1)
    expect(state.runs[0].materialType).toBe('Other')
    expect(state.runs[0].startTime).toBe('')
  })

  it('repairs malformed settings back to safe defaults', () => {
    store({ ...defaultState(), settings: { safeAmps: 'nope', tripAmps: -3 } })
    const { settings } = loadState()
    expect(settings.safeAmps).toBeGreaterThan(0)
    expect(settings.tripAmps).toBeGreaterThan(settings.safeAmps)
  })

  it('repairs malformed profiles back to defaults', () => {
    store({ ...defaultState(), profiles: 'nope' })
    expect(loadState().profiles.length).toBeGreaterThan(0)
  })

  it('normalizes multiple active runs down to one', () => {
    store({
      ...defaultState(),
      runs: [
        { ...validRun(), id: 'a', active: true, endTime: null, createdAt: 1 },
        { ...validRun(), id: 'b', active: true, endTime: null, createdAt: 2 },
      ],
    })
    const state = loadState()
    expect(state.runs.filter((r) => r.active).length).toBe(1)
  })
})

describe('quarantine of unreadable data', () => {
  beforeEach(() => window.localStorage.clear())

  it('sets aside a future schema version instead of erasing it', () => {
    const future = JSON.stringify({ schemaVersion: 999, runs: [{ id: 'x' }], shiftNotes: 'real work' })
    window.localStorage.setItem(STORAGE_KEY, future)

    loadState()

    const held = readQuarantine()
    expect(held?.payload).toBe(future)
    expect(held?.reason).toContain('999')
    // The app saves a clean state over STORAGE_KEY right after loading, so the
    // quarantine copy is the only thing standing between a version bump and a
    // silently erased shift.
    saveState(defaultState())
    expect(readQuarantine()?.payload).toBe(future)
  })

  it('sets aside corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    loadState()
    expect(readQuarantine()?.payload).toBe('{not valid json')
  })

  it('sets aside a payload that fails validation', () => {
    const bad = JSON.stringify({ ...defaultState(), runs: [42] })
    window.localStorage.setItem(STORAGE_KEY, bad)
    loadState()
    expect(readQuarantine()?.payload).toBe(bad)
  })

  it('leaves no quarantine behind on a healthy load', () => {
    saveState({ ...defaultState(), shiftNotes: 'fine' })
    expect(loadState().shiftNotes).toBe('fine')
    expect(readQuarantine()).toBeNull()
    expect(window.localStorage.getItem(QUARANTINE_KEY)).toBeNull()
  })

  it('clears on dismissal', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    loadState()
    expect(readQuarantine()).not.toBeNull()
    clearQuarantine()
    expect(readQuarantine()).toBeNull()
  })
})

function validRun() {
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
  }
}
