'use client'

import { useState } from 'react'
import {
  isIsoDate, isZeroMoney, periodLabel, type Account, type EntryInput, type EntrySaveResult, type Money, type Period,
} from '@accounting/shared'
import { ApiError, errorMessage } from '@/lib/api'
import { linesToSave, toLineInput, totalsOf } from './draft'
import { COL } from './EntryLineRow'
import type { FocusTarget } from './grid-focus'
import type { EntryEditor } from './use-entry-editor'
import { useEntryMutations } from './use-entries'

type SaveOpts = { status?: 'borrador'; allowZero?: boolean }
export type SavePrompt =
  | { kind: 'zero'; lines: number[]; opts: SaveOpts }
  | { kind: 'unbalanced'; difference: Money; opts: SaveOpts }

// Grabar: client checks, zero-line confirmation, unbalanced → borrador choice, then the API.
export function useEntrySave({
  editor, period, byId, focus, onSaved,
}: {
  editor: EntryEditor
  period: Period
  byId: Map<string, Account>
  focus: (target: FocusTarget) => void
  onSaved: (result: EntrySaveResult) => void
}) {
  const { save: mutation } = useEntryMutations()
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<SavePrompt | null>(null)

  function fail(message: string, target: FocusTarget) {
    setError(message)
    setTimeout(() => focus(target), 0)
  }

  async function save(opts: SaveOpts = {}) {
    const d = editor.current.current
    if (!d || mutation.isPending) return
    setError(null)
    setPrompt(null)
    if (!d.entryTypeId) return fail('Elija el tipo de partida.', { field: 'type' })
    if (d.numberEdited && !/^\d{1,10}$/.test(d.number)) return fail('El número debe tener solo dígitos.', { field: 'number' })
    if (!isIsoDate(d.date) || !d.date.startsWith(`${period}-`)) {
      return fail(`La fecha debe estar dentro de ${periodLabel(period)}.`, { field: 'date' })
    }
    const lines = linesToSave(d.lines)
    if (lines.length === 0) return fail('La partida debe tener al menos una línea.', { r: 0, c: COL.account })
    const needsCenter: boolean[] = []
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const account = l.accountId ? byId.get(l.accountId) : undefined
      if (!l.accountId) return fail(`Línea ${i + 1}: falta la cuenta.`, { r: i, c: COL.account })
      needsCenter.push(!!account?.requiresCostCenter)
      if (account?.requiresCostCenter && !l.costCenterId) {
        return fail(`Línea ${i + 1}: la cuenta ${account.code} exige centro de costo.`, { r: i, c: COL.costCenter })
      }
    }
    const zero = lines.flatMap((l, i) => (isZeroMoney(l.debit) && isZeroMoney(l.credit) ? [i + 1] : []))
    if (zero.length && !opts.allowZero) return setPrompt({ kind: 'zero', lines: zero, opts })

    const totals = totalsOf(lines)
    const status = opts.status ?? (totals.balanced ? 'aplicada' : null)
    if (!status) return setPrompt({ kind: 'unbalanced', difference: totals.difference, opts })

    const input: EntryInput = {
      period,
      entryTypeId: d.entryTypeId,
      number: d.numberEdited ? d.number : undefined,
      date: d.date,
      concept: d.concept.trim(),
      status,
      allowZeroLines: zero.length > 0,
      lines: lines.map((l, i) => toLineInput(l, needsCenter[i])),
    }
    try {
      onSaved(await mutation.mutateAsync({ id: d.id, input }))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unbalanced' && status === 'aplicada') {
        const difference = typeof err.body?.difference === 'string' ? err.body.difference : totals.difference
        return setPrompt({ kind: 'unbalanced', difference, opts })
      }
      const message = errorMessage(err)
      setError(message)
      // Line errors from the API start with "Línea N:".
      const line = /^Línea (\d+):/.exec(message)
      if (line) setTimeout(() => focus({ r: Number(line[1]) - 1, c: COL.account }), 0)
    }
  }

  return {
    save,
    saving: mutation.isPending,
    error,
    setError,
    prompt,
    closePrompt: () => setPrompt(null),
    // Answers to the prompts.
    acceptZero: () => prompt && void save({ ...prompt.opts, allowZero: true }),
    saveAsDraft: () => prompt && void save({ ...prompt.opts, status: 'borrador' }),
  }
}
