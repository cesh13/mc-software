'use client'

import { useState } from 'react'
import { useEmpresa } from '@/lib/empresa'
import { errorMessage } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { usePermissions } from '@/lib/permissions'
import { useWorkPeriod } from '@/lib/work-period'
import { cx } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Field, Select } from '@/components/ui/form'
import { PeriodInput } from '@/components/ui/date-input'
import { Table, Td, Th, rowClass } from '@/components/ui/table'
import { ActionToolbar } from '@/components/ui/toolbar'
import { DocumentEditor } from './DocumentEditor'
import { DocumentView } from './DocumentView'
import { useCatalog, useDocuments } from './use-inventory'

export const lastDay = (period: string) => {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'view'; id: string }

// Entradas, salidas, ajustes y transferencias (legacy inmmov01/inmmov05/inmmov03).
export function DocumentsScreen() {
  const { empresa } = useEmpresa()
  const { can } = usePermissions()
  const [period, setPeriod] = useWorkPeriod()
  const [typeId, setTypeId] = useState('')
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const types = useCatalog('movement-types', true)
  const docs = useDocuments({ from: `${period}-01`, to: lastDay(period), typeId: typeId || undefined })

  if (mode.kind === 'new') {
    return <DocumentEditor onClose={() => setMode({ kind: 'list' })} onSaved={(id) => setMode({ kind: 'view', id })} />
  }
  if (mode.kind === 'view') return <DocumentView id={mode.id} onClose={() => setMode({ kind: 'list' })} />

  const rows = docs.data ?? []
  return (
    <div>
      <PageHeader title="Movimientos de inventario" subtitle={empresa.name} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <ActionToolbar actions={{ agregar: can('inv.document.create') ? () => setMode({ kind: 'new' }) : undefined }} />
        <Field label="Mes"><PeriodInput value={period} onChange={setPeriod} /></Field>
        <Field label="Tipo">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Todos</option>
            {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
          </Select>
        </Field>
      </div>
      {docs.isLoading && <Loading />}
      {docs.error != null && <Alert>{errorMessage(docs.error)}</Alert>}
      {docs.data && rows.length === 0 && <p className="py-6 text-sm text-gray-500">No hay movimientos en el mes.</p>}
      {rows.length > 0 && (
        <Table aria-label="Movimientos">
          <thead>
            <tr>
              <Th className="w-24">Fecha</Th><Th className="w-16">Tipo</Th><Th className="w-20">Número</Th>
              <Th>Descripción</Th><Th className="w-20">Bodega</Th><Th>Referencia</Th>
              <Th className="w-14 text-right">Líneas</Th><Th className="w-28 text-right">Costo total</Th><Th className="w-20">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={cx(rowClass, 'cursor-pointer', d.status === 'anulado' && 'text-gray-400 line-through')}
                onDoubleClick={() => setMode({ kind: 'view', id: d.id })} onClick={() => setMode({ kind: 'view', id: d.id })}>
                <Td>{formatDate(d.date)}</Td>
                <Td className="font-mono text-xs">{d.typeCode}</Td>
                <Td className="font-mono text-xs">{d.number}</Td>
                <Td>{d.typeName}{d.partyName ? ` · ${d.partyName}` : ''}</Td>
                <Td className="font-mono text-xs">{d.warehouseCode}{d.destWarehouseCode ? ` → ${d.destWarehouseCode}` : ''}</Td>
                <Td>{d.reference ?? ''}</Td>
                <Td className="text-right tabular-nums">{d.lineCount}</Td>
                <Td className="text-right tabular-nums">{formatMoney(d.totalCost)}</Td>
                <Td className="no-underline">{d.status === 'anulado' ? 'Anulado' : 'Aplicado'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
