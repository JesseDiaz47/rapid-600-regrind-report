import { useEffect, useState } from 'react'

/**
 * Returns a ticking `Date.now()` value. Only runs the interval while `active`
 * is true so the app stays idle when no roll is in progress.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs])
  return now
}
