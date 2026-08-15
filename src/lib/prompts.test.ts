import { describe, it, expect } from 'vitest'
import { collectDataPrompts } from './prompts'
import type { MachineSettings, Run } from '../types/domain'

const settings: MachineSettings = { safeAmps: 130, tripAmps: 140, screenSize: '' }

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    materialType: 'Micro',
    rollId: null,
    startTime: '10:00',
    endTime: '11:00',
    inputWeight: 500,
    outputWeight: 400,
    peakAmps: 120,
    runningOutAmps: null,
    issues: [],
    notes: '',
    active: false,
    createdAt: 0,
    updatedAt: 0,
    operatorName: null,
    ...overrides,
  }
}

describe('collectDataPrompts', () => {
  it('returns no prompts when completed runs have full core data', () => {
    expect(collectDataPrompts([makeRun()], settings)).toEqual([])
  })

  it('flags a completed run missing its input weight', () => {
    const prompts = collectDataPrompts([makeRun({ inputWeight: null })], settings)
    expect(prompts.some((p) => p.message.toLowerCase().includes('weight'))).toBe(true)
  })

  it('flags a completed run missing its end time', () => {
    const prompts = collectDataPrompts([makeRun({ endTime: null })], settings)
    expect(prompts.some((p) => p.message.toLowerCase().includes('end time'))).toBe(true)
  })

  it('does not flag active runs for a missing end time', () => {
    const prompts = collectDataPrompts(
      [makeRun({ active: true, endTime: null })],
      settings,
    )
    expect(prompts).toEqual([])
  })

  it('flags a completed run with no amp reading', () => {
    const prompts = collectDataPrompts([makeRun({ peakAmps: null })], settings)
    expect(prompts.some((p) => p.message.toLowerCase().includes('amp'))).toBe(true)
  })
})
