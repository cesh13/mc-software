'use client'

import { useRef, useState } from 'react'
import { periodLabel } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { MonthPicker } from '@/components/ui/month-picker'
import { ActionToolbar } from '@/components/ui/toolbar'
import { EntryDialogs, type OpenDialog } from './EntryDialogs'
import { EntryEditArea, EntryViewArea } from './EntryEditArea'
import { EntryPrint } from './EntryPrint'
import { lockReason, useEntryScreen } from './use-entry-screen'

// Elaboración de partidas: consulta (browse one entry) and edición (add / modify).
export function EntryScreen() {
  const { empresa } = useEmpresa()
  const s = useEntryScreen()
  const { entry, editing, editor, saver, canCapture, period } = s
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const [gridBusy, setGridBusy] = useState(false)
  const restore = useRef<HTMLElement | null>(null)
  const monthClosed = s.status.isClosed
  const busy = dialog !== null || s.discard !== null || saver.prompt !== null || gridBusy

  const remember = () => {
    restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  const refocus = () => setTimeout(() => restore.current?.focus(), 0)
  const openDialog = (d: OpenDialog) => {
    remember()
    s.voidMutation.reset()
    s.copyMutation.reset()
    setDialog(d)
  }
  const closeDialog = () => {
    setDialog(null)
    refocus()
  }

  // F10 may come while the account picker still holds typed text: blur commits it first.
  const grabar = () => {
    remember()
    restore.current?.blur()
    restore.current?.focus()
    setTimeout(() => void saver.save(), 0)
  }

  const canWrite = canCapture && !monthClosed
  const actions = editing
    ? {
        agregar: undefined, buscar: undefined, eliminar: undefined, modificar: undefined, anterior: undefined,
        siguiente: undefined, grabar: saver.saving ? undefined : grabar, cancelar: s.cancel, copiar: undefined, imprimir: undefined,
      }
    : {
        agregar: canWrite ? s.startAdd : undefined,
        buscar: () => openDialog('search'),
        eliminar: canWrite && entry?.isActive ? () => openDialog('void') : undefined,
        modificar: canCapture && entry?.editable ? s.startEdit : undefined,
        anterior: entry?.prevId ? () => s.open(entry.prevId!) : undefined,
        siguiente: entry?.nextId ? () => s.open(entry.nextId!) : undefined,
        grabar: undefined,
        cancelar: undefined,
        copiar: canCapture && entry ? () => openDialog('copy') : undefined,
        imprimir: entry ? () => window.print() : undefined,
      }

  const lock = !editing ? lockReason(entry) : null
  const showApply = !editing && canCapture && entry?.status === 'borrador' && entry.editable

  return (
    <div>
      {entry && !editing && <EntryPrint entry={entry} empresa={empresa.name} />}
      <div className="print:hidden">
        <PageHeader
          title="Elaboración de partidas"
          subtitle={`${empresa.name} · ${periodLabel(period)}`}
          actions={
            showApply && (
              <Button variant="primary" disabled={s.applying} onClick={() => void s.applyEntry()}>
                Aplicar
              </Button>
            )
          }
        />
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <MonthPicker value={period} onChange={s.changePeriod} closed={s.status.closed} />
          {monthClosed && (
            <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
              Mes cerrado: solo consulta e impresión
            </span>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <ActionToolbar shortcuts={!busy} actions={actions} />
          {lock && <span className="text-xs text-gray-500">{lock}</span>}
          {!canCapture && <span className="text-xs text-gray-500">Su usuario solo puede consultar partidas.</span>}
        </div>
        <div className="mb-3 flex flex-col gap-2 empty:hidden">
          {s.notice && <Alert kind={s.notice.kind}>{s.notice.text}</Alert>}
          {saver.error && <Alert>{saver.error}</Alert>}
          {s.status.error && <Alert kind="warning">No se pudo leer el estado del mes: {errorMessage(s.status.error)}</Alert>}
        </div>
        <Body s={s} onGridBusy={setGridBusy} canWrite={canWrite} />
      </div>
      <EntryDialogs s={s} dialog={dialog} close={closeDialog} dismiss={() => setDialog(null)} onPromptClose={refocus} />
    </div>
  )
}

function Body({ s, onGridBusy, canWrite }: { s: ReturnType<typeof useEntryScreen>; onGridBusy: (b: boolean) => void; canWrite: boolean }) {
  const { route, entry, period } = s
  const types = s.types.data ?? []
  if (s.editing) {
    return <EntryEditArea editor={s.editor} entry={entry} period={period} types={types} onGridBusy={onGridBusy} />
  }
  if (entry) return <EntryViewArea entry={entry} types={types} period={period} />
  if (route.entryQuery.error) return <Alert>{errorMessage(route.entryQuery.error)}</Alert>
  if (route.listError) return <Alert>{errorMessage(route.listError)}</Alert>
  if (route.resolving || route.entryQuery.isLoading) return <Loading />
  if (route.monthEmpty) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
        No hay partidas en {periodLabel(period)}.
        {canWrite && (
          <div className="mt-3">
            <Button variant="primary" onClick={s.startAdd}>Agregar (F2)</Button>
          </div>
        )}
      </div>
    )
  }
  return <Loading />
}
