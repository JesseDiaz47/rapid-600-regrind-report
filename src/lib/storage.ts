/**
 * Versioned local persistence. All data lives in localStorage under a single
 * key. Corrupt, unknown-version, or otherwise invalid payloads fall back to a
 * clean default state rather than crashing or silently loading garbage. Load
 * runs the loaded payload through the same strong validation used by JSON
 * restore (`sanitizeState`) so tampered storage cannot inject invalid data.
 */
import type { AppState } from '../types/domain'
import { SCHEMA_VERSION } from '../types/domain'
import { DEFAULT_SETTINGS, defaultState } from './defaults'
import { sanitizeState } from './sanitize'

export { DEFAULT_SETTINGS, defaultState }

export const STORAGE_KEY = 'rapid-600-regrind-report'

/**
 * Where an unreadable payload is set aside.
 *
 * A failed load returns a clean state, and the app saves that clean state back
 * over STORAGE_KEY moments later — so without this copy the original bytes are
 * gone a second after the app opens, and the operator finds an empty shift
 * with no explanation. Quarantining costs one extra key and turns silent loss
 * into something recoverable.
 */
export const QUARANTINE_KEY = 'rapid-600-regrind-report-unreadable'

export interface QuarantineRecord {
  quarantinedAt: string
  /** Plain-English reason, shown to the operator. */
  reason: string
  /** The exact bytes that were in storage, untouched. */
  payload: string
}

function quarantine(raw: string, reason: string): void {
  try {
    const record: QuarantineRecord = {
      quarantinedAt: new Date().toISOString(),
      reason,
      payload: raw,
    }
    window.localStorage.setItem(QUARANTINE_KEY, JSON.stringify(record))
  } catch {
    /* out of storage; nothing further we can do to save it */
  }
}

export function readQuarantine(): QuarantineRecord | null {
  try {
    const raw = window.localStorage.getItem(QUARANTINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as QuarantineRecord
    return parsed.payload ? parsed : null
  } catch {
    return null
  }
}

export function clearQuarantine(): void {
  try {
    window.localStorage.removeItem(QUARANTINE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Load persisted state. Returns a fresh default state if nothing is stored,
 * the JSON is corrupt, the schema version is not one we understand, or the
 * stored shape fails validation. Anything unreadable is quarantined first, so
 * a future version bump can never silently erase a shift.
 */
export function loadState(): AppState {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return defaultState()
  }
  if (!raw) return defaultState()

  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown }
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
      quarantine(
        raw,
        `Saved data is version ${String(parsed?.schemaVersion)}, and this app reads version ${SCHEMA_VERSION}.`,
      )
      return defaultState()
    }
    const result = sanitizeState(parsed)
    if (!result.ok) {
      quarantine(raw, result.error)
      return defaultState()
    }
    return result.state
  } catch {
    quarantine(raw, 'Saved data was not valid JSON.')
    return defaultState()
  }
}

/** Persist state. Failures (e.g. private mode quota) are swallowed. */
export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage may be unavailable; the in-memory state remains authoritative */
  }
}

/** Remove all persisted data. */
export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
