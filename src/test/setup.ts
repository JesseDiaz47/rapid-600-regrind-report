import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement matchMedia. Tests can flip reduced-motion by
 * setting `window.__reducedMotion = true` before rendering.
 */
declare global {
  interface Window {
    __reducedMotion?: boolean
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.__reducedMotion = false
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-motion')
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches:
      query.includes('prefers-reduced-motion') && window.__reducedMotion === true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
