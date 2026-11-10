import { useSyncExternalStore } from 'react'

// Tiny per-browser store backed by localStorage. Only for conveniences such as
// the active empresa and the working month — never for business data.

const listeners = new Map<string, Set<() => void>>()

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getStored(key: string): string | null {
  return read(key)
}

export function setStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the value just will not persist.
  }
  listeners.get(key)?.forEach((fn) => fn())
}

export function useStored(key: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      const set = listeners.get(key) ?? new Set()
      listeners.set(key, set)
      set.add(onChange)
      return () => set.delete(onChange)
    },
    () => read(key),
    () => null,
  )
}
