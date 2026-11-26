'use client'

import { useState } from 'react'
import type { InvDocument } from '@accounting/shared'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { usePermissions } from '@/lib/permissions'
import { Alert, PageHeader } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { DateInput } from '@/components/ui/date-input'
import { ActionToolbar } from '@/components/ui/toolbar'
import { parseQtyInput, todayIso } from './format'
import { blankLine, LinesGrid, type DraftLine } from './LinesGrid'
import { INV_API, useCatalog, useInvMutation, useItems } from './use-inventory'

// New movement document. It is applied (stock, cost and entry) when saved.
export function DocumentEditor({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { empresa } = useEmpresa()
  const { can } = usePermissions()
  const types = useCatalog('movement-types')
  const warehouses = useCatalog('warehouses')
  const items = useItems()
  const [h, setH] = useState({ typeId: '', date: todayIso(), warehouseId: '', destWarehouseId: '', reference: '', notes: '' })
  const [lines, setLines] = useState<DraftLine[]>([blankLine()])
  const [allowNegative, setAllowNegative] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const save = useInvMutation((body: unknown) => apiFetch<InvDocument>(`${INV_API}/documents`, { json: body }))
  const type = types.data?.find((t) => t.id === h.typeId)
  const withCost = type?.direction === 'in'
  const set = (patch: Partial<typeof h>) => setH((cur) => ({ ...cur, ...patch }))

  function build(): unknown | string {
    if (!type) return 'Elija el tipo de movimiento.'
    if (!h.date) return 'Escriba la fecha (dd/mm/aaaa).'
    if (!h.warehouseId) return 'Elija la bodega.'
    if (type.direction === 'transfer' && !h.destWarehouseId) return 'Elija la bodega de destino.'
    const used = lines.filter((l) => l.code || l.quantity)
    if (!used.length) return 'Agregue al menos una línea.'
    const out = []
    for (const [n, l] of used.entries()) {
      if (!l.itemId) return `Línea ${n + 1}: el código ${l.code || '(vacío)'} no existe.`
      const quantity = parseQtyInput(l.quantity)
      if (!quantity || /^0*\.?0*$/.test(quantity)) return `Línea ${n + 1}: escriba una cantidad mayor que cero.`
      const unitCost = withCost ? parseQtyInput(l.unitCost || '0') : null
      if (withCost && unitCost === null) return `Línea ${n + 1}: costo unitario inválido.`
      out.push({ itemId: l.itemId, quantity, unitCost, lotNo: l.lotNo || null, expiresOn: l.expiresOn || null })
    }
    return {
      typeId: type.id, date: h.date, warehouseId: h.warehouseId, destWarehouseId: h.destWarehouseId || null,
      reference: h.reference, notes: h.notes, allowNegative, lines: out,
    }
  }

  async function submit() {
    if (save.isPending) return
    const body = build()
    if (typeof body === 'string') return setLocalError(body)
    setLocalError(null)
    try {
      onSaved((await save.mutateAsync(body)).id)
    } catch {
      // Shown below.
    }
  }

  return (
    <div>
      <PageHeader title="Nuevo movimiento de inventario" subtitle={empresa.name} />
      <div className="mb-3"><ActionToolbar actions={{ grabar: () => void submit(), cancelar: onClose }} /></div>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Tipo de movimiento">
          <Select autoFocus value={h.typeId} onChange={(e) => set({ typeId: e.target.value })}>
            <option value="">Elija…</option>
            {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
          </Select>
        </Field>
        <Field label="Fecha"><DateInput value={h.date} onChange={(date) => set({ date })} /></Field>
        <Field label={type?.direction === 'transfer' ? 'Bodega de origen' : 'Bodega'}>
          <Select value={h.warehouseId} onChange={(e) => set({ warehouseId: e.target.value })}>
            <option value="">Elija…</option>
            {(warehouses.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
          </Select>
        </Field>
        {type?.direction === 'transfer' ? (
          <Field label="Bodega de destino">
            <Select value={h.destWarehouseId} onChange={(e) => set({ destWarehouseId: e.target.value })}>
              <option value="">Elija…</option>
              {(warehouses.data ?? []).filter((w) => w.id !== h.warehouseId).map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={type?.kind === 'compra' ? 'Documento del proveedor' : 'Referencia'}>
            <Input value={h.reference} maxLength={40} onChange={(e) => set({ reference: e.target.value })} />
          </Field>
        )}
        <Field label="Observaciones" className="col-span-2 lg:col-span-4">
          <Input value={h.notes} maxLength={250} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      <LinesGrid lines={lines} items={(items.data ?? []).filter((i) => !i.isService)} warehouseId={h.warehouseId} withCost={withCost} onChange={setLines} />
      <div className="mt-3 flex flex-col gap-2">
        {type && type.direction !== 'in' && can('inv.stock.negative') && (
          <Checkbox label="Permitir grabar aunque no haya existencia suficiente" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} />
        )}
        {type && type.direction !== 'in' && <p className="text-xs text-gray-500">Las salidas se valúan al costo promedio del producto al grabar.</p>}
        {(localError || save.error != null) && <Alert>{localError ?? errorMessage(save.error)}</Alert>}
      </div>
    </div>
  )
}
