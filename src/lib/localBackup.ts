/**
 * Local backup helpers.
 *
 * The app lives in a browser sandbox. It can only persist into its own
 * localStorage on this device, and it can hand a JSON file to the browser's
 * normal download path or, where supported, save directly into a folder the
 * user chooses (e.g. a shared drive).
 *
 * These helpers exist to:
 *   - Produce a consistent, sortable backup filename.
 *   - Detect whether the running browser can save directly into a chosen
 *     folder (File System Access API on Chromium) and provide a clean
 *     fallback (regular download) elsewhere.
 *   - Track "last successful backup" metadata inside localStorage so the UI
 *     can warn when no backup has been taken recently.
 *
 * No raw production data ever leaves the device through the network.
 */

import type { AppState, Employee } from '../types/domain'
import { serializeBackup } from './importExport'

export const BACKUP_FILENAME_PREFIX = 'regrind-backup'

/**
 * Build the canonical filename: `regrind-backup-YYYY-MM-DD-YYYYMMDD-HHMM.json`.
 * The leading shift date makes the file recognizable in a folder view; the
 * trailing timestamp sorts naturally and is unique per export.
 */
export function buildBackupFilename(shiftDate: string, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    '-' +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}`
  const safeShift = shiftDate.replace(/[^0-9-]/g, '') || 'no-date'
  return `${BACKUP_FILENAME_PREFIX}-${safeShift}-${stamp}.json`
}

/**
 * Detect whether the running browser supports direct folder writes via the
 * File System Access API. Chromium-based browsers (including the installed
 * PWA on macOS / Windows) expose `showSaveFilePicker`. Safari and iOS do not.
 */
export function canSaveDirectly(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { showSaveFilePicker?: unknown }
  return typeof w.showSaveFilePicker === 'function'
}

export interface SaveResult {
  /** Where the file was written. `'direct'` for File System Access, `'download'` for a normal browser download. */
  destination: 'direct' | 'download'
  filename: string
  bytes: number
}

/**
 * Save the current state to a JSON backup. On Chromium this asks the user
 * for a save location and writes the file in place. Elsewhere it falls back
 * to a normal browser download.
 */
export async function saveBackup(state: AppState, roster: Employee[] = []): Promise<SaveResult> {
  const json = serializeBackup(state, roster)
  const filename = buildBackupFilename(state.shiftDate)
  const bytes = new Blob([json]).size

  if (canSaveDirectly()) {
    const w = window as unknown as {
      showSaveFilePicker: (opts: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>
          close: () => Promise<void>
        }>
      }>
    }
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Regrind VFD backup',
          accept: { 'application/json': ['.json'] },
        },
      ],
    })
    const writable = await handle.createWritable()
    try {
      await writable.write(json)
    } finally {
      await writable.close()
    }
    return { destination: 'direct', filename, bytes }
  }

  triggerDownload(filename, json, 'application/json')
  return { destination: 'download', filename, bytes }
}

/**
 * Pure wrapper around the download DOM dance so it can be unit-tested
 * with a stubbed `URL.createObjectURL` / `document.createElement`.
 */
export function triggerDownload(filename: string, contents: string, mime: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so Safari can consume the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------------------------------------------ *
 * Last-backup metadata kept in localStorage.
 * ------------------------------------------------------------------ */

const LAST_BACKUP_KEY = 'rapid-600-last-backup'

export interface LastBackupRecord {
  /** ISO timestamp of the last successful save. */
  exportedAt: string
  filename: string
  destination: 'direct' | 'download'
  bytes: number
  shiftDate: string
  runCount: number
}

export function readLastBackup(): LastBackupRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastBackupRecord
    if (!parsed.exportedAt || !parsed.filename) return null
    return parsed
  } catch {
    return null
  }
}

export function writeLastBackup(record: LastBackupRecord): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify(record))
  } catch {
    /* storage may be unavailable; not a user-facing failure */
  }
}

/** Hours since the last successful backup, or `null` if none was ever taken. */
export function hoursSinceLastBackup(record: LastBackupRecord | null): number | null {
  if (!record) return null
  const last = Date.parse(record.exportedAt)
  if (Number.isNaN(last)) return null
  return (Date.now() - last) / (1000 * 60 * 60)
}
