'use client'

import { useState } from 'react'
import type { Kardex } from '@accounting/shared'
import { formatDate } from '@/lib/format'
import { useWorkPeriod } from '@/lib/work-period'
import { cx } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Field, Input, Select } from '@/components/ui/form'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { lastDay } from './DocumentsScreen'
import { formatCost, formatQty } from './format'
import { ReportShell } from './ReportShell'
import { useCatalog, useItems, useReport } from './use-inventory'

// Kárdex de un producto (legacy kardex2): saldo inicial, cada movimiento con su costo congelado y saldo corrido.
export function KardexScreen() {
  const [period] = useWorkPeriod()
  const [from, setFrom] = useState(`${period}-01`)
  const [to, setTo] = useState(lastDay(period))
  const [code, setCode] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const items = useItems(true)
  const warehouses = useCatalog('warehouses', true)
  const item = items.data?.find((i) => i.code === code)
  const report = useReport<Kardex>('kardex', { itemId: item?.id, from, to, warehouseId: warehouseId || undefined }, !!item && !!from && !!to)
  const k = report.data
  const costs = !!k && k.opening.value !== ''
  return (
    <ReportShell
      title="Kárdex" subtitle={k ? `${k.item.code} ${k.item.name} · ${formatDate(from)} al ${formatDate(to)}` : ''}
      loading={report.isLoading && !!item} error={report.error} empty={!k}
      emptyMessage={item ? undefined : 'Elija un producto.'}
      filters={
        <>
          <Field label="Producto">
            <Input list="kardex-items" value={code} className="w-44 font-mono uppercase" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <datalist id="kardex-items">{(items.data ?? []).map((i) => <option key={i.id} value={i.code}>{i.name}</option>)}</datalist>
          </Field>
          <Field label="Desde"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Hasta"><DateInput value={to} onChange={setTo} /></Field>
          <Field label="Bodega">
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Todas</option>
              {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </Field>
          {item && <span className="pb-2 text-sm text-gray-600">{item.name} ({item.unit})</span>}
        </>
      }
    >
      {k && (
        <Table aria-label="Kárdex">
          <thead>
            <tr>
              <Th className="w-24">Fecha</Th><Th className="w-24">Documento</Th><Th className="w-16">Bodega</Th><Th>Referencia / lote</Th>
              <Th className="w-24 text-right">Entradas</Th><Th className="w-24 text-right">Salidas</Th><Th className="w-24 text-right">Saldo</Th>
              {costs && <><Th className="w-24 text-right">Costo unit.</Th><Th className="w-28 text-right">Debe</Th><Th className="w-28 text-right">Haber</Th><Th className="w-28 text-right">Saldo valor</Th></>}
            </tr>
          </thead>
          <tbody>
            <tr className="font-medium">
              <Td colSpan={6}>Saldo inicial</Td><Td className="text-right tabular-nums">{formatQty(k.opening.quantity)}</Td>
              {costs && <><Td colSpan={3} /><MoneyTd value={k.opening.value} showZero /></>}
            </tr>
            {k.rows.map((r) => (
              <tr key={r.movementId} className={cx(r.isReversal && 'italic text-gray-500')}>
                <Td>{formatDate(r.date)}</Td><Td className="font-mono text-xs">{r.typeCode} {r.number}</Td>
                <Td className="font-mono text-xs">{r.warehouseCode}</Td>
                <Td>{[r.isReversal ? 'Anulación' : r.reference, r.lotNo && `Lote ${r.lotNo}`].filter(Boolean).join(' · ')}</Td>
                <Td className="text-right tabular-nums">{r.inQty !== '0.00000' ? formatQty(r.inQty) : ''}</Td>
                <Td className="text-right tabular-nums">{r.outQty !== '0.00000' ? formatQty(r.outQty) : ''}</Td>
                <Td className="text-right tabular-nums">{formatQty(r.balanceQty)}</Td>
                {costs && <><Td className="text-right tabular-nums">{formatCost(r.unitCost)}</Td><MoneyTd value={r.inValue} /><MoneyTd value={r.outValue} /><MoneyTd value={r.balanceValue} showZero /></>}
              </tr>
            ))}
            <tr className="font-semibold">
              <Td colSpan={6}>Saldo final</Td><Td className="text-right tabular-nums">{formatQty(k.closing.quantity)}</Td>
              {costs && <><Td colSpan={3} /><MoneyTd value={k.closing.value} bold showZero /></>}
            </tr>
          </tbody>
        </Table>
      )}
    </ReportShell>
  )
}
