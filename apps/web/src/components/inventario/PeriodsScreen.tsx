'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { periodLabel } from '@accounting/shared'
import { apiFetch, errorMessage, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { formatDate } from '@/lib/format'
import { usePermissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/form'
import { Table, Td, Th } from '@/components/ui/table'
import { INV_API, invKey, useInvMutation } from './use-inventory'

type Row = { period: string; status: 'open' | 'closed' | 'filed'; closedAt: string | null }

// Cierre de mes de inventario (área 'inventory' de core_periods). Un mes cerrado
// no admite movimientos; reabrirlo pide motivo y queda en la bitácora.
export function PeriodsScreen() {
  const { empresa } = useEmpresa()
  const { can } = usePermissions()
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [reason, setReason] = useState('')
  const list = useQuery<Row[]>({ queryKey: invKey(empresa.id, 'periods', year), queryFn: () => apiFetch(`${INV_API}/periods${qs({ year })}`) })
  const act = useInvMutation((v: { period: string; close: boolean }) =>
    apiFetch(`${INV_API}/periods/${v.period}/${v.close ? 'close' : 'reopen'}`, { json: v.close ? {} : { reason } }))
  const years = Array.from({ length: 8 }, (_, k) => String(new Date().getFullYear() - k))
  return (
    <div>
      <PageHeader title="Cierre de mes de inventario" subtitle={empresa.name} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Año">
          <Select value={year} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y}>{y}</option>)}</Select>
        </Field>
        {can('inv.period.reopen') && (
          <Field label="Motivo para reabrir" className="w-96"><Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></Field>
        )}
      </div>
      {list.isLoading && <Loading />}
      {(list.error ?? act.error) != null && <div className="mb-3"><Alert>{errorMessage(list.error ?? act.error)}</Alert></div>}
      {list.data && (
        <Table aria-label="Meses" className="max-w-2xl">
          <thead><tr><Th>Mes</Th><Th className="w-28">Estado</Th><Th className="w-28">Cerrado el</Th><Th className="w-28" /></tr></thead>
          <tbody>
            {list.data.map((r) => (
              <tr key={r.period}>
                <Td>{periodLabel(r.period)}</Td>
                <Td>{r.status === 'open' ? 'Abierto' : 'Cerrado'}</Td>
                <Td>{formatDate(r.closedAt)}</Td>
                <Td className="text-right">
                  {r.status === 'open' && can('inv.period.close') && (
                    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ period: r.period, close: true })}>Cerrar</Button>
                  )}
                  {r.status === 'closed' && can('inv.period.reopen') && (
                    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ period: r.period, close: false })}>Reabrir</Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
