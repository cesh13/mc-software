'use client'

import { useId } from 'react'
import { Trash2 } from 'lucide-react'
import type { Item } from '@accounting/shared'
import { Input } from '@/components/ui/form'
import { DateInput } from '@/components/ui/date-input'
import { Td, Th } from '@/components/ui/table'
import { formatQty } from './format'
import { useItemStock } from './use-inventory'

export type DraftLine = { key: number; code: string; itemId: string | null; quantity: string; unitCost: string; lotNo: string; expiresOn: string }

let seq = 0
export const blankLine = (): DraftLine => ({ key: ++seq, code: '', itemId: null, quantity: '', unitCost: '', lotNo: '', expiresOn: '' })

// Capture grid (legacy inmmov02): code, quantity, cost on entradas, lot when the item tracks it,
// and the stock on hand in the chosen warehouse.
export function LinesGrid(p: { lines: DraftLine[]; items: Item[]; warehouseId: string; withCost: boolean; onChange: (lines: DraftLine[]) => void }) {
  const listId = useId()
  const byCode = new Map(p.items.map((i) => [i.code, i]))
  const byId = new Map(p.items.map((i) => [i.id, i]))
  const update = (key: number, patch: Partial<DraftLine>) => {
    const next = p.lines.map((l) => (l.key === key ? { ...l, ...patch } : l))
    // Always keep one empty row at the end for the next product.
    if (next[next.length - 1]?.itemId) next.push(blankLine())
    p.onChange(next)
  }
  const remove = (key: number) => {
    const next = p.lines.filter((l) => l.key !== key)
    p.onChange(next.length ? next : [blankLine()])
  }
  return (
    <div className="overflow-auto rounded-md border border-gray-200 bg-white">
      <datalist id={listId}>
        {p.items.map((i) => <option key={i.id} value={i.code}>{i.name}</option>)}
      </datalist>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th className="w-8">#</Th><Th className="w-40">Código</Th><Th>Descripción</Th><Th className="w-20">Unidad</Th>
            <Th className="w-28 text-right">Existencia</Th><Th className="w-28 text-right">Cantidad</Th>{p.withCost && <Th className="w-28 text-right">Costo unitario</Th>}
            <Th className="w-28">Lote</Th><Th className="w-36">Vence</Th><Th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, n) => {
            const item = l.itemId ? byId.get(l.itemId) : undefined
            const lots = !!item?.tracksLots
            return (
              <tr key={l.key}>
                <Td className="text-xs text-gray-400">{n + 1}</Td>
                <Td>
                  <Input
                    list={listId} value={l.code} aria-label={`Código línea ${n + 1}`} className="font-mono uppercase"
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase()
                      update(l.key, { code, itemId: byCode.get(code)?.id ?? null })
                    }}
                  />
                </Td>
                <Td className={item ? '' : 'text-xs italic text-gray-400'}>{item?.name ?? (l.code ? 'Código no encontrado' : '')}</Td>
                <Td className="text-xs">{item?.unit ?? ''}</Td>
                <StockTd itemId={item ? item.id : null} warehouseId={p.warehouseId} />
                <Td><Input value={l.quantity} inputMode="decimal" className="text-right tabular-nums" aria-label={`Cantidad línea ${n + 1}`}
                  onChange={(e) => update(l.key, { quantity: e.target.value })} /></Td>
                {p.withCost && (
                  <Td><Input value={l.unitCost} inputMode="decimal" className="text-right tabular-nums" aria-label={`Costo línea ${n + 1}`}
                    onChange={(e) => update(l.key, { unitCost: e.target.value })} /></Td>
                )}
                <Td><Input value={l.lotNo} disabled={!lots} maxLength={30} aria-label={`Lote línea ${n + 1}`}
                  onChange={(e) => update(l.key, { lotNo: e.target.value })} /></Td>
                <Td><DateInput value={l.expiresOn} disabled={!lots || !p.withCost} aria-label={`Vencimiento línea ${n + 1}`}
                  onChange={(iso) => update(l.key, { expiresOn: iso })} /></Td>
                <Td>
                  {(l.code || l.quantity) && (
                    <button aria-label={`Quitar línea ${n + 1}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" onClick={() => remove(l.key)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StockTd({ itemId, warehouseId }: { itemId: string | null; warehouseId: string }) {
  const stock = useItemStock(itemId, warehouseId)
  return <Td className="text-right text-xs tabular-nums text-gray-600">{stock.data ? formatQty(stock.data.onHand) : ''}</Td>
}
