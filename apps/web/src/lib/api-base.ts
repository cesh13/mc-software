const DEV_API_PORT = '3001'

/**
 * Base URL of the API.
 *
 * In production the API serves this UI, so the API is the page's own origin:
 * a client that opened http://SERVIDOR:3001 must call SERVIDOR, not itself.
 * In dev, Next.js runs on its own port, so we target the API port on the
 * same host (works from another LAN machine too).
 */
export function getApiBase(): string {
  const override = process.env.NEXT_PUBLIC_API_URL
  if (override) return override

  // Static-export prerender: no window, and no request is made here.
  if (typeof window === 'undefined') return `http://localhost:${DEV_API_PORT}`

  if (process.env.NODE_ENV === 'development') {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`
  }
  return window.location.origin
}
