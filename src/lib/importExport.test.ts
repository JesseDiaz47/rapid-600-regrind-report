import { describe, it, expect } from 'vitest'
import { runsToCsv, createBackup, serializeBackup, parseBackup } from './importExport'
import { defaultState } from './storage'
import type { Run } from '../types/domain'
import { SCHEMA_VERSION } from '../types/domain'

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

describe('runsToCsv', () => {
  const settings = { safeAmps: 130, tripAmps: 140, screenSize: '3/8"' }

  it('emits a header row and one row per run', () => {
    const csv = runsToCsv([makeRun()], settings)
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Material')
    expect(lines[0]).toContain('lb/hr')
  })

  it('escapes fields containing commas, quotes, and newlines', () => {
    const csv = runsToCsv(
      [makeRun({ notes: 'jam, then "cleared"\nrestarted', rollId: 'A,1' })],
      settings,
    )
    // A comma-containing note must be wrapped in quotes with quotes doubled.
    expect(csv).toContain('"jam, then ""cleared""\nrestarted"')
    expect(csv).toContain('"A,1"')
  })

  it('leaves missing optional values blank rather than writing zero', () => {
    const csv = runsToCsv(
      [makeRun({ outputWeight: null, peakAmps: null, endTime: null })],
      settings,
    )
    const row = csv.trim().split('\n')[1]
    // Should not fabricate a 0 for the blank output weight column.
    expect(row).not.toContain(',0,')
  })

  it('neutralizes spreadsheet formulas in user-controlled text fields', () => {
    const csv = runsToCsv(
      [makeRun({ rollId: '=HYPERLINK("https://bad")', notes: '+SUM(1,1)' })],
      settings,
    )
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'+SUM")
    expect(csv).not.toContain(',=HYPERLINK')
  })
})

describe('backup round-trip', () => {
  it('creates a versioned envelope', () => {
    const env = createBackup(defaultState())
    expect(env.app).toBe('rapid-600-regrind-report')
    expect(env.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof env.exportedAt).toBe('string')
  })

  it('serializes and parses back to an equivalent state', () => {
    const state = defaultState()
    state.runs.push(makeRun())
    const json = serializeBackup(state)
    const result = parseBackup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.runs.length).toBe(1)
      expect(result.state.runs[0].materialType).toBe('Micro')
    }
  })

  it('rejects malformed JSON', () => {
    const result = parseBackup('{oops')
    expect(result.ok).toBe(false)
  })

  it('rejects a wrong schema version', () => {
    const bad = JSON.stringify({
      app: 'regrind-vfd-command-center',
      schemaVersion: 999,
      exportedAt: 'now',
      state: defaultState(),
    })
    const result = parseBackup(bad)
    expect(result.ok).toBe(false)
  })

  it('rejects an envelope from a different app', () => {
    const bad = JSON.stringify({
      app: 'something-else',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 'now',
      state: defaultState(),
    })
    expect(parseBackup(bad).ok).toBe(false)
  })

  it('rejects runs with out-of-range numeric values', () => {
    const state = defaultState()
    state.runs.push(makeRun({ inputWeight: -5 }))
    const result = parseBackup(serializeBackup(state))
    expect(result.ok).toBe(false)
  })

  it('sanitizes and coerces a valid-but-loose run shape', () => {
    const state = defaultState()
    // Simulate a run missing the newer `runningOutAmps` field.
    const loose = makeRun()
    delete (loose as Partial<Run>).runningOutAmps
    state.runs.push(loose as Run)
    const result = parseBackup(serializeBackup(state))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.runs[0].runningOutAmps).toBeNull()
    }
  })
})
