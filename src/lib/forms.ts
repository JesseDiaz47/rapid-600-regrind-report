/** Form helpers shared by the entry forms. */

/** Upper bounds mirrored from the persistence-layer validation. */
export const MAX_WEIGHT = 100_000
export const MAX_AMPS = 1_000
export const MAX_YIELD = 100

/** Parse a text input into a non-negative number, or null when blank/invalid. */
export function parseNumberInput(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Render a number|null back into a controlled input string. */
export function numberToInput(value: number | null): string {
  return value === null ? '' : String(value)
}

export interface NumberFieldOptions {
  label: string
  /** Blank is an error rather than a valid null. */
  required?: boolean
  /** Value must be strictly greater than zero. */
  positive?: boolean
  max: number
}

export type NumberFieldResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

/**
 * Validate a text field into a finite, non-negative number within range. This
 * mirrors the persistence-layer guards so the UI never stores NaN, Infinity,
 * negative, or absurdly large values, and keeps blank optional fields as null.
 */
export function validateNumberField(
  raw: string,
  opts: NumberFieldOptions,
): NumberFieldResult {
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (opts.required) return { ok: false, error: `${opts.label} is required.` }
    return { ok: true, value: null }
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return { ok: false, error: `${opts.label} must be a number.` }
  if (n < 0) return { ok: false, error: `${opts.label} cannot be negative.` }
  if (opts.positive && n === 0) {
    return { ok: false, error: `${opts.label} must be greater than 0.` }
  }
  if (n > opts.max) {
    return { ok: false, error: `${opts.label} is too large (max ${opts.max.toLocaleString('en-US')}).` }
  }
  return { ok: true, value: n }
}

export type ThresholdResult =
  | { ok: true; safeAmps: number; tripAmps: number }
  | { ok: false; error: string }

/**
 * Validate the amp threshold pair. Both must be finite and positive, and the
 * trip limit must sit above the safe ceiling. A blank field is an error, never
 * a silent zero.
 */
export function validateThresholds(safeRaw: string, tripRaw: string): ThresholdResult {
  const safe = validateNumberField(safeRaw, {
    label: 'Safe ceiling',
    required: true,
    positive: true,
    max: MAX_AMPS,
  })
  if (!safe.ok) return safe
  const trip = validateNumberField(tripRaw, {
    label: 'Trip threshold',
    required: true,
    positive: true,
    max: MAX_AMPS,
  })
  if (!trip.ok) return trip
  // Both are required+positive, so value is a number, not null.
  const safeAmps = safe.value as number
  const tripAmps = trip.value as number
  if (safeAmps >= tripAmps) {
    return { ok: false, error: 'Trip threshold must be higher than the safe ceiling.' }
  }
  return { ok: true, safeAmps, tripAmps }
}
