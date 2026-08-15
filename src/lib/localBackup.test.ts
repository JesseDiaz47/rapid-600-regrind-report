import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BACKUP_FILENAME_PREFIX,
  buildBackupFilename,
  canSaveDirectly,
  hoursSinceLastBackup,
  readLastBackup,
  saveBackup,
  writeLastBackup,
} from './localBackup'
import { defaultState } from './storage'
import type { AppState } from '../types/domain'

describe('buildBackupFilename', () => {
  it('embeds the shift date and a sortable timestamp', () => {
    const stamp = new Date(2026, 6, 26, 14, 5) // 2026-07-26 14:05 local
    const name = buildBackupFilename('2026-07-26', stamp)
    expect(name).toBe('regrind-backup-2026-07-26-20260726-1405.json')
  })

  it('falls back to "no-date" when the shift date contains anything other than digits and dashes', () => {
    const name = buildBackupFilename('??!!', new Date(2026, 0, 1, 0, 0))
    expect(name.startsWith(`${BACKUP_FILENAME_PREFIX}-no-date-`)).toBe(true)
  })

  it('zero-pads single-digit months, days, hours, and minutes', () => {
    const stamp = new Date(2026, 2, 9, 3, 4) // 2026-03-09 03:04
    const name = buildBackupFilename('2026-03-09', stamp)
    expect(name).toBe('regrind-backup-2026-03-09-20260309-0304.json')
  })
})

describe('canSaveDirectly', () => {
  it('returns false in a jsdom test environment without showSaveFilePicker', () => {
    expect(canSaveDirectly()).toBe(false)
  })

  it('returns true when showSaveFilePicker is exposed on window', () => {
    const w = window as unknown as { showSaveFilePicker: unknown }
    const original = w.showSaveFilePicker
    w.showSaveFilePicker = () => Promise.resolve({})
    try {
      expect(canSaveDirectly()).toBe(true)
    } finally {
      if (original === undefined) {
        delete w.showSaveFilePicker
      } else {
        w.showSaveFilePicker = original
      }
    }
  })
})

describe('last backup record', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns null when nothing is recorded', () => {
    expect(readLastBackup()).toBeNull()
  })

  it('round-trips through localStorage', () => {
    const record = {
      exportedAt: '2026-07-26T14:05:00.000Z',
      filename: 'regrind-backup-2026-07-26-20260726-1405.json',
      destination: 'download' as const,
      bytes: 1234,
      shiftDate: '2026-07-26',
      runCount: 7,
    }
    writeLastBackup(record)
    expect(readLastBackup()).toEqual(record)
  })

  it('ignores a corrupt record', () => {
    window.localStorage.setItem('regrind-vfd-last-backup', '{not valid')
    expect(readLastBackup()).toBeNull()
  })

  it('ignores a record that is missing required fields', () => {
    window.localStorage.setItem(
      'regrind-vfd-last-backup',
      JSON.stringify({ exportedAt: '2026-07-26T14:05:00.000Z' }),
    )
    expect(readLastBackup()).toBeNull()
  })
})

describe('hoursSinceLastBackup', () => {
  afterEach(() => vi.useRealTimers())

  it('is null when no record exists', () => {
    expect(hoursSinceLastBackup(null)).toBeNull()
  })

  it('returns a positive number of hours since the exportedAt timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T08:00:00.000Z'))
    const record = {
      exportedAt: '2026-07-26T20:00:00.000Z',
      filename: 'x.json',
      destination: 'download' as const,
      bytes: 1,
      shiftDate: '2026-07-26',
      runCount: 0,
    }
    expect(hoursSinceLastBackup(record)).toBeCloseTo(12, 5)
  })

  it('returns null for an unparseable timestamp', () => {
    expect(
      hoursSinceLastBackup({
        exportedAt: 'not-a-date',
        filename: 'x.json',
        destination: 'download',
        bytes: 1,
        shiftDate: '2026-07-26',
        runCount: 0,
      }),
    ).toBeNull()
  })
})

describe('saveBackup fallback to download', () => {
  beforeEach(() => {
    window.localStorage.clear()
    const w = window as unknown as { showSaveFilePicker?: unknown }
    delete w.showSaveFilePicker
  })

  it('produces a JSON download with the canonical filename when showSaveFilePicker is absent', async () => {
    const click = vi.fn()
    const originalCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag) as HTMLAnchorElement
      if (tag === 'a') el.click = click
      return el
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 26, 14, 5)) // 2026-07-26 14:05 local
    try {
      const state: AppState = { ...defaultState(), shiftDate: '2026-07-26' }
      const result = await saveBackup(state)

      expect(result.destination).toBe('download')
      expect(result.filename).toBe('regrind-backup-2026-07-26-20260726-1405.json')
      expect(result.bytes).toBeGreaterThan(0)
      expect(click).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
      createSpy.mockRestore()
    }
  })
})
