'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { Button, cx } from '@/components/ui/button'
import { Alert, ConfirmDialog, Loading, PageHeader } from '@/components/ui/feedback'
import { Checkbox } from '@/components/ui/form'
import { Td, Th, selectedRowClass } from '@/components/ui/table'
import { ActionToolbar } from '@/components/ui/toolbar'

export type SetupItem = { id: string; code: string; name: string; isActive: boolean }
export type SetupColumn<T> = { label: string; className?: string; render: (item: T) => ReactNode }
export type DialogState<T> = { mode: 'add' } | { mode: 'edit'; item: T }

// List + dialog maintenance used by Tipos de partida and Centros de costo.
// ↑/↓ select, Enter modifies; Eliminar deactivates after confirmation.
export function SetupScreen<T extends SetupItem>(p: {
  title: string
  noun: string
  rows: T[] | undefined
  loading: boolean
  error: unknown
  showInactive: boolean
  onShowInactive: (v: boolean) => void
  columns: SetupColumn<T>[]
  renderDialog: (state: DialogState<T>, close: () => void, onSaved: (item: T) => void) => ReactNode
  setActive: { mutateAsync: (v: { id: string; active: boolean }) => Promise<unknown>; error: unknown; reset: () => void; isPending: boolean }
}) {
  const { empresa } = useEmpresa()
  const { can } = useCurrentUser()
  const canCapture = can('capture')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState<T> | null>(null)
  const [confirm, setConfirm] = useState<T | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const rows = p.rows ?? []
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const focusTable = () => setTimeout(() => tableRef.current?.focus(), 0)
  const rowId = (id: string) => `setup-row-${id}`

  useEffect(() => {
    if (selectedId) document.getElementById(rowId(selectedId))?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const openEdit = (item: T | null) => canCapture && item && setDialog({ mode: 'edit', item })
  const closeDialog = () => {
    setDialog(null)
    focusTable()
  }

  async function toggle(item: T, active: boolean) {
    try {
      await p.setActive.mutateAsync({ id: item.id, active })
      setConfirm(null)
      focusTable()
    } catch {
      // Shown in the confirm dialog or below the toolbar.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!rows.length) return
    const i = rows.findIndex((r) => r.id === selectedId)
    const go = (n: number) => {
      e.preventDefault()
      setSelectedId(rows[Math.min(Math.max(n, 0), rows.length - 1)].id)
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i < 0 ? 0 : i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(rows.length - 1)
    else if (e.key === 'Enter' && selected) {
      e.preventDefault()
      openEdit(selected)
    }
  }

  return (
    <div>
      <h1 className="hidden text-lg font-semibold print:block">{p.title} - {empresa.name}</h1>
      <PageHeader
        title={p.title}
        subtitle={empresa.name}
        actions={
          selected && !selected.isActive && canCapture && (
            <Button disabled={p.setActive.isPending} onClick={() => void toggle(selected, true)}>Reactivar</Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
        <ActionToolbar
          shortcuts={!dialog && !confirm}
          actions={{
            agregar: canCapture ? () => setDialog({ mode: 'add' }) : undefined,
            modificar: canCapture && selected ? () => openEdit(selected) : undefined,
            eliminar: canCapture && selected?.isActive
              ? () => {
                  p.setActive.reset()
                  setConfirm(selected)
                }
              : undefined,
            imprimir: () => window.print(),
          }}
        />
        <Checkbox label="Mostrar inactivos" checked={p.showInactive} onChange={(e) => p.onShowInactive(e.target.checked)} />
      </div>
      {p.loading && <Loading />}
      {p.error != null && <Alert>{errorMessage(p.error)}</Alert>}
      {p.setActive.error != null && !confirm && <div className="mb-3"><Alert>{errorMessage(p.setActive.error)}</Alert></div>}
      {p.rows && rows.length === 0 && (
        <p className="py-6 text-sm text-gray-500">No hay registros. {canCapture && 'Use Agregar para crear el primero.'}</p>
      )}
      {rows.length > 0 && (
        <div
          ref={tableRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-activedescendant={selectedId ? rowId(selectedId) : undefined}
          className="max-h-[calc(100vh-16rem)] overflow-auto rounded-md border border-gray-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 print:max-h-none print:border-0"
        >
          <table role="grid" aria-label={p.title} className="w-full border-collapse text-sm">
            <thead>
              <tr>{p.columns.map((c) => <Th key={c.label} className={c.className}>{c.label}</Th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  id={rowId(r.id)}
                  aria-selected={r.id === selectedId}
                  onClick={() => setSelectedId(r.id)}
                  onDoubleClick={() => openEdit(r)}
                  className={cx('cursor-default hover:bg-blue-50/50', r.id === selectedId && selectedRowClass, !r.isActive && 'text-gray-400')}
                >
                  {p.columns.map((c) => <Td key={c.label} className={c.className}>{c.render(r)}</Td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && p.renderDialog(dialog, closeDialog, (item) => {
        if (!item.isActive) p.onShowInactive(true)
        setSelectedId(item.id)
        closeDialog()
      })}
      <ConfirmDialog
        open={confirm !== null}
        danger
        title={`Eliminar ${p.noun}`}
        confirmLabel="Desactivar"
        message={
          <>
            ¿Desea desactivar el {p.noun} {confirm?.code} - {confirm?.name}? No se podrá usar en partidas nuevas.
            {p.setActive.error != null && <span className="mt-2 block text-red-700">{errorMessage(p.setActive.error)}</span>}
          </>
        }
        onConfirm={() => confirm && void toggle(confirm, false)}
        onClose={() => {
          setConfirm(null)
          focusTable()
        }}
      />
    </div>
  )
}
