'use client'

import { useSyncExternalStore } from 'react'

// On-screen print preview. While it is open, <html> carries the
// `print-preview` class and the Tailwind `print:` variant applies on screen
// too (see tailwind.config.ts), so the page shows the same layout the printer
// gets. The browser's print dialog only opens from the preview bar.
const CLASS = 'print-preview'
const listeners = new Set<() => void>()
let open = false

function set(next: boolean): void {
  if (open === next) return
  open = next
  document.documentElement.classList.toggle(CLASS, next)
  if (next) window.scrollTo(0, 0)
  for (const l of listeners) l()
}

export const openPrintPreview = (): void => set(true)
export const closePrintPreview = (): void => set(false)

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function usePrintPreview(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false)
}
