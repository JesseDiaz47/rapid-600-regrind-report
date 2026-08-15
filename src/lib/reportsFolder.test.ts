import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  chooseReportsFolder,
  forgetReportsFolder,
  getGrantedReportsFolder,
  reconnectReportsFolder,
  reportsFolderInfo,
  supportsReportsFolder,
  writeFile,
} from './reportsFolder'

/**
 * jsdom has no IndexedDB and no File System Access API. This fakes just
 * enough of both — a Map-backed object store behind the real request/event
 * shape, and a directory-handle stub with the methods reportsFolder.ts
 * actually calls — to exercise the module's own control flow (permission
 * branching, persistence, filename handling) without depending on a real
 * browser's structured-clone engine, which a hand-rolled fake handle with
 * methods couldn't survive anyway.
 */
function installFakeIndexedDb() {
  const store = new Map<string, unknown>()

  function makeRequest<T>(run: () => T) {
    const req: {
      result?: T
      error?: unknown
      onsuccess: (() => void) | null
      onerror: (() => void) | null
    } = { onsuccess: null, onerror: null }
    queueMicrotask(() => {
      try {
        req.result = run()
        req.onsuccess?.()
      } catch (error) {
        req.error = error
        req.onerror?.()
      }
    })
    return req
  }

  const objectStore = {
    get: (key: string) => makeRequest(() => store.get(key)),
    put: (value: unknown, key: string) => makeRequest(() => void store.set(key, value)),
    delete: (key: string) => makeRequest(() => void store.delete(key)),
  }

  const db = {
    createObjectStore: () => objectStore,
    transaction: () => {
      // Must return the same object the caller mutates (`tx.oncomplete = …`)
      // — spreading it into a new object here would schedule the microtask
      // against a stale copy whose oncomplete never gets set.
      const tx: {
        objectStore: () => typeof objectStore
        oncomplete: (() => void) | null
        onerror: (() => void) | null
      } = { objectStore: () => objectStore, oncomplete: null, onerror: null }
      queueMicrotask(() => tx.oncomplete?.())
      return tx
    },
  }

  const fakeIndexedDb = {
    open: () => {
      const req: {
        result: typeof db
        onupgradeneeded: (() => void) | null
        onsuccess: (() => void) | null
        onerror: (() => void) | null
      } = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null }
      queueMicrotask(() => {
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }

  vi.stubGlobal('indexedDB', fakeIndexedDb)
  return store
}

function fakeDirectoryHandle(name: string, granted = true) {
  let permission = granted ? 'granted' : 'prompt'
  const files = new Map<string, { blob: Blob }>()
  return {
    name,
    kind: 'directory' as const,
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => {
      permission = 'granted'
      return permission
    }),
    getFileHandle: vi.fn(async (filename: string) => ({
      createWritable: async () => ({
        write: async (blob: Blob) => {
          files.set(filename, { blob })
        },
        close: async () => {},
      }),
    })),
    _files: files,
  }
}

describe('supportsReportsFolder', () => {
  afterEach(() => {
    const w = window as unknown as { showDirectoryPicker?: unknown }
    delete w.showDirectoryPicker
  })

  it('returns false in a jsdom test environment without showDirectoryPicker', () => {
    expect(supportsReportsFolder()).toBe(false)
  })

  it('returns true when showDirectoryPicker is exposed on window', () => {
    const w = window as unknown as { showDirectoryPicker: unknown }
    w.showDirectoryPicker = () => Promise.resolve({})
    expect(supportsReportsFolder()).toBe(true)
  })
})

describe('reports folder persistence', () => {
  beforeEach(() => installFakeIndexedDb())
  afterEach(() => {
    vi.unstubAllGlobals()
    const w = window as unknown as { showDirectoryPicker?: unknown }
    delete w.showDirectoryPicker
  })

  it('has nothing stored initially', async () => {
    expect(await getGrantedReportsFolder()).toBeNull()
    expect(await reportsFolderInfo()).toBeNull()
  })

  it('stores the picked folder and returns it while permission is granted', async () => {
    const handle = fakeDirectoryHandle('Rapid 600 Regrind Reports')
    const w = window as unknown as { showDirectoryPicker: () => Promise<unknown> }
    w.showDirectoryPicker = vi.fn(async () => handle)

    const chosen = await chooseReportsFolder()
    expect(chosen).toBe(handle)
    expect(await getGrantedReportsFolder()).toBe(handle)
    expect(await reportsFolderInfo()).toEqual({ name: 'Rapid 600 Regrind Reports', granted: true })
  })

  it('withholds the folder from getGrantedReportsFolder when permission has lapsed, but still reports it', async () => {
    const handle = fakeDirectoryHandle('Old Folder', false)
    const w = window as unknown as { showDirectoryPicker: () => Promise<unknown> }
    w.showDirectoryPicker = vi.fn(async () => handle)
    await chooseReportsFolder()

    expect(await getGrantedReportsFolder()).toBeNull()
    expect(await reportsFolderInfo()).toEqual({ name: 'Old Folder', granted: false })
  })

  it('reconnectReportsFolder re-requests permission and restores access', async () => {
    const handle = fakeDirectoryHandle('Old Folder', false)
    const w = window as unknown as { showDirectoryPicker: () => Promise<unknown> }
    w.showDirectoryPicker = vi.fn(async () => handle)
    await chooseReportsFolder()

    const reconnected = await reconnectReportsFolder()
    expect(reconnected).toBe(handle)
    expect(await getGrantedReportsFolder()).toBe(handle)
  })

  it('forgetReportsFolder clears the stored handle', async () => {
    const handle = fakeDirectoryHandle('Rapid 600 Regrind Reports')
    const w = window as unknown as { showDirectoryPicker: () => Promise<unknown> }
    w.showDirectoryPicker = vi.fn(async () => handle)
    await chooseReportsFolder()

    await forgetReportsFolder()
    expect(await getGrantedReportsFolder()).toBeNull()
    expect(await reportsFolderInfo()).toBeNull()
  })
})

describe('writeFile', () => {
  it('writes string content wrapped in a Blob of the given mime type and returns its size', async () => {
    const handle = fakeDirectoryHandle('Reports')
    const bytes = await writeFile(
      handle as unknown as FileSystemDirectoryHandle,
      'rapid-600-roster.json',
      '{"a":1}',
      'application/json',
    )
    expect(bytes).toBe(new Blob(['{"a":1}']).size)
    expect(handle.getFileHandle).toHaveBeenCalledWith('rapid-600-roster.json', { create: true })
    expect(handle._files.get('rapid-600-roster.json')?.blob.type).toBe('application/json')
  })

  it('writes a Blob directly without re-encoding it (binary-safe for PDFs)', async () => {
    const handle = fakeDirectoryHandle('Reports')
    const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })
    const bytes = await writeFile(
      handle as unknown as FileSystemDirectoryHandle,
      'report.pdf',
      pdfBlob,
      'application/pdf',
    )
    expect(bytes).toBe(pdfBlob.size)
    expect(handle._files.get('report.pdf')?.blob).toBe(pdfBlob)
  })
})
