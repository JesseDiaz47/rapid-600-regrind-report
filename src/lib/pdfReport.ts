import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import agruLogo from '../assets/agru-logo.png?inline'
import type { AppState, MaterialSummary, Run } from '../types/domain'
import { FIXED_VFD, ISSUE_FLAGS } from '../types/domain'
import {
  computeRunMetrics,
  isCompleted,
  materialSummaries,
  parseTimeToMinutes,
  shiftTotals,
} from './calculations'
import { DASH, fmtNum } from './format'

// Palette lifted from the AGRU photo-documentation report style.
const INK = '#071827' // header / footer bands
const PANEL = '#0b2436' // run-log table head
const CREAM = '#f3efe5' // page background
const CARD = '#ffffff'
const CYAN = '#39c4d8' // section ticks + header edge bar
const AMBER = '#f2a93b' // data-gaps / highlights label
const TEXT = '#102330' // primary ink on light surfaces
const MUTED = '#65727a'
const RULE = '#d9e2e6'
const ZEBRA = '#f2f7f9'
const BAND_MUTED = '#9fb0b9' // secondary text on navy

const PAGE_W = 792
const PAGE_H = 612
const MARGIN = 24
const EDGE_BAR_W = 7

const FOOTER_H = 44
const FOOTER_TOP = PAGE_H - FOOTER_H
const COMMENTS_H = 76
const COMMENTS_TOP = FOOTER_TOP - 8 - COMMENTS_H
const CONTENT_BOTTOM = COMMENTS_TOP - 8

const LOG_CARD_X = MARGIN
const LOG_CARD_W = 500
const SIDE_CARD_X = LOG_CARD_X + LOG_CARD_W + 12
const SIDE_CARD_W = PAGE_W - MARGIN - SIDE_CARD_X
const CARD_TOP = 150
const CARD_PAD = 12

const TABLE_X = LOG_CARD_X + 8
const TABLE_W = LOG_CARD_W - 16
const TABLE_START_Y = 174
const TABLE_TOP_LATER_PAGES = 108

function withUnit(value: number | null, unit: string, digits = 0): string {
  return value === null ? DASH : `${fmtNum(value, digits)} ${unit}`
}

function issueLabels(run: Run): string {
  return run.issues
    .map((id) => ISSUE_FLAGS.find((flag) => flag.id === id)?.label ?? id)
    .join(', ')
}

/** Small colored tick + letterspaced caps label that opens each section. */
function sectionLabel(doc: jsPDF, x: number, baselineY: number, text: string, tick = CYAN): void {
  doc.setFillColor(tick)
  doc.rect(x, baselineY - 8, 3, 9, 'F')
  doc.setTextColor(TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.2)
  doc.text(text, x + 8, baselineY, { charSpace: 0.7 })
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(RULE)
  doc.setLineWidth(0.6)
  doc.setFillColor(CARD)
  doc.roundedRect(x, y, w, h, 6, 6, 'FD')
}

/** Distinct, non-null operator names among a shift's completed runs. */
function shiftOperators(runs: Run[]): string {
  const names = Array.from(new Set(runs.flatMap((run) => (run.operatorName ? [run.operatorName] : []))))
  return names.length > 0 ? names.join(', ') : DASH
}

function drawHeader(doc: jsPDF, state: AppState, operators: string): void {
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_W, 60, 'F')
  doc.setFillColor(CYAN)
  doc.rect(0, 0, EDGE_BAR_W, 60, 'F')

  doc.setTextColor(CYAN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('RAPID 600 · FERNLEY REGRIND OPERATIONS', MARGIN, 19, { charSpace: 1 })

  doc.setTextColor('#FFFFFF')
  doc.setFontSize(18)
  doc.text(`SHIFT REPORT — ${state.shiftDate}`, MARGIN, 38)

  doc.setTextColor(BAND_MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    `Fixed VFD ${FIXED_VFD} · Screen ${state.settings.screenSize || DASH} · Safe ${state.settings.safeAmps} A · Trip ${state.settings.tripAmps} A`,
    MARGIN,
    50,
  )

  // Logo chip, white like the photo-doc header.
  const chipW = 84
  const chipX = PAGE_W - MARGIN - chipW
  doc.setFillColor(CARD)
  doc.roundedRect(chipX, 9, chipW, 26, 5, 5, 'F')
  doc.addImage(agruLogo, 'PNG', chipX + 10, 14.5, 64, 14.8)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  const nameW = doc.getTextWidth(operators)
  doc.setTextColor('#FFFFFF')
  doc.text(operators, PAGE_W - MARGIN, 45, { align: 'right' })
  doc.setTextColor(BAND_MUTED)
  doc.setFontSize(6)
  doc.text('OPERATORS', PAGE_W - MARGIN - nameW - 10, 45, { align: 'right', charSpace: 0.5 })
  doc.setFont('helvetica', 'normal')
  doc.text('Shift production record', PAGE_W - MARGIN, 54, { align: 'right' })
}

