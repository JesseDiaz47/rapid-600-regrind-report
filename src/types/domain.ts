/**
 * Domain model for the Regrind VFD Command Center.
 *
 * Every run in this product is performed at a fixed VFD of 20. VFD is locked
 * context, never an editable or optimized value. Raw entered values are kept
 * separate from calculated metrics — metrics are always recomputed from raw
 * values, never trusted from stale saved output.
 */

/** All runs are performed at this fixed VFD. Displayed, never editable. */
export const FIXED_VFD = 20

/** Current persisted schema version. Bump when the shape changes. */
export const SCHEMA_VERSION = 2

export type MaterialType =
  | 'Smooth'
  | 'Micro'
  | 'MicroDrain'
  | 'MicroSpike'
  | 'Other'

export const MATERIAL_TYPES: MaterialType[] = [
  'Smooth',
  'Micro',
  'MicroDrain',
  'MicroSpike',
  'Other',
]

/** Short codes preserved from the legacy AGRU sheet, used in CSV export. */
export const MATERIAL_CODE: Record<MaterialType, string> = {
  Smooth: 'S',
  Micro: 'M',
  MicroDrain: 'MD',
  MicroSpike: 'MS',
  Other: 'Other',
}

export type IssueFlag = 'jam' | 'trip' | 'screen' | 'knife' | 'other'

export const ISSUE_FLAGS: { id: IssueFlag; label: string }[] = [
  { id: 'jam', label: 'Jam' },
  { id: 'trip', label: 'Thermal trip' },
  { id: 'screen', label: 'Screen change' },
  { id: 'knife', label: 'Knife' },
  { id: 'other', label: 'Other' },
]

/**
 * A single regrind run. Optional numeric values are `null` when not recorded —
 * they are never defaulted to zero, because a missing measurement must stay
 * missing rather than becoming invented data.
 */
export interface Run {
  id: string
  materialType: MaterialType
  /** Optional roll / tag identifier. */
  rollId: string | null
  /** Start time as "HH:MM" (24h). */
  startTime: string
  /** End time as "HH:MM" (24h), or null while the run is still active. */
  endTime: string | null
  /** Input weight in pounds. Required to log a completed run. */
  inputWeight: number | null
  /** Optional output / regrind weight in pounds. */
  outputWeight: number | null
  /** Optional peak amps observed during the run. */
  peakAmps: number | null
  /** Optional running-out (settling) amps. */
  runningOutAmps: number | null
  issues: IssueFlag[]
  notes: string
  /** True while the run is in progress (Start Roll pressed, not yet finished). */
  active: boolean
  createdAt: number
  updatedAt: number
  /** Marks clearly-labeled demo data so it can be cleared in bulk. */
  demo?: boolean
  /**
   * Name of the employee who logged this run, snapshotted at the time it was
   * recorded. Stored as a name (not a roster id) so the run stays accurate in
   * reports even if the roster changes later. Null when no operator was
   * signed in (never defaulted to a placeholder name).
   */
  operatorName: string | null
}

/**
 * A person who can be selected as the current operator on this device.
 * Roster identity is local-only attribution for accountability and reporting
 * — not authentication. There is no backend, no session, no password; a PIN
 * (if set) only guards against tapping the wrong name on a shared device.
 */
export interface Employee {
  id: string
  name: string
  /** Optional short local PIN. Null means no PIN is required to select this name. */
  pin: string | null
  /** False marks a former employee — kept so past runs still resolve to a name. */
  active: boolean
}

export interface MaterialProfile {
  type: MaterialType
  /** Target throughput lb/hr, or null if not set. */
  targetRate: number | null
  /** Expected yield %, or null if not set. */
  expectedYield: number | null
  notes: string
}

export interface MachineSettings {
  /** Safe amp ceiling. At/over this is amber. */
  safeAmps: number
  /** Trip amp threshold. At/over this is red. */
  tripAmps: number
  /** Screen size label, informational. */
  screenSize: string
}

export interface AppState {
  schemaVersion: number
  runs: Run[]
  settings: MachineSettings
  profiles: MaterialProfile[]
  /** Shift date (YYYY-MM-DD) the current runs belong to. */
  shiftDate: string
  shiftNotes: string
}

/** Versioned backup file written by JSON export and validated on restore. */
export interface BackupEnvelope {
  app: 'rapid-600-regrind-report'
  schemaVersion: number
  exportedAt: string
  state: AppState
}

/** Amp headroom status relative to the safe/trip thresholds. */
export type HeadroomStatus = 'safe' | 'near' | 'trip' | 'unknown'

/** Metrics recomputed from a run's raw values. Missing inputs yield `null`. */
export interface CalculatedRunMetrics {
  durationMinutes: number | null
  throughput: number | null
  yieldPercent: number | null
  ampsPer1kRate: number | null
  headroomToSafe: number | null
  headroomToTrip: number | null
  headroomStatus: HeadroomStatus
}

export interface MaterialSummary {
  type: MaterialType
  count: number
  totalInputWeight: number
  avgDurationMinutes: number | null
  avgThroughput: number | null
  avgPeakAmps: number | null
  avgYieldPercent: number | null
}

export interface ShiftTotals {
  rollCount: number
  totalInputWeight: number
  totalOutputWeight: number
  totalMinutes: number
  avgThroughput: number | null
  avgDurationMinutes: number | null
}
