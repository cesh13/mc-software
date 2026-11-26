import { Decimal } from 'decimal.js'
import { and, eq } from 'drizzle-orm'
import { toMoney, toQty } from '@accounting/shared'
import { nowIso } from '@accounting/shared/server'
import { invCostState as s } from '../schema.js'
import type { Ctx } from '../lib/context.js'

// Moving average per item across warehouses (contratos.md §3, P10). Every
// change goes through here, in the caller's transaction, so `value` is always
// the exact sum of the movements' frozen totals.
export type CostState = { quantity: string; value: string; averageCost: string; lastCost: string | null }

const COST_PLACES = 5
const unit = (v: Decimal.Value) => new Decimal(v).toFixed(COST_PLACES, Decimal.ROUND_HALF_UP)

export function costState(ctx: Ctx, itemId: string): CostState {
  const row = ctx.db.select().from(s).where(and(eq(s.empresaId, ctx.empresaId), eq(s.itemId, itemId))).get()
  return row ?? { quantity: toQty(0), value: toMoney(0), averageCost: unit(0), lastCost: null }
}

function save(ctx: Ctx, itemId: string, next: CostState): void {
  const values = { ...next, updatedAt: nowIso() }
  ctx.db.insert(s).values({ empresaId: ctx.empresaId, itemId, ...values })
    .onConflictDoUpdate({ target: [s.empresaId, s.itemId], set: values }).run()
}

function averaged(qty: Decimal, value: Decimal, fallback: string): string {
  return qty.gt(0) ? unit(value.div(qty)) : fallback
}

// Entry at a given unit cost (or with a known total, for reversals of salidas).
export function costIn(ctx: Ctx, itemId: string, quantity: string, cost: { unitCost: string } | { total: string }) {
  const st = costState(ctx, itemId)
  const total = 'total' in cost ? toMoney(cost.total) : toMoney(new Decimal(quantity).mul(cost.unitCost))
  const unitCost = 'unitCost' in cost ? unit(cost.unitCost) : unit(new Decimal(quantity).isZero() ? 0 : new Decimal(total).div(quantity))
  const qty = new Decimal(st.quantity).plus(quantity)
  const value = new Decimal(st.value).plus(total)
  save(ctx, itemId, {
    quantity: toQty(qty), value: toMoney(value), averageCost: averaged(qty, value, unitCost),
    lastCost: 'unitCost' in cost ? unitCost : st.lastCost,
  })
  return { unitCost, total }
}

// Salida at the average in force now. Taking the whole stock takes the whole
// value, so no cents are left behind. `total` is given for reversals of entradas.
export function costOut(ctx: Ctx, itemId: string, quantity: string, known?: { total: string }) {
  const st = costState(ctx, itemId)
  const q = new Decimal(quantity)
  const onHand = new Decimal(st.quantity)
  let total: string
  if (known) total = toMoney(known.total)
  else if (onHand.gt(0) && q.equals(onHand)) total = toMoney(st.value)
  else total = toMoney(q.mul(st.averageCost))
  const unitCost = q.isZero() ? unit(0) : unit(new Decimal(total).div(q))
  const qty = onHand.minus(q)
  const value = new Decimal(st.value).minus(total)
  save(ctx, itemId, { quantity: toQty(qty), value: toMoney(value), averageCost: averaged(qty, value, st.averageCost), lastCost: st.lastCost })
  return { unitCost, total }
}
