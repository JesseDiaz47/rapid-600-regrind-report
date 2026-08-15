/**
 * Race a promise against a deadline.
 *
 * Browser dialogs that the user never sees — a permission bar tucked at the
 * top of the window, a share sheet that fails to open — leave their promise
 * pending forever, stranding the UI on a busy state with no way back short of
 * a reload. Callers supply the error so each surface can explain its own
 * failure in its own words.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  makeError: () => Error,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(makeError()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
