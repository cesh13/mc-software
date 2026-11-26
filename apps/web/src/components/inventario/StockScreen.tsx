'use client'

import { useState } from 'react'
import type { StockRow } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { cx } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Checkbox, Field, Select } from '@/components/ui/form'
import { Table, Td, Th } from '@/components/ui/table'
import { formatQty, todayIso } from './format'
import { ReportShell } from './ReportShell'
import { useCatalog, useReport } from './use-inventory'

// Existencias a una fecha, por bodega (y lote). Rojo: bajo el mínimo.
export function StockScreen() {
  const [at, setAt] = useState(todayIso())
  const [warehouseId, setWarehouseId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [lots, setLots] = useState(false)
  const [zero, setZero] = useState(false)
  const warehouses = useCatalog('warehouses', true)
  const groups = useCatalog('groups', true)
  const report = useReport<StockRow[]>('stock', {
    at, warehouseId: warehouseId || undefined, groupId: groupId || undefined, lots: lots ? '1' : undefined, zero: zero ? '1' : undefined,
  }, !!at)
  const rows = report.data ?? []
  return (
    <ReportShell
      title="Existencias" subtitle={`Al ${formatDate(at)}`} loading={report.isLoading} error={report.error} empty={!!report.data && !rows.length}
      filters={
        <>
          <Field label="Al"><DateInput value={at} onChange={setAt} /></Field>
          <Field label="Bodega">
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Todas</option>
              {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </Field>
          <Field label="Grupo">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Todos</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
            </Select>
          </Field>
          <Checkbox label="Por lote" checked={lots} onChange={(e) => setLots(e.target.checked)} />
          <Checkbox label="Incluir sin existencia" checked={zero} onChange={(e) => setZero(e.target.checked)} />
        </>
      }
    >
      <Table aria-label="Existencias">
        <thead>
          <tr>
            <Th className="w-36">Código</Th><Th>Descripción</Th><Th className="w-20">Grupo</Th><Th className="w-20">Bodega</Th>
            {lots && <><Th className="w-28">Lote</Th><Th className="w-24">Vence</Th></>}
            <Th className="w-20">Unidad</Th><Th className="w-28 text-right">Existencia</Th><Th className="w-24 text-right">Mínimo</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.itemId}-${r.warehouseId}-${r.lotNo}`} className={cx(r.belowMin && 'text-red-700')}>
              <Td className="font-mono text-xs">{r.itemCode}</Td><Td>{r.itemName}</Td>
              <Td className="font-mono text-xs">{r.groupCode ?? ''}</Td><Td className="font-mono text-xs">{r.warehouseCode ?? ''}</Td>
              {lots && <><Td>{r.lotNo ?? ''}</Td><Td>{formatDate(r.expiresOn)}</Td></>}
              <Td className="text-xs">{r.unit}</Td>
              <Td className="text-right tabular-nums">{formatQty(r.quantity)}</Td>
              <Td className="text-right tabular-nums">{formatQty(r.minQty)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ReportShell>
  )
}
