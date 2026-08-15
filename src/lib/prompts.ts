/**
 * Data-quality prompts. Surfaces completed runs that are missing values worth
 * back-filling. Missing amps are advisory (optional); missing weight/end time
 * mean the core throughput math cannot be computed.
 */
import type { MachineSettings, Run } from '../types/domain'

export interface DataPrompt {
  id: string
  runId: string
  message: string
}

export function collectDataPrompts(runs: Run[], _settings: MachineSettings): DataPrompt[] {
  void _settings
  const prompts: DataPrompt[] = []

  for (const run of runs) {
    const label = run.rollId ? `${run.materialType} ${run.rollId}` : run.materialType

    if (!run.active && run.endTime === null) {
      prompts.push({
        id: `${run.id}-end`,
        runId: run.id,
        message: `Add the end time for the ${label} run.`,
      })
    }
    if (run.inputWeight === null) {
      prompts.push({
        id: `${run.id}-weight`,
        runId: run.id,
        message: `Enter the input weight for the ${label} run.`,
      })
    }
    // Amps are optional — only prompt on otherwise-complete runs.
    if (!run.active && run.endTime !== null && run.inputWeight !== null && run.peakAmps === null) {
      prompts.push({
        id: `${run.id}-amps`,
        runId: run.id,
        message: `No peak amps recorded for the ${label} run.`,
      })
    }
  }

  return prompts
}
