import { useEffect, useState } from 'react'

/**
 * Quiet Mode preference. When on (or when the OS requests reduced motion) the
 * app disables the breathing geometry animation and glow. Persisted separately
 * from shift data so it survives a New Shift / Clear All.
 */
const QUIET_KEY = 'regrind-vfd-quiet-mode'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function useQuietMode(): {
  quiet: boolean
  setQuiet: (value: boolean) => void
} {
  const [quiet, setQuietState] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(QUIET_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const reduced = prefersReducedMotion()
    const motionOff = quiet || reduced
    document.documentElement.setAttribute('data-motion', motionOff ? 'reduced' : 'full')
  }, [quiet])

  const setQuiet = (value: boolean) => {
    setQuietState(value)
    try {
      window.localStorage.setItem(QUIET_KEY, String(value))
    } catch {
      /* ignore */
    }
  }

  return { quiet, setQuiet }
}
