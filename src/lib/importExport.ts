/**
 * CSV export and versioned JSON backup / restore. Restore validates the schema
 * version, the app signature, and every numeric range before trusting the data,
 * and preserves blanks rather than coercing missing values into zeros.
 */
import type { AppState, BackupEnvelope, MachineSettings, Run } from '../types/domain'
import { FIXED_VFD, MATERIAL_CODE, SCHEMA_VERSION } from '../types/domain'
import { computeRunMetrics } from './calculations'
import { sanitizeState } from './sanitize'

const APP_ID = 'rapid-600-regrind-report'

/** Escape a single CSV field per RFC 4180 and neutralize spreadsheet formulas. */
function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(s)) {
    s = `'${s}`
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function round(value: number | null, digits = 0): string {
  if (value === null) return ''
  const factor = 10 ** digits
  return String(Math.round(value * factor) / factor)
}

const CSV_HEADER = [
  'Operator',
  'Material',
  'Code',
  'Roll ID',
  'VFD',
  'Start',
  'End',
  'Duration (min)',
  'Input (lb)',
  'Output (lb)',
  'Yield %',
  'lb/hr',
  'Peak A',
  'Out A',
  'A per 1k lb/hr',
  'Headroom to trip (A)',
  'Issues',
  'Notes',
]

/** Serialize completed and active runs to a CSV string with computed columns. */
export function runsToCsv(runs: Run[], settings: MachineSettings): string {
  const rows = runs.map((run) => {
    const m = computeRunMetrics(run, settings)
    return [
      csvField(run.operatorName),
      csvField(run.materialType),
      csvField(MATERIAL_CODE[run.materialType]),
      csvField(run.rollId),
      csvField(FIXED_VFD),
      csvField(run.startTime),
      csvField(run.endTime),
      csvField(round(m.durationMinutes)),
      csvField(run.inputWeight),
      csvField(run.outputWeight),
      csvField(round(m.yieldPercent, 1)),
      csvField(round(m.throughput)),
      csvField(run.peakAmps),
      csvField(run.runningOutAmps),
      csvField(round(m.ampsPer1kRate, 1)),
      csvField(round(m.headroomToTrip)),
      csvField(run.issues.join(' ')),
      csvField(run.notes),
    ].join(',')
  })
  return [CSV_HEADER.join(','), ...rows].join('\n') + '\n'
}

/** Build a versioned backup envelope from the current state. */
export function createBackup(state: AppState): BackupEnvelope {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
}

export function serializeBackup(state: AppState): string {
  return JSON.stringify(createBackup(state), null, 2)
}

export type ParseResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string }

/** Parse and validate a backup JSON string into a trusted AppState. */
export function parseBackup(json: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Backup is not an object.' }
  }
  const env = parsed as Record<string, unknown>

  if (env.app !== APP_ID) {
    return { ok: false, error: 'This file is not a Rapid 600 Regrind Report backup.' }
  }
  if (env.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version (${String(env.schemaVersion)}). Expected ${SCHEMA_VERSION}.`,
    }
  }
  if (typeof env.state !== 'object' || env.state === null) {
    return { ok: false, error: 'Backup is missing its state.' }
  }

  // Reuse the same strong validation used to harden localStorage loads.
  const result = sanitizeState(env.state)
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  return { ok: true, state: result.state }
}
