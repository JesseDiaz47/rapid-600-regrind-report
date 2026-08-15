import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AppState,
  MachineSettings,
  MaterialProfile,
  MaterialType,
  Run,
} from '../types/domain'
import { loadState, saveState } from '../lib/storage'
import { defaultState } from '../lib/storage'
import { createId } from '../lib/id'
import { buildDemoRuns } from '../lib/demoData'
import { nowTimeString } from '../lib/format'

export interface StartRollInput {
  materialType: MaterialType
  rollId: string | null
  startTime: string
  inputWeight: number | null
  notes: string
  operatorName: string | null
}

export interface FinishRollInput {
  endTime: string
  peakAmps: number | null
  runningOutAmps: number | null
  outputWeight: number | null
  issues: Run['issues']
  notes: string
}

/** Full editable run payload used by manual entry and edit. */
export type RunDraft = Omit<Run, 'id' | 'createdAt' | 'updatedAt' | 'active' | 'demo'> & {
  id?: string
}

export interface AppActions {
  startRoll: (input: StartRollInput) => void
  finishRoll: (id: string, input: FinishRollInput) => void
  saveManualRun: (draft: RunDraft) => void
  deleteRun: (id: string) => void
  undoDelete: () => void
  duplicateRun: (id: string) => void
  updateSettings: (patch: Partial<MachineSettings>) => void
  updateProfile: (type: MaterialType, patch: Partial<MaterialProfile>) => void
  setShiftNotes: (notes: string) => void
  newShift: () => void
  clearAll: () => void
  seedDemo: () => void
  clearDemo: () => void
  restore: (state: AppState) => void
}

export interface UseAppState {
  state: AppState
  activeRun: Run | null
  canUndo: boolean
  hasDemo: boolean
  actions: AppActions
}

export function useAppState(): UseAppState {
  const [state, setState] = useState<AppState>(() => loadState())
  const lastDeleted = useRef<Run | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    saveState(state)
  }, [state])

  const activeRun = useMemo(
    () => state.runs.find((r) => r.active) ?? null,
    [state.runs],
  )

  const hasDemo = useMemo(() => state.runs.some((r) => r.demo), [state.runs])

  const startRoll = useCallback((input: StartRollInput) => {
    // Enforce a single active run inside the state updater so that rapid or
    // double invocations both observe the latest runs and the second is a
    // no-op rather than creating a second concurrent run.
    setState((s) => {
      if (s.runs.some((r) => r.active)) return s
      const now = Date.now()
      const run: Run = {
        id: createId(),
        materialType: input.materialType,
        rollId: input.rollId,
        startTime: input.startTime || nowTimeString(),
        endTime: null,
        inputWeight: input.inputWeight,
        outputWeight: null,
        peakAmps: null,
        runningOutAmps: null,
        issues: [],
        notes: input.notes,
        active: true,
        createdAt: now,
        updatedAt: now,
        operatorName: input.operatorName,
      }
      return { ...s, runs: [...s.runs, run] }
    })
  }, [])

  const finishRoll = useCallback((id: string, input: FinishRollInput) => {
    setState((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        r.id === id
          ? {
              ...r,
              active: false,
              endTime: input.endTime || nowTimeString(),
              peakAmps: input.peakAmps,
              runningOutAmps: input.runningOutAmps,
              outputWeight: input.outputWeight,
              issues: input.issues,
              notes: input.notes || r.notes,
              updatedAt: Date.now(),
            }
          : r,
      ),
    }))
  }, [])

  const saveManualRun = useCallback((draft: RunDraft) => {
    setState((s) => {
      const now = Date.now()
      if (draft.id && s.runs.some((r) => r.id === draft.id)) {
        return {
          ...s,
          runs: s.runs.map((r) =>
            r.id === draft.id
              ? { ...r, ...draft, active: false, updatedAt: now }
              : r,
          ),
        }
      }
      const run: Run = {
        ...draft,
        id: draft.id ?? createId(),
        active: false,
        createdAt: now,
        updatedAt: now,
      }
      return { ...s, runs: [...s.runs, run] }
    })
  }, [])

  const deleteRun = useCallback((id: string) => {
    setState((s) => {
      const target = s.runs.find((r) => r.id === id)
      if (target) {
        lastDeleted.current = target
        setCanUndo(true)
      }
      return { ...s, runs: s.runs.filter((r) => r.id !== id) }
    })
  }, [])

  const undoDelete = useCallback(() => {
    const restored = lastDeleted.current
    if (!restored) return
    lastDeleted.current = null
    setCanUndo(false)
    setState((s) => {
      // Re-insert preserving chronological order by createdAt.
      const runs = [...s.runs, restored].sort((a, b) => a.createdAt - b.createdAt)
      return { ...s, runs }
    })
  }, [])

  const duplicateRun = useCallback((id: string) => {
    setState((s) => {
      const source = s.runs.find((r) => r.id === id)
      if (!source) return s
      const now = Date.now()
      const copy: Run = {
        ...source,
        id: createId(),
        active: false,
        createdAt: now,
        updatedAt: now,
        demo: undefined,
      }
      return { ...s, runs: [...s.runs, copy] }
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<MachineSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const updateProfile = useCallback(
    (type: MaterialType, patch: Partial<MaterialProfile>) => {
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.type === type ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const setShiftNotes = useCallback((notes: string) => {
    setState((s) => ({ ...s, shiftNotes: notes }))
  }, [])

  const newShift = useCallback(() => {
    setState((s) => ({
      ...s,
      runs: [],
      shiftNotes: '',
      shiftDate: new Date().toLocaleDateString('en-CA'),
    }))
    lastDeleted.current = null
    setCanUndo(false)
  }, [])

  const clearAll = useCallback(() => {
    setState(defaultState())
    lastDeleted.current = null
    setCanUndo(false)
  }, [])

  const seedDemo = useCallback(() => {
    setState((s) => ({ ...s, runs: [...buildDemoRuns(), ...s.runs] }))
  }, [])

  const clearDemo = useCallback(() => {
    setState((s) => ({ ...s, runs: s.runs.filter((r) => !r.demo) }))
  }, [])

  const restore = useCallback((next: AppState) => {
    setState(next)
    lastDeleted.current = null
    setCanUndo(false)
  }, [])

  const actions: AppActions = useMemo(
    () => ({
      startRoll,
      finishRoll,
      saveManualRun,
      deleteRun,
      undoDelete,
      duplicateRun,
      updateSettings,
      updateProfile,
      setShiftNotes,
      newShift,
      clearAll,
      seedDemo,
      clearDemo,
      restore,
    }),
    [
      startRoll,
      finishRoll,
      saveManualRun,
      deleteRun,
      undoDelete,
      duplicateRun,
      updateSettings,
      updateProfile,
      setShiftNotes,
      newShift,
      clearAll,
      seedDemo,
      clearDemo,
      restore,
    ],
  )

  return { state, activeRun, canUndo, hasDemo, actions }
}