function drawContinuationHeader(doc: jsPDF, state: AppState): void {
  doc.setFillColor(CREAM)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_W, 34, 'F')
  doc.setFillColor(CYAN)
  doc.rect(0, 0, EDGE_BAR_W, 34, 'F')
  doc.setTextColor('#FFFFFF')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`SHIFT REPORT — ${state.shiftDate}`, MARGIN, 22)
  doc.setTextColor(BAND_MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Run log · continued', PAGE_W - MARGIN, 22, { align: 'right' })

  card(doc, LOG_CARD_X, 84, LOG_CARD_W, CONTENT_BOTTOM - 84)
  sectionLabel(doc, LOG_CARD_X + CARD_PAD, 100, 'COMPLETE RUN LOG · CONTINUED')
}

function drawPulseTiles(
  doc: jsPDF,
  tiles: Array<{ label: string; value: string; unit: string }>,
): void {
  sectionLabel(doc, MARGIN, 76, 'SHIFT PULSE')
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('All metrics recomputed from raw inputs · “—” was not recorded', PAGE_W - MARGIN, 76, {
    align: 'right',
  })

  const gap = 10
  const tileW = (PAGE_W - MARGIN * 2 - gap * (tiles.length - 1)) / tiles.length
  const tileY = 84
  const tileH = 54
  tiles.forEach((tile, i) => {
    const x = MARGIN + i * (tileW + gap)
    card(doc, x, tileY, tileW, tileH)
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.9)
    doc.text(tile.label.toUpperCase(), x + 10, tileY + 15, { charSpace: 0.6 })
    const isDash = tile.value === DASH
    doc.setTextColor(isDash ? MUTED : TEXT)
    doc.setFontSize(17)
    doc.text(tile.value, x + 10, tileY + 38)
    if (!isDash && tile.unit) {
      const valueW = doc.getTextWidth(tile.value)
      doc.setTextColor(MUTED)
      doc.setFontSize(7.5)
      doc.text(tile.unit, x + 10 + valueW + 3, tileY + 38)
    }
  })
}

interface InsightsData {
  summaries: MaterialSummary[]
  maxPeak: number | null
  minHeadroom: number | null
  latest: Run | null
  latestThroughput: number | null
  shiftNotes: string
  missingOutput: number
  missingPeak: number
}

