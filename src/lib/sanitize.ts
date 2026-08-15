/**
 * Strong validation / sanitization shared by JSON restore and localStorage
 * load. Both paths funnel through `sanitizeState` so malformed, tampered, or
 * stale data can never crash rendering or inject invalid numbers, times, or a
 * second active run. Missing optional values stay `null` rather than becoming
 * fabricated zeros.
 *
 * Dependency-free of `storage` (it only reaches for `defaults`) to avoid a
 * circular import.
 */
import type {
  AppState,
  Employee,
  IssueFlag,
  MachineSettings,
  MaterialProfile,
  MaterialType,
  Run,
} from '../types/domain'
import { ISSUE_FLAGS, MATERIAL_TYPES, SCHEMA_VERSION } from '../types/domain'
import { defaultState } from './defaults'

export const MAX_WEIGHT = 100_000
export const MAX_AMPS = 1_000

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Validate & coerce an optional non-negative numeric field. */
function optionalNumber(v: unknown, max: number): number | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null
  if (!isFiniteNumber(v)) return 'invalid'
  if (v < 0 || v > max) return 'invalid'
  return v
}

export function sanitizeRun(input: unknown, index: number): Run {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`Run ${index + 1} is not an object`)
  }
  const r = input as Record<string, unknown>

  const materialType = MATERIAL_TYPES.includes(r.materialType as MaterialType)
    ? (r.materialType as MaterialType)
    : 'Other'

  const inputWeight = optionalNumber(r.inputWeight, MAX_WEIGHT)
  const outputWeight = optionalNumber(r.outputWeight, MAX_WEIGHT)
  const peakAmps = optionalNumber(r.peakAmps, MAX_AMPS)
  const runningOutAmps = optionalNumber(r.runningOutAmps, MAX_AMPS)
  if (
    inputWeight === 'invalid' ||
    outputWeight === 'invalid' ||
    peakAmps === 'invalid' ||
    runningOutAmps === 'invalid'
  ) {
    throw new Error(`Run ${index + 1} has an out-of-range numeric value`)
  }

  const validIssues: IssueFlag[] = Array.isArray(r.issues)
    ? (r.issues.filter((i) => ISSUE_FLAGS.some((f) => f.id === i)) as IssueFlag[])
    : []

  return {
    id: typeof r.id === 'string' && r.id ? r.id : `run-${Date.now()}-${index}`,
    materialType,
    rollId: typeof r.rollId === 'string' && r.rollId ? r.rollId : null,
    startTime: typeof r.startTime === 'string' ? r.startTime : '',
    endTime: typeof r.endTime === 'string' && r.endTime ? r.endTime : null,
    inputWeight,
    outputWeight,
    peakAmps,
    runningOutAmps,
    issues: validIssues,
    notes: typeof r.notes === 'string' ? r.notes : '',
    active: r.active === true,
    createdAt: isFiniteNumber(r.createdAt) ? r.createdAt : Date.now(),
    updatedAt: isFiniteNumber(r.updatedAt) ? r.updatedAt : Date.now(),
    demo: r.demo === true ? true : undefined,
    operatorName: typeof r.operatorName === 'string' && r.operatorName ? r.operatorName : null,
  }
}

export function sanitizeProfiles(input: unknown): MaterialProfile[] {
  const base = defaultState().profiles
  if (!Array.isArray(input)) return base
  return base.map((def) => {
    const found = input.find(
      (p) =>
        typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === def.type,
    ) as Record<string, unknown> | undefined
    if (!found) return def
    const targetRate = optionalNumber(found.targetRate, MAX_WEIGHT)
    const expectedYield = optionalNumber(found.expectedYield, 100)
    return {
      type: def.type,
      targetRate: targetRate === 'invalid' ? null : targetRate,
      expectedYield: expectedYield === 'invalid' ? null : expectedYield,
      notes: typeof found.notes === 'string' ? found.notes : '',
    }
  })
}

