'use client'

import { memo, type KeyboardEvent, type Ref } from 'react'
import { ACCOUNT_TYPE_LABELS, type Account } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { Td, Th, selectedRowClass } from '@/components/ui/table'

export const rowDomId = (id: string) => `coa-row-${id}`

const Row = memo(function Row({
  account: a,
  selected,
  onSelect,
  onOpen,
}: {
  account: Account
  selected: boolean
  onSelect: (id: string) => void
  onOpen: (a: Account) => void
}) {
  return (
    <tr
      id={rowDomId(a.id)}
      role="row"
      aria-selected={selected}
      onClick={() => onSelect(a.id)}
      onDoubleClick={() => onOpen(a)}
      className={cx(
        'scroll-mt-9 cursor-default hover:bg-blue-50/50 print:break-inside-avoid',
        selected && selectedRowClass,
        !a.isActive && 'text-gray-400',
      )}
    >
      <Td className="whitespace-nowrap font-mono text-xs">{a.code}</Td>
      <Td className={cx(!a.isDetail && 'font-semibold')} style={{ paddingLeft: 8 + Math.max(a.level - 1, 0) * 14 }}>
        {a.name}
        {!a.isActive && <span className="ml-2 text-xs italic">(inactiva)</span>}
      </Td>
      <Td className="whitespace-nowrap">{ACCOUNT_TYPE_LABELS[a.type]}</Td>
      <Td className="text-center">{a.isDetail ? 'Sí' : ''}</Td>
      <Td className="text-center">{a.requiresCostCenter ? 'Sí' : ''}</Td>
      <Td className="font-mono text-xs">{a.budgetGroupCode ?? ''}</Td>
    </tr>
  )
})

// Dense, keyboard-navigable catalog grid: Up/Down/Home/End move the selection, Enter opens it.
export function AccountsTable({
  rows,
  selectedId,
  onSelect,
  onOpen,
  wrapRef,
}: {
  rows: Account[]
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (a: Account) => void
  wrapRef: Ref<HTMLDivElement>
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (rows.length === 0) return
    const idx = rows.findIndex((r) => r.id === selectedId)
    const go = (i: number) => {
      e.preventDefault()
      onSelect(rows[Math.min(Math.max(i, 0), rows.length - 1)].id)
    }
    if (e.key === 'ArrowDown') go(idx + 1)
    else if (e.key === 'ArrowUp') go(idx < 0 ? 0 : idx - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(rows.length - 1)
    else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault()
      onOpen(rows[idx])
    }
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-activedescendant={selectedId ? rowDomId(selectedId) : undefined}
      className={cx(
        'max-h-[calc(100vh-17rem)] overflow-auto rounded-md border border-gray-200 bg-white',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 print:max-h-none print:overflow-visible print:border-0',
      )}
    >
      <table role="grid" aria-label="Catálogo de cuentas" className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th className="w-40">Código</Th>
            <Th>Nombre</Th>
            <Th>Tipo</Th>
            <Th className="w-16 text-center">Detalle</Th>
            <Th className="w-20 text-center">C. costo</Th>
            <Th className="w-28">Agrupación</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <Row key={a.id} account={a} selected={a.id === selectedId} onSelect={onSelect} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
