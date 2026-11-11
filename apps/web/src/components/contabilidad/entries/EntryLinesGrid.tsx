'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { isZeroMoney, type Account } from '@accounting/shared'
import { ConfirmDialog } from '@/components/ui/feedback'
import { Th } from '@/components/ui/table'
import { useAccounts } from '../coa/use-coa'
import { COL, EntryLineRow } from './EntryLineRow'
import { focusCell } from './grid-focus'
import { useCostCenters } from './use-gl-setup'
import type { EntryEditor } from './use-entry-editor'

// Editable lines grid. Keyboard: Enter/Tab next cell (Enter on a filled Cargo ends the line),
// Shift+Enter previous cell, ↑/↓ same column in the text and amount cells, Enter at the end of
// the last line adds a line, Ctrl+Supr removes the current line after confirmation.
export function EntryLinesGrid({ editor, onBusy }: { editor: EntryEditor; onBusy: (busy: boolean) => void }) {
  const lines = editor.draft?.lines ?? []
  const { byId } = useAccounts()
  const centers = useCostCenters(true)
  const costCenters = centers.data ?? NO_CENTERS
  const rootRef = useRef<HTMLDivElement>(null)
  const pending = useRef<{ r: number; c: number } | null>(null)
  const [removing, setRemoving] = useState<{ key: string; index: number } | null>(null)
  const { setAccount, patchLine, addLine, removeLine, current } = editor

  useEffect(() => onBusy(removing !== null), [removing, onBusy])

  // Focus requested before a render (new or removed line) is applied once the DOM has it.
  useLayoutEffect(() => {
    if (!pending.current || !rootRef.current) return
    const { r, c } = pending.current
    pending.current = null
    focusCell(rootRef.current, r, c)
  }, [lines.length])

  const onAccount = useCallback(
    (key: string, a: Account | null) => setAccount(key, a?.id ?? null, !!a?.requiresCostCenter),
    [setAccount],
  )
  const onRemove = useCallback((key: string, index: number) => setRemoving({ key, index }), [])

  const moveNext = useCallback(
    (r: number, c: number, enter: boolean) => {
      const root = rootRef.current
      const all = current.current?.lines
      const line = all?.[r]
      if (!root || !all || !line) return
      // Enter on the account stays there until an account is picked.
      if (c === COL.account && !line.accountId && enter) return void focusCell(root, r, c)
      const lineDone = enter && c === COL.debit && !isZeroMoney(line.debit)
      for (let nc = c + 1; nc <= COL.credit && !lineDone; nc++) if (focusCell(root, r, nc)) return
      if (r < all.length - 1) return void focusCell(root, r + 1, COL.account)
      if (!line.accountId) return void focusCell(root, r, COL.account)
      pending.current = { r: r + 1, c: COL.account }
      addLine()
    },
    [addLine, current],
  )

  const movePrev = useCallback((r: number, c: number) => {
    const root = rootRef.current
    if (!root) return
    for (let pc = c - 1; pc >= COL.account; pc--) if (focusCell(root, r, pc)) return
    if (r > 0) for (let pc = COL.credit; pc >= COL.account; pc--) if (focusCell(root, r - 1, pc)) return
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const td = (e.target as HTMLElement).closest<HTMLElement>('td[data-c]')
    if (!td) return
    const r = Number(td.dataset.r)
    const c = Number(td.dataset.c)
    const line = lines[r]
    if (!line) return
    if (e.key === 'Delete' && e.ctrlKey) {
      e.preventDefault()
      setRemoving({ key: line.key, index: r })
    } else if (e.key === 'Enter' || (e.key === 'Tab' && c === COL.account && !e.shiftKey)) {
      // Deferred: the account picker commits its value on the same key or on blur.
      const consumed = e.defaultPrevented
      e.preventDefault()
      const enter = e.key === 'Enter'
      const back = e.shiftKey
      // Tab (and Enter with the list closed) is not handled by the picker: blurring makes it
      // commit a typed exact code before the move is computed.
      if (c === COL.account && !consumed && !back) (e.target as HTMLElement).blur()
      setTimeout(() => (back ? movePrev(r, c) : moveNext(r, c, enter)), 0)
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && c >= COL.detail && !e.altKey) {
      const root = rootRef.current
      const target = r + (e.key === 'ArrowDown' ? 1 : -1)
      if (root && target >= 0 && target < lines.length) {
        e.preventDefault()
        focusCell(root, target, c)
      }
    }
  }

  function confirmRemove() {
    if (!removing) return
    const left = lines.length - 1
    removeLine(removing.key)
    if (left > 0) pending.current = { r: Math.min(removing.index, left - 1), c: COL.account }
    // Removing the only line replaces it, so the length does not change: focus here.
    else setTimeout(() => rootRef.current && focusCell(rootRef.current, 0, COL.account), 0)
    setRemoving(null)
  }

  function cancelRemove() {
    const index = removing?.index ?? 0
    setRemoving(null)
    setTimeout(() => rootRef.current && focusCell(rootRef.current, index, COL.account), 0)
  }

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="rounded-md border border-gray-200 bg-white">
      <table className="w-full table-fixed border-collapse text-sm" aria-label="Líneas de la partida">
        <thead>
          <tr>
            <Th className="w-10 text-right">#</Th>
            <Th className="w-40">Cuenta</Th>
            <Th className="w-[18%]">Nombre de la cuenta</Th>
            <Th className="w-36">C. costo</Th>
            <Th>Detalle</Th>
            <Th className="w-36 text-right">Cargo</Th>
            <Th className="w-36 text-right">Abono</Th>
            <Th className="w-8"><span className="sr-only">Acciones</span></Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <EntryLineRow
              key={l.key}
              line={l}
              index={i}
              account={l.accountId ? byId.get(l.accountId) : undefined}
              costCenters={costCenters}
              onAccount={onAccount}
              onPatch={patchLine}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={removing !== null}
        danger
        title="Eliminar línea"
        confirmLabel="Eliminar"
        message={`¿Desea eliminar la línea ${(removing?.index ?? 0) + 1}?`}
        onConfirm={confirmRemove}
        onClose={cancelRemove}
      />
    </div>
  )
}

const NO_CENTERS: never[] = []
