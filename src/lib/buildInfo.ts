/**
 * Which build this app came from.
 *
 * Stamped in by vite.config.ts, and shown on the Reference screen so a device
 * can be identified without a console: the service worker keeps an installed
 * app running its cached copy until an update lands, so "did this tablet get
 * the fix?" is otherwise unanswerable from across the floor.
 *
 * The `typeof` guard is what keeps this working under the test runner and the
 * dev server, where the value is never substituted.
 */
declare const __APP_BUILD_ID__: string | undefined

export const BUILD_ID: string = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev'
