/**
 * Persisted "Reports folder" — a folder the user picks once via the File
 * System Access API (Chromium only). The folder handle is stored in
 * IndexedDB (the only browser storage that can hold a FileSystemHandle) so
 * every future save/export writes straight into it without a picker dialog
 * on later visits. Unsupported browsers (Safari, iOS) fall back to normal
 * downloads elsewhere in the app — nothing here is required for it to work.
 *
 * No data leaves the device: this only writes to a folder already local to
 * the machine the browser is running on.
 */

const DB_NAME = 'rapid-600-fs'
const STORE = 'handles'
const HANDLE_KEY = 'reportsFolder'

/**
 * The installed TypeScript DOM lib doesn't yet type the permission methods
 * on FileSystemHandle, though they're implemented in every browser that
 * supports showDirectoryPicker. Widen locally rather than casting at every
 * call site.
 */
type PermissionedHandle = FileSystemDirectoryHandle & {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

/**
 * Some Chromium builds show a second, easy-to-miss permission prompt (a bar
 * near the top of the window, separate from the OS folder dialog) before a
 * showDirectoryPicker()/requestPermission() promise resolves. If the user
 * doesn't notice it, the promise hangs forever with no way to recover short
 * of reloading the page. Race it against a timeout so the caller can surface
 * that explicitly instead of leaving the UI stuck on "Working…".
 */
export class ReportsFolderTimeoutError extends Error {
  constructor() {
    super('Timed out waiting on a browser permission prompt.')
    this.name = 'ReportsFolderTimeoutError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ReportsFolderTimeoutError()), ms)
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

const PROMPT_TIMEOUT_MS = 45_000

export function supportsReportsFolder(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { showDirectoryPicker?: unknown }
  return typeof w.showDirectoryPicker === 'function'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function storedHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY)) ?? null
  } catch {
    return null
  }
}

/** Ask the user to pick a folder and remember it for future sessions. */
export async function chooseReportsFolder(): Promise<FileSystemDirectoryHandle> {
  const w = window as unknown as {
    showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }
  const handle = await withTimeout(w.showDirectoryPicker({ mode: 'readwrite' }), PROMPT_TIMEOUT_MS)
  await idbSet(HANDLE_KEY, handle)
  return handle
}

/** Forget the stored folder so the next save prompts for a new one. */
export async function forgetReportsFolder(): Promise<void> {
  await idbDelete(HANDLE_KEY)
}

/**
 * The stored folder if one is set and permission is already granted — no
 * prompt. Returns null if none is stored, or permission needs reconfirming;
 * callers should surface a "Reconnect folder" action rather than silently
 * retrying, since requestPermission needs a user gesture.
 */
export async function getGrantedReportsFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = (await storedHandle()) as PermissionedHandle | null
  if (!handle) return null
  const perm = await handle.queryPermission({ mode: 'readwrite' })
  return perm === 'granted' ? handle : null
}

/** Info about the stored folder for display, even if permission has lapsed. */
export async function reportsFolderInfo(): Promise<{ name: string; granted: boolean } | null> {
  const handle = (await storedHandle()) as PermissionedHandle | null
  if (!handle) return null
  const perm = await handle.queryPermission({ mode: 'readwrite' })
  return { name: handle.name, granted: perm === 'granted' }
}

/** Re-request permission on the stored folder. Must run from a user gesture (a click handler). */
export async function reconnectReportsFolder(): Promise<FileSystemDirectoryHandle | null> {
  const handle = (await storedHandle()) as PermissionedHandle | null
  if (!handle) return null
  const perm = await withTimeout(handle.requestPermission({ mode: 'readwrite' }), PROMPT_TIMEOUT_MS)
  return perm === 'granted' ? handle : null
}

/**
 * Write (create or overwrite) a file directly into a folder handle. Accepts
 * a string for text formats (JSON/CSV) or a Blob for binary ones (PDF) —
 * routing binary content through a string would corrupt it.
 */
export async function writeFile(
  folder: FileSystemDirectoryHandle,
  filename: string,
  contents: string | Blob,
  mime: string,
): Promise<number> {
  const blob = typeof contents === 'string' ? new Blob([contents], { type: mime }) : contents
  const fileHandle = await folder.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    await writable.write(blob)
  } finally {
    await writable.close()
  }
  return blob.size
}
