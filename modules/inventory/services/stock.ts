import { Decimal } from 'decimal.js'
import { and, eq, lte, type SQL } from 'drizzle-orm'
import { toQty } from '@accounting/shared'
import { invMovements as m } from '../schema.js'
import type { Ctx } from '../lib/context.js'

// Stock is never stored: it is the signed sum of the movements (modulos-y-orden §2.5).
// Sums are done with decimal.js because SQLite would add the TEXT decimals as floats.
export type StockKey = { itemId: string; warehouseId: string; lotNo: string | null }

export function onHand(ctx: Ctx, q: { itemId: string; warehouseId?: string; lotNo?: string | null; at?: string }): string {
  const conds: SQL[] = [eq(m.empresaId, ctx.empresaId), eq(m.itemId, q.itemId)]
  if (q.warehouseId) conds.push(eq(m.warehouseId, q.warehouseId))
  if (q.lotNo !== undefined && q.lotNo !== null) conds.push(eq(m.lotNo, q.lotNo))
  if (q.at) conds.push(lte(m.date, q.at))
  const rows = ctx.db.select({ d: m.direction, q: m.quantity }).from(m).where(and(...conds)).all()
  return toQty(rows.reduce((acc, r) => (r.d === 'in' ? acc.plus(r.q) : acc.minus(r.q)), new Decimal(0)))
}

export const stockKey = (k: StockKey) => `${k.itemId}|${k.warehouseId}|${k.lotNo ?? ''}`

// Outgoing quantities that would leave a warehouse (or lot) below zero.
export function shortages(ctx: Ctx, outs: (StockKey & { quantity: string })[]) {
  const need = new Map<string, { key: StockKey; qty: Decimal }>()
  for (const o of outs) {
    const k = stockKey(o)
    const cur = need.get(k)
    need.set(k, { key: o, qty: (cur?.qty ?? new Decimal(0)).plus(o.quantity) })
  }
  const short: { key: StockKey; available: string; needed: string }[] = []
  for (const { key, qty } of need.values()) {
    const available = onHand(ctx, { itemId: key.itemId, warehouseId: key.warehouseId, lotNo: key.lotNo })
    if (new Decimal(available).lt(qty)) short.push({ key, available, needed: toQty(qty) })
  }
  return short
}