function drawInsights(doc: jsPDF, state: AppState, data: InsightsData): void {
  card(doc, SIDE_CARD_X, CARD_TOP, SIDE_CARD_W, CONTENT_BOTTOM - CARD_TOP)
  const x = SIDE_CARD_X + CARD_PAD
  const w = SIDE_CARD_W - CARD_PAD * 2
  const right = SIDE_CARD_X + SIDE_CARD_W - CARD_PAD
  const gapsY = CONTENT_BOTTOM - 14
  const maxY = gapsY - 16
  let y = CARD_TOP + 16

  sectionLabel(doc, x, y, 'MATERIAL INSIGHTS')
  y += 15
  if (data.summaries.length === 0) {
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('No completed runs recorded for this shift.', x, y)
    y += 15
  }
  for (const summary of data.summaries) {
    if (y + 24 > maxY) break
    doc.setTextColor(TEXT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(summary.type, x, y)
    doc.text(withUnit(summary.avgThroughput, 'lb/hr'), right, y, { align: 'right' })
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.4)
    const yieldText =
      summary.avgYieldPercent === null ? DASH : `${fmtNum(summary.avgYieldPercent, 1)}%`
    doc.text(
      `${summary.count} ${summary.count === 1 ? 'run' : 'runs'} · ${withUnit(summary.avgDurationMinutes, 'min')} · ${withUnit(summary.avgPeakAmps, 'A', 1)} peak · ${yieldText} yield · ${withUnit(summary.totalInputWeight, 'lb')} in`,
      x,
      y + 9,
    )
    y += 16
    if (summary !== data.summaries.at(-1)) {
      doc.setDrawColor(RULE)
      doc.setLineWidth(0.4)
      doc.line(x, y, x + w, y)
      y += 10
    } else {
      y += 7
    }
  }

  const ampRows: Array<{ label: string; value: string; warm: boolean }> = [
    {
      label: 'Highest peak',
      value: withUnit(data.maxPeak, 'A'),
      warm: data.maxPeak !== null && data.maxPeak >= state.settings.safeAmps,
    },
    {
      label: 'Closest trip headroom',
      value: withUnit(data.minHeadroom, 'A'),
      warm:
        data.minHeadroom !== null &&
        state.settings.tripAmps - data.minHeadroom >= state.settings.safeAmps,
    },
    {
      label: 'Safe / trip setting',
      value: `${state.settings.safeAmps} / ${state.settings.tripAmps} A`,
      warm: false,
    },
  ]
  if (y + 15 + ampRows.length * 12 <= maxY) {
    y += 4
    sectionLabel(doc, x, y, 'AMP WATCH')
    y += 13
    for (const row of ampRows) {
      doc.setTextColor(MUTED)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.text(row.label, x, y)
      doc.setTextColor(row.warm ? AMBER : TEXT)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.4)
      doc.text(row.value, right, y, { align: 'right' })
      y += 12
    }
  }

  if (data.latest && y + 32 <= maxY) {
    y += 6
    sectionLabel(doc, x, y, 'LATEST COMPLETED RUN')
    y += 13
    doc.setTextColor(TEXT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.6)
    doc.text(
      `${data.latest.materialType} · ${data.latest.startTime}–${data.latest.endTime ?? DASH}`,
      x,
      y,
    )
    y += 10
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text(
      `${withUnit(data.latest.inputWeight, 'lb')} in · ${withUnit(data.latest.outputWeight, 'lb')} out · ${withUnit(data.latestThroughput, 'lb/hr')}`,
      x,
      y,
    )
    y += 9
  }

  if (data.shiftNotes && y + 26 <= maxY) {
    y += 6
    sectionLabel(doc, x, y, 'SHIFT NOTES')
    y += 12
    doc.setTextColor(MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const lines: string[] = doc.splitTextToSize(data.shiftNotes, w)
    const maxLines = Math.max(1, Math.floor((maxY - y) / 9))
    const shown = lines.slice(0, maxLines)
    if (lines.length > maxLines) shown[shown.length - 1] = `${shown[shown.length - 1]} …`
    shown.forEach((line, i) => doc.text(line, x, y + i * 9))
  }

  // Data gaps — anchored to the card bottom, amber-labeled like the photo doc.
  doc.setDrawColor(RULE)
  doc.setLineWidth(0.4)
  doc.line(x, gapsY - 10, x + w, gapsY - 10)
  sectionLabel(doc, x, gapsY, 'DATA GAPS', AMBER)
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  const gaps =
    data.summaries.length === 0
      ? DASH
      : data.missingOutput === 0 && data.missingPeak === 0
        ? 'None — every run fully recorded'
        : `${data.missingOutput} output · ${data.missingPeak} peak amps not recorded`
  doc.text(gaps, right, gapsY, { align: 'right' })
}

/** Ruled write-in comments card, drawn on the report's last page. */
function drawCommentsCard(doc: jsPDF): void {
  card(doc, MARGIN, COMMENTS_TOP, PAGE_W - MARGIN * 2, COMMENTS_H)
  sectionLabel(doc, MARGIN + CARD_PAD, COMMENTS_TOP + 16, 'COMMENTS')
  doc.setTextColor(MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Follow-ups for the next shift', PAGE_W - MARGIN - CARD_PAD, COMMENTS_TOP + 16, {
    align: 'right',
  })
  doc.setDrawColor(RULE)
  doc.setLineWidth(0.5)
  for (let i = 0; i < 3; i += 1) {
    const lineY = COMMENTS_TOP + 33 + i * 16
    doc.line(MARGIN + CARD_PAD, lineY, PAGE_W - MARGIN - CARD_PAD, lineY)
  }
}

