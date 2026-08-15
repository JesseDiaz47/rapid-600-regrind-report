/**
 * Pure calculation helpers for regrind runs. Every function preserves missing
 * data: when a required input is absent or non-positive, the result is `null`
 * rather than a fabricated zero or full-yield value.
 */
import type {
  CalculatedRunMetrics,
  HeadroomStatus,
  MachineSettings,
  MaterialSummary,
  MaterialType,
  Run,
  ShiftTotals,
} from '../types/domain'
import { MATERIAL_TYPES } from '../types/domain'

const MINUTES_PER_DAY = 1440

/** Parse an "HH:MM" 24h string into minutes since midnight, or null. */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** Duration in minutes, adding a full day when the run crosses midnight. */
export function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const s = parseTimeToMinutes(start)
  const e = parseTimeToMinutes(end)
  if (s === null || e === null) return null
  let diff = e - s
  if (diff < 0) diff += MINUTES_PER_DAY
  return diff
}

/** Throughput in lb/hr from input weight and duration in minutes. */
export function throughput(weight: number | null, minutes: number | null): number | null {
  if (weight === null || minutes === null) return null
  if (weight <= 0 || minutes <= 0) return null
  return weight / (minutes / 60)
}

/** Yield percent: output as a share of input. Null when output is missing. */
export function yieldPercent(input: number | null, output: number | null): number | null {
  if (input === null || output === null) return null
  if (input <= 0) return null
  return (output / input) * 100
}

/** Amps drawn per 1,000 lb/hr of throughput. Null when either is missing. */
export function ampsPer1kRate(peakAmps: number | null, rate: number | null): number | null {
  if (peakAmps === null || rate === null) return null
  if (rate <= 0) return null
  return (peakAmps / rate) * 1000
}

export interface Headroom {
  toSafe: number | null
  toTrip: number | null
  status: HeadroomStatus
}

/** Headroom to the safe ceiling and trip threshold, with a semantic status. */
export function headroom(peakAmps: number | null, settings: MachineSettings): Headroom {
  if (peakAmps === null) {
    return { toSafe: null, toTrip: null, status: 'unknown' }
  }
  const toSafe = settings.safeAmps - peakAmps
  const toTrip = settings.tripAmps - peakAmps
  let status: HeadroomStatus = 'safe'
  if (peakAmps >= settings.tripAmps) status = 'trip'
  else if (peakAmps >= settings.safeAmps) status = 'near'
  return { toSafe, toTrip, status }
}

/** Recompute every metric for a run from its raw values. */
export function computeRunMetrics(run: Run, settings: MachineSettings): CalculatedRunMetrics {
  const duration = durationMinutes(run.startTime, run.endTime)
  const rate = throughput(run.inputWeight, duration)
  const h = headroom(run.peakAmps, settings)
  return {
    durationMinutes: duration,
    throughput: rate,
    yieldPercent: yieldPercent(run.inputWeight, run.outputWeight),
    ampsPer1kRate: ampsPer1kRate(run.peakAmps, rate),
    headroomToSafe: h.toSafe,
    headroomToTrip: h.toTrip,
    headroomStatus: h.status,
  }
}

/** A run counts toward shift/material aggregates once it is finished. */
export function isCompleted(run: Run): boolean {
  return !run.active && run.endTime !== null && run.inputWeight !== null
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Aggregate totals across all completed runs in the shift. */
export function shiftTotals(runs: Run[], settings: MachineSettings): ShiftTotals {
  const completed = runs.filter(isCompleted)
  let totalInputWeight = 0
  let totalOutputWeight = 0
  let totalMinutes = 0
  const rates: number[] = []
  const durations: number[] = []

  for (const run of completed) {
    const metrics = computeRunMetrics(run, settings)
    if (run.inputWeight !== null) totalInputWeight += run.inputWeight
    if (run.outputWeight !== null) totalOutputWeight += run.outputWeight
    if (metrics.durationMinutes !== null) {
      totalMinutes += metrics.durationMinutes
      durations.push(metrics.durationMinutes)
    }
    if (metrics.throughput !== null) rates.push(metrics.throughput)
  }

  return {
    rollCount: completed.length,
    totalInputWeight,
    totalOutputWeight,
    totalMinutes,
    avgThroughput: average(rates),
    avgDurationMinutes: average(durations),
  }
}

/** Per-material summaries over completed runs; materials with no runs omitted. */
export function materialSummaries(runs: Run[], settings: MachineSettings): MaterialSummary[] {
  const completed = runs.filter(isCompleted)
  const summaries: MaterialSummary[] = []

  for (const type of MATERIAL_TYPES) {
    const group = completed.filter((r) => r.materialType === type)
    if (group.length === 0) continue

    const rates: number[] = []
    const durations: number[] = []
    const amps: number[] = []
    const yields: number[] = []
    let totalInputWeight = 0

    for (const run of group) {
      const m = computeRunMetrics(run, settings)
      if (run.inputWeight !== null) totalInputWeight += run.inputWeight
      if (m.throughput !== null) rates.push(m.throughput)
      if (m.durationMinutes !== null) durations.push(m.durationMinutes)
      if (run.peakAmps !== null) amps.push(run.peakAmps)
      if (m.yieldPercent !== null) yields.push(m.yieldPercent)
    }

    summaries.push({
      type: type as MaterialType,
      count: group.length,
      totalInputWeight,
      avgDurationMinutes: average(durations),
      avgThroughput: average(rates),
      avgPeakAmps: average(amps),
      avgYieldPercent: average(yields),
    })
  }

  return summaries
}
