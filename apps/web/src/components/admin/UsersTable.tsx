'use client'

import { memo, type KeyboardEvent, type Ref } from 'react'
import { isRole, ROLE_LABELS } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { Table, Td, Th, selectedRowClass } from '@/components/ui/table'
import type { AdminUser } from './use-users'

const rowDomId = (id: string) => `user-row-${id}`

const Row = memo(function Row({
  u, selected, empresas, onSelect, onOpen,
}: {
  u: AdminUser
  selected: boolean
  empresas: string
  onSelect: (id: string) => void
  onOpen: (u: AdminUser) => void
}) {
  return (
    <tr
      id={rowDomId(u.id)}
      aria-selected={selected}
      onClick={() => onSelect(u.id)}
      onDoubleClick={() => onOpen(u)}
      className={cx('cursor-default hover:bg-blue-50/50', selected && selectedRowClass, u.banned && 'text-gray-400')}
    >
      <Td className="font-medium">{u.name}</Td>
      <Td>{u.email}</Td>
      <Td className="whitespace-nowrap">{isRole(u.role) ? ROLE_LABELS[u.role] : u.role}</Td>
      <Td>{empresas}</Td>
      <Td className="whitespace-nowrap">{u.banned ? 'Bloqueado' : 'Activo'}</Td>
    </tr>
  )
})

export function UsersTable({
  rows, selectedId, siglasOf, onSelect, onOpen, wrapRef,
}: {
  rows: AdminUser[]
  selectedId: string | null
  siglasOf: (u: AdminUser) => string
  onSelect: (id: string) => void
  onOpen: (u: AdminUser) => void
  wrapRef: Ref<HTMLDivElement>
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = rows.findIndex((r) => r.id === selectedId)
    const go = (i: number) => {
      e.preventDefault()
      const id = rows[Math.min(Math.max(i, 0), rows.length - 1)].id
      onSelect(id)
      document.getElementById(rowDomId(id))?.scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'ArrowDown') go(idx + 1)
    else if (e.key === 'ArrowUp') go(idx < 0 ? 0 : idx - 1)
    else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault()
      onOpen(rows[idx])
    }
  }
  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Usuarios" className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <Table>
        <thead>
          <tr><Th>Nombre</Th><Th>Correo</Th><Th>Rol</Th><Th>Empresas</Th><Th>Estado</Th></tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <Row key={u.id} u={u} selected={u.id === selectedId} empresas={siglasOf(u)} onSelect={onSelect} onOpen={onOpen} />
          ))}
        </tbody>
      </Table>
    </div>
  )
}
