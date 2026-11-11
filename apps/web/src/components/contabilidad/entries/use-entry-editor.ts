'use client'

import { useMemo, useReducer, useRef } from 'react'
import { isZeroMoney, ZERO } from '@accounting/shared'
import { emptyLine, totalsOf, type EntryDraft, type LineDraft } from './draft'

type HeaderPatch = Partial<Pick<EntryDraft, 'entryTypeId' | 'number' | 'numberEdited' | 'date' | 'concept'>>
type LinePatch = Partial<Pick<LineDraft, 'costCenterId' | 'detail' | 'debit' | 'credit'>>

type Action =
  | { type: 'start'; draft: EntryDraft }
  | { type: 'stop' }
  | { type: 'header'; patch: HeaderPatch }
  | { type: 'line'; key: string; patch: LinePatch }
  | { type: 'account'; key: string; accountId: string | null; requiresCostCenter: boolean }
  | { type: 'add' }
  | { type: 'remove'; key: string }

type State = { draft: EntryDraft | null; dirty: boolean }

// Detail a line inherits: the previous line's, or the concept for the first one.
function inheritedDetail(d: EntryDraft, index: number): string {
  for (let i = index - 1; i >= 0; i--) if (d.lines[i].detail) return d.lines[i].detail
  return d.concept
}

function mapLine(d: EntryDraft, key: string, fn: (l: LineDraft, i: number) => LineDraft): EntryDraft {
  return { ...d, lines: d.lines.map((l, i) => (l.key === key ? fn(l, i) : l)) }
}

function reduce(state: State, a: Action): State {
  if (a.type === 'start') return { draft: a.draft, dirty: false }
  if (a.type === 'stop' || !state.draft) return { draft: null, dirty: false }
  const d = state.draft
  let next: EntryDraft = d
  switch (a.type) {
    case 'header':
      next = { ...d, ...a.patch }
      break
    case 'line':
      next = mapLine(d, a.key, (l) => {
        const out = { ...l, ...a.patch }
        // A line carries a debit or a credit, never both: typing one clears the other.
        if (a.patch.debit !== undefined && !isZeroMoney(a.patch.debit)) out.credit = ZERO
        if (a.patch.credit !== undefined && !isZeroMoney(a.patch.credit)) out.debit = ZERO
        return out
      })
      break
    case 'account':
      next = mapLine(d, a.key, (l, i) => ({
        ...l,
        accountId: a.accountId,
        costCenterId: a.requiresCostCenter ? l.costCenterId : '',
        detail: l.detail || (a.accountId ? inheritedDetail(d, i) : ''),
      }))
      break
    case 'add':
      next = { ...d, lines: [...d.lines, emptyLine(inheritedDetail(d, d.lines.length))] }
      break
    case 'remove': {
      const lines = d.lines.filter((l) => l.key !== a.key)
      next = { ...d, lines: lines.length ? lines : [emptyLine(d.concept)] }
      break
    }
  }
  return { draft: next, dirty: true }
}

export function useEntryEditor() {
  const [state, dispatch] = useReducer(reduce, { draft: null, dirty: false })
  // Latest draft for handlers that run after a focus change (deferred keyboard moves, save).
  const ref = useRef(state.draft)
  ref.current = state.draft

  // Stable callbacks: grid rows are memoized on them.
  const actions = useMemo(
    () => ({
      start: (draft: EntryDraft) => dispatch({ type: 'start', draft }),
      stop: () => dispatch({ type: 'stop' }),
      header: (patch: HeaderPatch) => dispatch({ type: 'header', patch }),
      patchLine: (key: string, patch: LinePatch) => dispatch({ type: 'line', key, patch }),
      setAccount: (key: string, accountId: string | null, requiresCostCenter: boolean) =>
        dispatch({ type: 'account', key, accountId, requiresCostCenter }),
      addLine: () => dispatch({ type: 'add' }),
      removeLine: (key: string) => dispatch({ type: 'remove', key }),
    }),
    [],
  )

  const lines = state.draft?.lines
  const totals = useMemo(() => totalsOf(lines ?? []), [lines])

  return { draft: state.draft, dirty: state.dirty, totals, current: ref, ...actions }
}

export type EntryEditor = ReturnType<typeof useEntryEditor>
