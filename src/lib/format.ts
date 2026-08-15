/** Presentation helpers. These never fabricate data: null renders as a dash. */

export const DASH = '—'

export function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

export function fmtWeight(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return `${fmtNum(value)} lb`
}

export function fmtRate(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return `${fmtNum(value)} lb/hr`
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return DASH
  return `${fmtNum(value, digits)}%`
}

export function fmtAmps(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return `${fmtNum(value, 1)} A`
}

/** Format a minute count as "1h 05m" / "45m". */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return DASH
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** Elapsed time from a start clock string to a reference epoch, as "MM:SS". */
export function fmtElapsedClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Current local time as "HH:MM" (24h) for defaulting time inputs. */
export function nowTimeString(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`
}
