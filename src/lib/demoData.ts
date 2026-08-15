/**
 * Clearly-labeled DEMO data. Every run carries `demo: true` so it can be wiped
 * in one action, and none of it represents real production records.
 */
import type { Run } from '../types/domain'
import { createId } from './id'

interface DemoSeed {
  materialType: Run['materialType']
  start: string
  end: string
  input: number
  output: number | null
  peak: number | null
  out: number | null
}

const SEEDS: DemoSeed[] = [
  { materialType: 'Smooth', start: '16:37', end: '16:54', input: 447, output: 411, peak: 121, out: 96 },
  { materialType: 'Micro', start: '16:55', end: '17:16', input: 433, output: 402, peak: 128, out: 101 },
  { materialType: 'Smooth', start: '17:22', end: '17:38', input: 452, output: null, peak: 124, out: null },
  { materialType: 'Micro', start: '17:40', end: '18:03', input: 478, output: 441, peak: 133, out: 104 },
  { materialType: 'MicroDrain', start: '18:10', end: '18:41', input: 512, output: 470, peak: 137, out: 112 },
]

export function buildDemoRuns(): Run[] {
  const now = Date.now()
  return SEEDS.map((seed, i) => ({
    id: createId('demo'),
    materialType: seed.materialType,
    rollId: null,
    startTime: seed.start,
    endTime: seed.end,
    inputWeight: seed.input,
    outputWeight: seed.output,
    peakAmps: seed.peak,
    runningOutAmps: seed.out,
    issues: [],
    notes: '',
    active: false,
    createdAt: now + i,
    updatedAt: now + i,
    demo: true,
    operatorName: null,
  }))
}