function drawFooters(doc: jsPDF, state: AppState, highlight: string): void {
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFillColor(INK)
    doc.rect(0, FOOTER_TOP, PAGE_W, FOOTER_H, 'F')
    doc.setFillColor(AMBER)
    doc.rect(0, FOOTER_TOP, EDGE_BAR_W, FOOTER_H, 'F')

    doc.setTextColor(AMBER)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text('SHIFT HIGHLIGHTS', MARGIN, FOOTER_TOP + 17, { charSpace: 0.8 })
    doc.setTextColor('#FFFFFF')
    doc.setFontSize(7.8)
    doc.text(highlight, MARGIN, FOOTER_TOP + 31)

    doc.setTextColor(BAND_MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.2)
    doc.text(
      'OPERATIONAL RECORD · LOGGING & REFERENCE ONLY · NOT MACHINE CONTROL',
      PAGE_W - MARGIN,
      FOOTER_TOP + 17,
      { align: 'right' },
    )
    doc.text(
      `Rapid 600 Regrind Report · Shift ${state.shiftDate} · Page ${page} of ${pageCount}`,
      PAGE_W - MARGIN,
      FOOTER_TOP + 31,
      { align: 'right' },
    )
  }
}

/**
 * Completed runs in chronological clock order, so a roll entered late still
 * lands in its proper slot in the log; entry order only breaks ties.
 */
export function sortRunsForReport(runs: Run[]): Run[] {
  return [...runs].filter(isCompleted).sort((a, b) => {
    const aStart = parseTimeToMinutes(a.startTime)
    const bStart = parseTimeToMinutes(b.startTime)
    if (aStart !== null && bStart !== null && aStart !== bStart) return aStart - bStart
    return a.createdAt - b.createdAt
  })
}

/**
 * Build the shift report PDF: landscape Letter, pulse tiles + run log +
 * insights on page one, the log flowing onto continuation pages when long.
 */
