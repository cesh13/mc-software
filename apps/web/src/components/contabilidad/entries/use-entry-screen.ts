'use client'

import { useCallback, useState } from 'react'
import type { Entry, EntrySaveResult } from '@accounting/shared'
import { ApiError, errorMessage } from '@/lib/api'
import { useCurrentUser } from '@/lib/session'
import { useAccounts } from '../coa/use-coa'
import { draftFromEntry, newDraft } from './draft'
import { COL } from './EntryLineRow'
import { focusTarget, type FocusTarget } from './grid-focus'
import { useEntryEditor } from './use-entry-editor'
import { useEntryMutations } from './use-entries'
import { useEntryRoute } from './use-entry-route'
import { useEntrySave } from './use-entry-save'
import { useEntryTypes, usePeriodStatus } from './use-gl-setup'
import { useUnsavedGuard } from './use-unsaved-guard'

export type Notice = { kind: 'success' | 'info' | 'error'; text: string }

const SOURCE_LOCKS: Record<string, string> = {
  bancos: 'Partida generada por Bancos: modifíquela desde el módulo de Bancos.',
  iva: 'Partida generada por IVA: modifíquela desde el módulo de IVA.',
  cierre: 'Partida de cierre anual: anúlela y genere el cierre de nuevo.',
}

// Why Modificar is unavailable for this entry, if it is.
export function lockReason(entry: Entry | null): string | null {
  if (!entry || entry.editable) return null
  if (!entry.isActive) return 'Partida anulada: solo consulta e impresión.'
  if (entry.periodStatus === 'closed') return 'Mes cerrado: solo consulta e impresión.'
  return SOURCE_LOCKS[entry.source] ?? 'La partida no se puede modificar aquí.'
}

export function useEntryScreen() {
  const { can } = useCurrentUser()
  const canCapture = can('capture')
  const editor = useEntryEditor()
  const editing = editor.draft !== null
  const route = useEntryRoute(editing)
  const { entry, period, setId } = route
  const status = usePeriodStatus(period)
  const types = useEntryTypes(true)
  const { byId } = useAccounts()
  const { apply, voidEntry, copy } = useEntryMutations()
  const [notice, setNotice] = useState<Notice | null>(null)
  // Action waiting for the user to confirm discarding unsaved edits.
  const [discard, setDiscard] = useState<(() => void) | null>(null)

  useUnsavedGuard(editing && editor.dirty)

  const onSaved = useCallback(
    (r: EntrySaveResult) => {
      editor.stop()
      setId(r.id)
      const name = `${r.entryTypeCode}-${r.number}`
      setNotice(
        r.numberReassigned
          ? { kind: 'info', text: `El número solicitado ya estaba asignado; la partida se grabó con el número ${r.number}.` }
          : { kind: 'success', text: `Partida ${name} grabada${r.status === 'borrador' ? ' como borrador' : ''}.` },
      )
    },
    [editor, setId],
  )
  const saver = useEntrySave({ editor, period, byId, focus: focusTarget, onSaved })

  // Runs `fn` now, or after confirmation when there are unsaved edits.
  const guard = (fn: () => void) => (editing && editor.dirty ? setDiscard(() => fn) : fn())

  const begin = (draft: Parameters<typeof editor.start>[0], focus: FocusTarget) => {
    setNotice(null)
    saver.setError(null)
    editor.start(draft)
    setTimeout(() => focusTarget(focus), 0)
  }

  function startAdd() {
    const active = (types.data ?? []).filter((t) => t.isActive)
    const typeId = active.find((t) => t.id === entry?.entryTypeId)?.id ?? active[0]?.id ?? ''
    begin(newDraft(period, typeId), { field: 'type' })
  }

  const startEdit = () => entry && begin(draftFromEntry(entry), { r: 0, c: COL.account })

  const cancel = () =>
    guard(() => {
      editor.stop()
      saver.setError(null)
    })

  const changePeriod = (p: string) => {
    if (p !== period) {
      guard(() => {
        editor.stop()
        setNotice(null)
        route.changePeriod(p)
      })
    }
  }

  const open = (id: string) => guard(() => {
    editor.stop()
    setNotice(null)
    setId(id)
  })

  async function applyEntry() {
    if (!entry) return
    setNotice(null)
    try {
      await apply.mutateAsync(entry.id)
      setNotice({ kind: 'success', text: `Partida ${entry.entryTypeCode}-${entry.number} aplicada.` })
    } catch (err) {
      const b = err instanceof ApiError && err.code === 'unbalanced' ? err.body : null
      setNotice({
        kind: 'error',
        text: b
          ? `No se puede aplicar: la partida NO CUADRA por ${String(b.difference).replace('-', '')} ` +
            `(cargos ${String(b.debit)}, abonos ${String(b.credit)}). Modifíquela para que cuadre.`
          : errorMessage(err),
      })
    }
  }

  async function voidCurrent(): Promise<boolean> {
    if (!entry) return false
    try {
      await voidEntry.mutateAsync(entry.id)
      setNotice({ kind: 'success', text: `Partida ${entry.entryTypeCode}-${entry.number} anulada.` })
      return true
    } catch {
      return false
    }
  }

  async function copyTo(target: { period: string; date: string }): Promise<boolean> {
    if (!entry) return false
    try {
      const r = await copy.mutateAsync({ id: entry.id, input: target })
      setId(r.id)
      begin(draftFromEntry(r), { r: 0, c: COL.account })
      setNotice({ kind: 'info', text: `Copia creada como borrador ${r.entryTypeCode}-${r.number}. Revise y grabe.` })
      return true
    } catch {
      return false
    }
  }

  return {
    canCapture, editor, editing, route, entry, period, status, types, saver, notice, setNotice,
    discard, setDiscard, startAdd, startEdit, cancel, changePeriod, open, applyEntry, voidCurrent, copyTo,
    applying: apply.isPending, voidMutation: voidEntry, copyMutation: copy,
  }
}

export type EntryScreenState = ReturnType<typeof useEntryScreen>
