// Focus helpers shared by the header, the lines grid and the save checks.

export const LINES_ID = 'entry-lines'
export const FIELD_IDS = { type: 'entry-type', number: 'entry-number', date: 'entry-date' } as const

export type FocusTarget = { field: keyof typeof FIELD_IDS } | { r: number; c: number }

// Focuses the enabled field of grid cell (r, c). Returns false when the cell has none
// (e.g. a disabled cost-center select), so the caller can skip it.
export function focusCell(root: HTMLElement, r: number, c: number): boolean {
  const el = root
    .querySelector(`td[data-r="${r}"][data-c="${c}"]`)
    ?.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([disabled]), select:not([disabled])')
  if (!el) return false
  el.focus()
  if (el instanceof HTMLInputElement) el.select()
  return true
}

export function focusTarget(t: FocusTarget): void {
  if ('field' in t) {
    document.getElementById(FIELD_IDS[t.field])?.focus()
    return
  }
  const root = document.getElementById(LINES_ID)
  if (root) focusCell(root, t.r, t.c)
}
