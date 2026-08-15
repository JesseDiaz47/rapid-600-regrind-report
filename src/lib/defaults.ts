/**
 * Default state builders, kept in a dependency-free module so both `storage`
 * (load/save) and `sanitize` (validation) can share them without a circular
 * import.
 */
import type { AppState, MachineSettings, MaterialProfile } from '../types/domain'
import { MATERIAL_TYPES, SCHEMA_VERSION } from '../types/domain'

export const DEFAULT_SETTINGS: MachineSettings = {
  safeAmps: 130,
  tripAmps: 140,
  screenSize: '',
}

export function defaultProfiles(): MaterialProfile[] {
  return MATERIAL_TYPES.map((type) => ({
    type,
    targetRate: null,
    expectedYield: null,
    notes: '',
  }))
}

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** A fresh, empty state ready for a new shift. */
export function defaultState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    runs: [],
    settings: { ...DEFAULT_SETTINGS },
    profiles: defaultProfiles(),
    shiftDate: todayIso(),
    shiftNotes: '',
  }
}