export function sanitizeSettings(input: unknown): MachineSettings {
  const base = defaultState().settings
  if (typeof input !== 'object' || input === null) return base
  const s = input as Record<string, unknown>
  const safe = optionalNumber(s.safeAmps, MAX_AMPS)
  const trip = optionalNumber(s.tripAmps, MAX_AMPS)
  // A blank or invalid threshold falls back to the safe default, and a
  // non-positive or inverted pair is repaired to the defaults so downstream
  // headroom math always has a valid safe < trip window.
  let safeAmps = typeof safe === 'number' && safe > 0 ? safe : base.safeAmps
  let tripAmps = typeof trip === 'number' && trip > 0 ? trip : base.tripAmps
  if (safeAmps >= tripAmps) {
    safeAmps = base.safeAmps
    tripAmps = base.tripAmps
  }
  return {
    safeAmps,
    tripAmps,
    screenSize: typeof s.screenSize === 'string' ? s.screenSize : base.screenSize,
  }
}

/** Ensure every persisted run has a unique key without dropping any records. */
export function normalizeRunIds(runs: Run[]): Run[] {
  const seen = new Set<string>()
  return runs.map((run, index) => {
    if (!seen.has(run.id)) {
      seen.add(run.id)
      return run
    }
    const base = run.id || 'run'
    let suffix = index + 1
    let id = `${base}-${suffix}`
    while (seen.has(id)) {
      suffix += 1
      id = `${base}-${suffix}`
    }
    seen.add(id)
    return { ...run, id }
  })
}

/**
 * Guarantee at most one active run. When several are flagged active (stale or
 * tampered data), the most recently created one wins and the rest are marked
 * finished so rendering and shift math stay consistent.
 */
export function normalizeActiveRuns(runs: Run[]): Run[] {
  const activeIdx = runs.map((r, i) => (r.active ? i : -1)).filter((i) => i >= 0)
  if (activeIdx.length <= 1) return runs
  let keep = activeIdx[0]
  for (const i of activeIdx) {
    if (runs[i].createdAt > runs[keep].createdAt) keep = i
  }
  return runs.map((r, i) => (r.active && i !== keep ? { ...r, active: false } : r))
}

const MAX_PIN_LENGTH = 12

/** Validate a single roster entry read from localStorage. */
function sanitizeEmployee(input: unknown, index: number): Employee | null {
  if (typeof input !== 'object' || input === null) return null
  const e = input as Record<string, unknown>
  const name = typeof e.name === 'string' ? e.name.trim() : ''
  if (!name) return null
  const pin =
    typeof e.pin === 'string' && e.pin.length > 0 && e.pin.length <= MAX_PIN_LENGTH ? e.pin : null
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `employee-${Date.now()}-${index}`,
    name,
    pin,
    active: e.active !== false,
  }
}

/**
 * Validate a persisted employee roster. Corrupt or non-array payloads fall
 * back to an empty roster rather than crashing the sign-in gate.
 */
export function sanitizeRoster(input: unknown): Employee[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const roster: Employee[] = []
  for (const [index, raw] of input.entries()) {
    const employee = sanitizeEmployee(raw, index)
    if (!employee || seen.has(employee.id)) continue
    seen.add(employee.id)
    roster.push(employee)
  }
  return roster
}

export type SanitizeResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string }

/**
 * Validate and repair an unknown state payload into a trusted `AppState`.
 * Runs are strictly validated (out-of-range/non-object payloads fail), while
 * settings and profiles are repaired to defaults, and active runs are
 * normalized to at most one.
 */
export function sanitizeState(raw: unknown): SanitizeResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'State is not an object.' }
  }
  const rawState = raw as Record<string, unknown>
  const base = defaultState()

  try {
    const runs = Array.isArray(rawState.runs)
      ? rawState.runs.map((r, i) => sanitizeRun(r, i))
      : []
    const state: AppState = {
      schemaVersion: SCHEMA_VERSION,
      runs: normalizeActiveRuns(normalizeRunIds(runs)),
      settings: sanitizeSettings(rawState.settings),
      profiles: sanitizeProfiles(rawState.profiles),
      shiftDate: typeof rawState.shiftDate === 'string' ? rawState.shiftDate : base.shiftDate,
      shiftNotes: typeof rawState.shiftNotes === 'string' ? rawState.shiftNotes : '',
    }
    return { ok: true, state }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid state data.' }
  }
}
