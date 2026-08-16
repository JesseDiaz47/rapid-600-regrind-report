/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(`${process.cwd()}/public/sw.js`, 'utf8')
const viteConfig = readFileSync(`${process.cwd()}/vite.config.ts`, 'utf8')

/**
 * These guard the update path rather than any particular cache name. The
 * original bug was a hardcoded `rapid-600-v1`: because a browser only treats a
 * worker as new when the bytes of sw.js change, that file stayed identical
 * across releases, was never reinstalled, and every installed device kept
 * serving its first-ever cache. It was meant to be bumped by hand each release
 * and, predictably, never was.
 */
describe('service worker cache generation', () => {
  it('derives its cache name from a stamped build id, not a fixed literal', () => {
    expect(source).toContain("const BUILD_ID = '__BUILD_ID__'")
    expect(source).toContain('const CACHE = `${CACHE_PREFIX}${BUILD_ID}`')
  })

  it('has no hand-bumped version constant to forget', () => {
    expect(source).not.toMatch(/const CACHE\s*=\s*['"]rapid-600-v\d+['"]/)
  })

  it('is stamped by the build, which fails if the declaration goes missing', () => {
    expect(viteConfig).toContain("const BUILD_ID_PLACEHOLDER = '__BUILD_ID__'")
    expect(viteConfig).toContain('stampServiceWorker')
    expect(viteConfig).toMatch(/plugins:\s*\[react\(\),\s*stampServiceWorker\(BUILD_ID\)\]/)
  })

  it('guards on the whole declaration, not the bare token', () => {
    // The token appears in sw.js prose too. An earlier version of this guard
    // matched anywhere in the file, so it passed against a comment while the
    // real constant had been replaced by a hardcoded name — the build shipped
    // an unstamped worker and still exited 0.
    expect(viteConfig).toContain(
      'const BUILD_ID_DECLARATION = `const BUILD_ID = \'${BUILD_ID_PLACEHOLDER}\'`',
    )
    expect(viteConfig).toContain('source.includes(BUILD_ID_DECLARATION)')
    expect(viteConfig).not.toContain('source.includes(BUILD_ID_PLACEHOLDER)')
  })

  it('retires only the caches this app made', () => {
    // A bare `key !== CACHE` would delete unrelated caches on the same origin.
    expect(source).toContain('key.startsWith(CACHE_PREFIX) && key !== CACHE')
  })

  it('takes over promptly so a release is not stranded behind an old worker', () => {
    expect(source).toContain('self.skipWaiting()')
    expect(source).toContain('self.clients.claim()')
  })
})
