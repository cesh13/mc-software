'use client'

import { useState } from 'react'
import type { Valuation } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { DateInput } from '@/components/ui/date-input'
import { Field, Select } from '@/components/ui/form'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { formatCost, formatQty, todayIso } from './format'
import { ReportShell } from './ReportShell'
import { useCatalog, useReport } from './use-inventory'

// Valorización a una fecha (legacy sival01). Suma de los costos congelados:
// el total por cuenta debe cuadrar con el saldo de la cuenta de inventario.
export function ValuationScreen() {
  const [at, setAt] = useState(todayIso())
  const [groupId, setGroupId] = useState('')
  const groups = useCatalog('groups', true)
  const report = useReport<Valuation>('valuation', { at, groupId: groupId || undefined }, !!at)
  const v = report.data
  return (
    <ReportShell
      title="Valorización de inventario" subtitle={`Al ${formatDate(at)}`} loading={report.isLoading} error={report.error}
      empty={!!v && !v.rows.length}
      filters={
        <>
          <Field label="Al"><DateInput value={at} onChange={setAt} /></Field>
          <Field label="Grupo">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Todos</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
            </Select>
          </Field>
        </>
      }
    >
      {v && (
        <div className="flex flex-col gap-4">
          <Table aria-label="Valorización">
            <thead>
              <tr>
                <Th className="w-36">Código</Th><Th>Descripción</Th><Th className="w-20">Grupo</Th><Th className="w-24">Cuenta</Th>
                <Th className="w-28 text-right">Existencia</Th><Th className="w-28 text-right">Costo promedio</Th><Th className="w-32 text-right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.itemId}>
                  <Td className="font-mono text-xs">{r.itemCode}</Td><Td>{r.itemName}</Td>
                  <Td className="font-mono text-xs">{r.groupCode ?? ''}</Td><Td className="font-mono text-xs">{r.inventoryAccountCode ?? ''}</Td>
                  <Td className="text-right tabular-nums">{formatQty(r.quantity)} {r.unit}</Td>
                  <Td className="text-right tabular-nums">{formatCost(r.averageCost)}</Td><MoneyTd value={r.value} showZero />
                </tr>
              ))}
              <tr><Td colSpan={6} className="text-right font-semibold">Total</Td><MoneyTd value={v.total} bold showZero /></tr>
            </tbody>
          </Table>
          <div className="max-w-xl">
            <h2 className="mb-1 text-sm font-semibold">Por cuenta de inventario</h2>
            <Table aria-label="Por cuenta">
              <tbody>
                {v.byAccount.map((a) => (
                  <tr key={a.accountId ?? 'none'}>
                    <Td className="font-mono text-xs">{a.accountCode ?? '(sin cuenta)'}</Td><Td>{a.accountName ?? ''}</Td><MoneyTd value={a.value} showZero />
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </ReportShell>
  )
}
