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
 * Load persisted state. Returns a fresh default state if nothing is stored,
 * the JSON is corrupt, the schema version is not one we understand, or the
 * stored shape fails validation.
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
    if (parsed?.schemaVersion !== SCHEMA_VERSION) return defaultState()
    const result = sanitizeState(parsed)
    return result.ok ? result.state : defaultState()
  } catch {
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
