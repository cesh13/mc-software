'use client'

import { useState } from 'react'
import type { AuditRow } from '@accounting/shared'
import { Table, Td, Th, rowClass } from '@/components/ui/table'

const stamp = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'medium' })
}

function pretty(detail: string): string {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}

export function AuditTable({ rows, siglasOf }: { rows: AuditRow[]; siglasOf: (id: string | null) => string }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Table>
      <thead>
        <tr>
          <Th>Fecha</Th><Th>Usuario</Th><Th>Empresa</Th><Th>Módulo</Th><Th>Acción</Th><Th>Entidad</Th><Th>Detalle</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={rowClass}>
            <Td className="whitespace-nowrap">{stamp(r.at)}</Td>
            <Td>{r.userName ?? r.userId}</Td>
            <Td>{siglasOf(r.empresaId)}</Td>
            <Td>{r.module}</Td>
            <Td>{r.action}</Td>
            <Td>{r.entity ?? ''}{r.entityId ? <span className="block text-xs text-gray-400">{r.entityId}</span> : null}</Td>
            <Td className="max-w-md">
              {r.detail && (
                open === r.id ? (
                  <pre className="whitespace-pre-wrap break-all text-xs" onClick={() => setOpen(null)}>{pretty(r.detail)}</pre>
                ) : (
                  <button className="max-w-xs truncate text-left text-xs text-blue-700 hover:underline" onClick={() => setOpen(r.id)}>
                    {r.detail.slice(0, 60)}
                  </button>
                )
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
