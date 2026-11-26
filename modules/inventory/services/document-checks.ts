import { inArray, and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { documentInput, PartiesLookup } from '@accounting/shared'
import { RuleError } from '@accounting/shared/server'
import { invItems as i } from '../schema.js'
import { settingsOf, type Ctx } from '../lib/context.js'
import { movementTypes, warehouses } from './catalogs.js'
import { shortages, type StockKey } from './stock.js'

export type DocInput = z.output<typeof documentInput>
type ItemRow = typeof i.$inferSelect

// Everything a document needs, loaded and validated before the transaction.
export function loadDocumentRefs(ctx: Ctx, input: DocInput) {
  const type = movementTypes.get(ctx, input.typeId)
  if (!type.isActive) throw new RuleError(`El tipo de movimiento ${type.code} está inactivo.`, 409, 'type_inactive')
  const warehouse = warehouses.get(ctx, input.warehouseId)
  if (!warehouse.isActive) throw new RuleError(`La bodega ${warehouse.code} está inactiva.`, 409, 'warehouse_inactive')
  let dest = null
  if (type.direction === 'transfer') {
    if (!input.destWarehouseId) throw new RuleError('Elija la bodega de destino.', 400, 'dest_required')
    if (input.destWarehouseId === input.warehouseId) {
      throw new RuleError('La bodega de destino debe ser distinta de la de origen.', 400, 'dest_invalid')
    }
    dest = warehouses.get(ctx, input.destWarehouseId)
    if (!dest.isActive) throw new RuleError(`La bodega ${dest.code} está inactiva.`, 409, 'warehouse_inactive')
  }
  let party = null
  if (input.partyId) {
    const lookup = ctx.services.get<PartiesLookup>('parties', ctx)
    party = lookup?.get(ctx.db, input.partyId) ?? null
    if (!party) throw new RuleError('El proveedor o tercero no existe.', 400, 'party_invalid')
  }
  const ids = [...new Set(input.lines.map((l) => l.itemId))]
  const rows = ctx.db.select().from(i).where(and(eq(i.empresaId, ctx.empresaId), inArray(i.id, ids))).all()
  const items = new Map<string, ItemRow>(rows.map((r) => [r.id, r]))
  input.lines.forEach((line, n) => checkLine(items.get(line.itemId), line, n + 1, type.direction))
  return { type, warehouse, dest, party, items }
}

function checkLine(item: ItemRow | undefined, line: DocInput['lines'][number], n: number, direction: string): void {
  if (!item) throw new RuleError(`Línea ${n}: el producto no existe.`, 400, 'item_invalid')
  if (!item.isActive) throw new RuleError(`Línea ${n}: el producto ${item.code} está inactivo.`, 409, 'item_inactive')
  if (item.isService) throw new RuleError(`Línea ${n}: ${item.code} es un servicio y no lleva existencias.`, 409, 'item_service')
  if (item.tracksLots && !line.lotNo) throw new RuleError(`Línea ${n}: ${item.code} lleva lote; escriba el número de lote.`, 400, 'lot_required')
  if (direction === 'in' && (line.unitCost === null || line.unitCost === undefined)) {
    throw new RuleError(`Línea ${n}: escriba el costo unitario de ${item.code}.`, 400, 'cost_required')
  }
}

// Blocks a salida (or the void of an entrada) that leaves a warehouse below zero,
// unless the empresa allows it or the caller asked to and has inv.stock.negative (P11).
export function assertStock(ctx: Ctx, outs: (StockKey & { quantity: string })[], allowNegative: boolean | undefined, codes: Map<string, string>) {
  if (!outs.length) return
  const policy = settingsOf(ctx).get<string>('inventory', 'negativeStock')
  if (policy === 'permitir') return
  if (allowNegative && ctx.can('inv.stock.negative')) return
  const short = shortages(ctx, outs)
  if (!short.length) return
  const detail = short.slice(0, 5).map((s) =>
    `${codes.get(s.key.itemId) ?? s.key.itemId}${s.key.lotNo ? ` lote ${s.key.lotNo}` : ''}: hay ${trim(s.available)}, se necesitan ${trim(s.needed)}`,
  ).join('; ')
  throw new RuleError(`Existencia insuficiente. ${detail}.`, 409, 'insufficient_stock')
}

const trim = (q: string) => (q.includes('.') ? q.replace(/\.?0+$/, '') : q)

export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
