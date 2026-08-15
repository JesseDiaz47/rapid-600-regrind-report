/** Generate a reasonably-unique id without pulling in a dependency. */
export function createId(prefix = 'run'): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}
