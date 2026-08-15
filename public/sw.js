/*
 * Offline app shell. Installation discovers the production JS/CSS references
 * from index.html so the first successful visit is enough for an offline reload.
 * Only same-origin GET requests are intercepted and only navigations fall back
 * to the cached app shell.
 *
 * The BUILD_ID placeholder below is replaced with a per-build value by the
 * stamp-service-worker plugin in vite.config.ts, which fails the build if this
 * file stops declaring it. That stamp is what makes an installed app updatable:
 * a browser treats a worker as new only when the bytes of this file change, so
 * a hardcoded cache name would keep every installed device on its first-ever
 * cache no matter what was deployed. Each release therefore installs into its
 * own cache, and the activate handler retires the ones this app made earlier.
 */
const BUILD_ID = '__BUILD_ID__'
const CACHE_PREFIX = 'rapid-600-'
const CACHE = `${CACHE_PREFIX}${BUILD_ID}`
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

function discoverSameOriginAssets(html) {
  const assets = new Set()
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], self.location.href)
    if (url.origin === self.location.origin) assets.add(url.href)
  }
  return [...assets]
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        const indexResponse = await fetch('./index.html', { cache: 'no-store' })
        if (!indexResponse.ok) throw new Error('Could not fetch the app shell')
        const html = await indexResponse.text()
        const urls = new Set(SHELL.map((path) => new URL(path, self.location.href).href))
        for (const asset of discoverSameOriginAssets(html)) urls.add(asset)
        await cache.addAll([...urls])
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) {
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, response.clone())))
        }
        return response
      } catch (error) {
        if (request.mode === 'navigate') {
          return (await caches.match('./index.html')) ?? Response.error()
        }
        throw error
      }
    }),
  )
})
