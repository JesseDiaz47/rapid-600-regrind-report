import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildDemoRuns } from './demoData'
import { defaultState } from './defaults'
import { buildShiftReportPdf, openOrSharePdf, sortRunsForReport } from './pdfReport'

function stateWithRuns() {
  return {
    ...defaultState(),
    shiftDate: '2026-07-19',
    shiftNotes: 'Demo shift note.',
    runs: buildDemoRuns(),
  }
}

function pageCount(bytes: Uint8Array): number {
  const raw = new TextDecoder('latin1').decode(bytes)
  return raw.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0
}

describe('PDF report export', () => {
  afterEach(() => vi.restoreAllMocks())

  it('builds a real PDF containing the complete shift report', async () => {
    const blob = buildShiftReportPdf(stateWithRuns())
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const signature = new TextDecoder().decode(bytes.slice(0, 5))

    expect(blob.type).toBe('application/pdf')
    expect(signature).toBe('%PDF-')
    expect(blob.size).toBeGreaterThan(10_000)
  })

  it('builds a valid single-page PDF when no runs are recorded', async () => {
    const blob = buildShiftReportPdf(defaultState())
    const bytes = new Uint8Array(await blob.arrayBuffer())

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(pageCount(bytes)).toBe(1)
  })

  it('orders runs by clock start time, not entry order', () => {
    const runs = buildDemoRuns()
    // Entered last, but ran at 11:10 — must sort to the front of the log.
    const morning = runs.at(-1)!
    morning.startTime = '11:10'
    morning.endTime = '11:41'

    const sorted = sortRunsForReport(runs)

    expect(sorted[0]).toBe(morning)
    expect(sorted.slice(1).map((run) => run.startTime)).toEqual(
      runs.slice(0, -1).map((run) => run.startTime),
    )
  })

  it('flows a long run log onto continuation pages', async () => {
    const base = stateWithRuns()
    const many = Array.from({ length: 8 }, () => buildDemoRuns()).flat()
    many.forEach((run, i) => {
      run.createdAt = i
      run.updatedAt = i
    })
    const blob = buildShiftReportPdf({ ...base, runs: many })
    const bytes = new Uint8Array(await blob.arrayBuffer())

    expect(pageCount(bytes)).toBeGreaterThan(1)
  })

  it('opens a PDF preview when native file sharing is unavailable', async () => {
    const opened: { href?: string; download?: string; target?: string } = {}
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      opened.href = this.href
      opened.download = this.download
      opened.target = this.target
    })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })

    const result = await openOrSharePdf(new Blob(['pdf'], { type: 'application/pdf' }), 'shift.pdf')

    expect(result).toBe('opened')
    expect(opened.href).toBe('blob:report-preview')
    expect(opened.download).toBe('shift.pdf')
    expect(opened.target).toBe('_blank')
  })
})