export function buildShiftReportPdf(state: AppState): Blob {
  const runs = sortRunsForReport(state.runs)
  const totals = shiftTotals(runs, state.settings)
  const summaries = materialSummaries(runs, state.settings)
  const latest = runs.at(-1) ?? null
  const latestMetrics = latest ? computeRunMetrics(latest, state.settings) : null
  const recordedOutputs = runs.filter((run) => run.outputWeight !== null)
  const peaks = runs.flatMap((run) => (run.peakAmps === null ? [] : [run.peakAmps]))
  const maxPeak = peaks.length > 0 ? Math.max(...peaks) : null
  const minHeadroom =
    peaks.length > 0 ? Math.min(...peaks.map((peak) => state.settings.tripAmps - peak)) : null
  const topMaterial = [...summaries]
    .filter((summary) => summary.avgThroughput !== null)
    .sort((a, b) => (b.avgThroughput ?? 0) - (a.avgThroughput ?? 0))[0]
  const missingOutput = runs.filter((run) => run.outputWeight === null).length
  const missingPeak = runs.filter((run) => run.peakAmps === null).length
  const operators = shiftOperators(runs)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter', compress: true })

  doc.setFillColor(CREAM)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  drawHeader(doc, state, operators)

  drawPulseTiles(doc, [
    { label: 'Input weight', value: fmtNum(totals.totalInputWeight), unit: 'lb' },
    {
      label: 'Recorded output',
      value: recordedOutputs.length === 0 ? DASH : fmtNum(totals.totalOutputWeight),
      unit: 'lb',
    },
    { label: 'Average rate', value: fmtNum(totals.avgThroughput), unit: 'lb/hr' },
    { label: 'Avg roll time', value: fmtNum(totals.avgDurationMinutes), unit: 'min' },
    { label: 'Rolls', value: String(totals.rollCount), unit: 'completed' },
    { label: 'Highest peak', value: fmtNum(maxPeak), unit: 'A' },
  ])

  card(doc, LOG_CARD_X, CARD_TOP, LOG_CARD_W, CONTENT_BOTTOM - CARD_TOP)
  sectionLabel(doc, LOG_CARD_X + CARD_PAD, CARD_TOP + 16, 'COMPLETE RUN LOG')

  const head = [
    ['#', 'Op', 'Material', 'Roll', 'Start', 'End', 'Min', 'In lb', 'Out lb', 'Yield', 'lb/hr', 'Peak A', 'Out A', 'A/1k', 'Head A', 'Issues / notes'],
  ]
  const body: Array<Array<string | { content: string; colSpan: number; styles: object }>> =
    runs.map((run, index) => {
      const metrics = computeRunMetrics(run, state.settings)
      const remarks = [issueLabels(run), run.notes].filter(Boolean).join(' — ')
      return [
        String(index + 1),
        run.operatorName ?? DASH,
        run.materialType,
        run.rollId ?? DASH,
        run.startTime,
        run.endTime ?? DASH,
        fmtNum(metrics.durationMinutes),
        fmtNum(run.inputWeight),
        fmtNum(run.outputWeight),
        metrics.yieldPercent === null ? DASH : `${fmtNum(metrics.yieldPercent, 1)}%`,
        fmtNum(metrics.throughput),
        fmtNum(run.peakAmps),
        fmtNum(run.runningOutAmps),
        fmtNum(metrics.ampsPer1kRate, 1),
        fmtNum(metrics.headroomToTrip),
        remarks || DASH,
      ]
    })
  if (runs.length === 0) {
    body.push([
      {
        content: 'No completed runs recorded for this shift.',
        colSpan: 16,
        styles: { halign: 'center', textColor: MUTED, fontStyle: 'italic', minCellHeight: 22 },
      },
    ])
  }

  const columnStyles: Record<number, { cellWidth: number; halign?: 'right' | 'center' | 'left' }> = {
    0: { cellWidth: 14, halign: 'right' },
    1: { cellWidth: 38 },
    2: { cellWidth: 44 },
    3: { cellWidth: 28 },
    4: { cellWidth: 23, halign: 'center' },
    5: { cellWidth: 23, halign: 'center' },
    6: { cellWidth: 18, halign: 'right' },
    7: { cellWidth: 26, halign: 'right' },
    8: { cellWidth: 26, halign: 'right' },
    9: { cellWidth: 24, halign: 'right' },
    10: { cellWidth: 24, halign: 'right' },
    11: { cellWidth: 24, halign: 'right' },
    12: { cellWidth: 23, halign: 'right' },
    13: { cellWidth: 22, halign: 'right' },
    14: { cellWidth: 25, halign: 'right' },
    15: { cellWidth: 102 },
  }

  autoTable(doc, {
    startY: TABLE_START_Y,
    margin: {
      top: TABLE_TOP_LATER_PAGES,
      bottom: PAGE_H - CONTENT_BOTTOM + 8,
      left: TABLE_X,
      right: PAGE_W - TABLE_X - TABLE_W,
    },
    head,
    body,
    theme: 'plain',
    showHead: 'everyPage',
    headStyles: {
      fillColor: PANEL,
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      fontSize: 6.6,
      cellPadding: 3,
    },
    styles: {
      fontSize: 7.6,
      cellPadding: 3,
      overflow: 'linebreak',
      textColor: TEXT,
      valign: 'top',
      minCellHeight: 13,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    bodyStyles: { fillColor: CARD },
    columnStyles,
    tableWidth: TABLE_W,
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawContinuationHeader(doc, state)
    },
  })

  doc.setPage(doc.getNumberOfPages())
  drawCommentsCard(doc)

  doc.setPage(1)
  drawInsights(doc, state, {
    summaries,
    maxPeak,
    minHeadroom,
    latest,
    latestThroughput: latestMetrics?.throughput ?? null,
    shiftNotes: state.shiftNotes,
    missingOutput,
    missingPeak,
  })

  const highlight =
    runs.length === 0
      ? 'No completed runs recorded for this shift.'
      : `Top material ${topMaterial ? `${topMaterial.type} · ${withUnit(topMaterial.avgThroughput, 'lb/hr')}` : DASH}   ·   Highest peak ${withUnit(maxPeak, 'A')}   ·   Closest trip headroom ${withUnit(minHeadroom, 'A')}`
  drawFooters(doc, state, highlight)

  return doc.output('blob')
}

export type PdfDelivery = 'shared' | 'opened'

/** Share the PDF natively where supported; otherwise open/download a preview. */
export async function openOrSharePdf(blob: Blob, filename: string): Promise<PdfDelivery> {
  const file = new File([blob], filename, { type: 'application/pdf' })
  const shareData = { title: 'Rapid 600 Regrind Report', files: [file] }
  if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
    await navigator.share(shareData)
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.target = '_blank'
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'opened'
}

export function pdfFilename(state: AppState): string {
  return `rapid-600-regrind-report-${state.shiftDate}.pdf`
}
