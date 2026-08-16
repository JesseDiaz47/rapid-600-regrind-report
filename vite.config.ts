import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Placeholder the service worker ships with, replaced at build time. Must stay
 * in sync with `public/sw.js`.
 *
 * The guard matches the whole declaration rather than the bare token, because
 * the token also appears in prose: an earlier version of this check passed
 * happily against a mention in a comment while the real constant had been
 * replaced by a hardcoded name.
 */
const BUILD_ID_PLACEHOLDER = '__BUILD_ID__'
const BUILD_ID_DECLARATION = `const BUILD_ID = '${BUILD_ID_PLACEHOLDER}'`

/**
 * One identifier per build, stamped into both the app and the service worker.
 *
 * The worker names its cache after this, which is what makes an installed app
 * updatable at all: a browser decides a worker is new by comparing the bytes of
 * sw.js, so a file that is byte-identical every release is never reinstalled,
 * and the app keeps serving its first-ever cache forever. Deriving the name
 * from a per-build value gives each release its own cache and retires the
 * previous one, with nobody having to remember to bump a constant.
 */
function buildId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

const BUILD_ID = buildId()

const SW_SOURCE = fileURLToPath(new URL('public/sw.js', import.meta.url))

/**
 * Stamp the build id into the emitted service worker. `public/` is copied
 * verbatim rather than transformed, so this rewrites the output file.
 *
 * The placeholder is checked in `buildStart` rather than at write time because
 * Vite swallows an error thrown from `writeBundle` — the build prints nothing
 * and still exits 0, which would ship an unstamped worker and silently restore
 * the never-updates bug this exists to prevent. Failing before the build starts
 * is the part that actually stops that.
 */
function stampServiceWorker(id: string): Plugin {
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    buildStart() {
      const source = readFileSync(SW_SOURCE, 'utf8')
      if (!source.includes(BUILD_ID_DECLARATION)) {
        throw new Error(
          `public/sw.js must declare \`${BUILD_ID_DECLARATION}\`. Without it the cache name is ` +
            'fixed across releases, and installed apps never pick up a new one.',
        )
      }
    },
    writeBundle(options) {
      if (!options.dir) return
      const swPath = join(options.dir, 'sw.js')
      const source = readFileSync(swPath, 'utf8')
      writeFileSync(swPath, source.replaceAll(BUILD_ID_PLACEHOLDER, id))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: { host: true, port: 4175, strictPort: true },
  plugins: [react(), stampServiceWorker(BUILD_ID)],
  define: { __APP_BUILD_ID__: JSON.stringify(BUILD_ID) },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
