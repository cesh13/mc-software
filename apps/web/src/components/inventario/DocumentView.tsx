'use client'

import { useState } from 'react'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { formatDate } from '@/lib/format'
import { usePermissions } from '@/lib/permissions'
import { openPrintPreview } from '@/lib/print'
import { Button } from '@/components/ui/button'
import { Alert, Dialog, Loading, PageHeader } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/form'
import { MoneyTd, Table, Td, Th } from '@/components/ui/table'
import { ActionToolbar } from '@/components/ui/toolbar'
import { formatCost, formatQty } from './format'
import { INV_API, useDocument, useInvMutation } from './use-inventory'

export function DocumentView({ id, onClose }: { id: string; onClose: () => void }) {
  const { empresa } = useEmpresa()
  const { can } = usePermissions()
  const doc = useDocument(id)
  const [voiding, setVoiding] = useState(false)
  const d = doc.data
  const costs = d ? d.totalCost !== '' : false
  return (
    <div>
      <h1 className="hidden text-lg font-semibold print:block">{empresa.name}</h1>
      <PageHeader title={d ? `${d.typeCode} ${d.number} - ${d.typeName}` : 'Movimiento'} subtitle={d?.status === 'anulado' ? 'ANULADO' : empresa.name} />
      <div className="mb-3">
        <ActionToolbar actions={{
          eliminar: d && d.status === 'aplicado' && can('inv.document.void') ? () => setVoiding(true) : undefined,
          imprimir: openPrintPreview, cancelar: onClose,
        }} />
      </div>
      {doc.isLoading && <Loading />}
      {doc.error != null && <Alert>{errorMessage(doc.error)}</Alert>}
      {d && (
        <>
          <dl className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm lg:grid-cols-4">
            <Item label="Fecha" value={formatDate(d.date)} />
            <Item label="Bodega" value={d.destWarehouseCode ? `${d.warehouseCode} → ${d.destWarehouseCode}` : d.warehouseCode} />
            <Item label="Referencia" value={d.reference ?? ''} />
            <Item label="Partida" value={d.entry ? `${d.entry.number} (${d.entry.period})` : 'Sin partida'} />
            {d.notes && <Item label="Observaciones" value={d.notes} />}
            {d.voidReason && <Item label="Motivo de anulación" value={d.voidReason} />}
          </dl>
          <Table aria-label="Líneas">
            <thead>
              <tr>
                <Th className="w-8">#</Th><Th className="w-36">Código</Th><Th>Descripción</Th><Th className="w-20">Unidad</Th>
                <Th className="w-24">Lote</Th><Th className="w-24">Vence</Th><Th className="w-28 text-right">Cantidad</Th>
                {costs && <><Th className="w-28 text-right">Costo unitario</Th><Th className="w-28 text-right">Costo total</Th></>}
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.lineNo}>
                  <Td className="text-xs text-gray-400">{l.lineNo}</Td>
                  <Td className="font-mono text-xs">{l.itemCode}</Td><Td>{l.itemName}</Td><Td className="text-xs">{l.unit}</Td>
                  <Td>{l.lotNo ?? ''}</Td><Td>{formatDate(l.expiresOn)}</Td>
                  <Td className="text-right tabular-nums">{formatQty(l.quantity)}</Td>
                  {costs && <><Td className="text-right tabular-nums">{formatCost(l.unitCost)}</Td><MoneyTd value={l.totalCost} showZero /></>}
                </tr>
              ))}
              {costs && (
                <tr><Td colSpan={8} className="text-right font-semibold">Total</Td><MoneyTd value={d.totalCost} bold showZero /></tr>
              )}
            </tbody>
          </Table>
        </>
      )}
      {voiding && d && <VoidDialog id={d.id} label={`${d.typeCode} ${d.number}`} onClose={() => setVoiding(false)} />}
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div><dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt><dd>{value}</dd></div>
  )
}

function VoidDialog({ id, label, onClose }: { id: string; label: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const voidDoc = useInvMutation((r: string) => apiFetch(`${INV_API}/documents/${id}/void`, { json: { reason: r } }))
  async function submit() {
    try {
      await voidDoc.mutateAsync(reason)
      onClose()
    } catch {
      // Shown below.
    }
  }
  return (
    <Dialog open title={`Anular ${label}`} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>Cancelar (Esc)</Button>
        <Button variant="danger" disabled={voidDoc.isPending || !reason.trim()} onClick={() => void submit()}>Anular</Button>
      </>
    }>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-700">Se crean movimientos inversos al mismo costo y se anula la partida. Si el mes está cerrado, el reverso queda con fecha de hoy.</p>
        <Field label="Motivo"><Input autoFocus value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></Field>
        {voidDoc.error != null && <Alert>{errorMessage(voidDoc.error)}</Alert>}
      </div>
    </Dialog>
  )
}
