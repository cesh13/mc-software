import { Decimal } from 'decimal.js'
import { and, asc, eq, lte, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { toMoney, toQty, type Kardex, type kardexQuery } from '@accounting/shared'
import { invDocuments as d, invMovementTypes as t, invMovements as m, invWarehouses as w } from '../schema.js'
import type { Ctx } from '../lib/context.js'
import { getItem } from './items.js'

// Kárdex of one item: opening balance before `from`, every movement in the
// range with its frozen cost, running balance in quantity and value.
export function kardexReport(ctx: Ctx, q: z.output<typeof kardexQuery>): Kardex {
  const item = getItem(ctx, q.itemId)
  const conds: SQL[] = [eq(m.empresaId, ctx.empresaId), eq(m.itemId, q.itemId), lte(m.date, q.to)]
  if (q.warehouseId) conds.push(eq(m.warehouseId, q.warehouseId))
  const rows = ctx.db.select({
    id: m.id, documentId: m.documentId, date: m.date, direction: m.direction, quantity: m.quantity,
    unitCost: m.unitCost, totalCost: m.totalCost, lotNo: m.lotNo, reversalOf: m.reversalOf,
    typeCode: t.code, number: d.number, reference: d.reference, warehouseCode: w.code,
  }).from(m)
    .innerJoin(d, eq(d.id, m.documentId))
    .innerJoin(t, eq(t.id, d.typeId))
    .innerJoin(w, eq(w.id, m.warehouseId))
    .where(and(...conds))
    .orderBy(asc(m.date), asc(m.createdAt), asc(m.lineNo), asc(m.direction))
    .all()
  let qty = new Decimal(0)
  let value = new Decimal(0)
  let opening: Kardex['opening'] | null = null
  const out: Kardex['rows'] = []
  for (const r of rows) {
    if (r.date >= q.from && !opening) opening = { quantity: toQty(qty), value: toMoney(value) }
    const sign = r.direction === 'in' ? 1 : -1
    qty = qty.plus(new Decimal(r.quantity).mul(sign))
    value = value.plus(new Decimal(r.totalCost).mul(sign))
    if (r.date < q.from) continue
    out.push({
      movementId: r.id, documentId: r.documentId, date: r.date, typeCode: r.typeCode, number: r.number,
      warehouseCode: r.warehouseCode, lotNo: r.lotNo, reference: r.reference,
      inQty: r.direction === 'in' ? toQty(r.quantity) : toQty(0),
      outQty: r.direction === 'out' ? toQty(r.quantity) : toQty(0),
      balanceQty: toQty(qty), unitCost: r.unitCost,
      inValue: r.direction === 'in' ? r.totalCost : '0.00', outValue: r.direction === 'out' ? r.totalCost : '0.00',
      balanceValue: toMoney(value), isReversal: !!r.reversalOf,
    })
  }
  return {
    item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
    opening: opening ?? { quantity: toQty(qty), value: toMoney(value) },
    rows: out,
    closing: { quantity: toQty(qty), value: toMoney(value) },
  }
}

export function redactKardex(k: Kardex): Kardex {
  return {
    ...k, opening: { ...k.opening, value: '' }, closing: { ...k.closing, value: '' },
    rows: k.rows.map((r) => ({ ...r, unitCost: '', inValue: '', outValue: '', balanceValue: '' })),
  }
}
