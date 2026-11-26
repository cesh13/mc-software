import { Decimal } from 'decimal.js'
import { and, asc, eq, lte, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { toMoney, toQty, type StockRow, type stockQuery, type Valuation, type valuationQuery } from '@accounting/shared'
import { invGroups as g, invItems as i, invMovements as m, invWarehouses as w } from '../schema.js'
import type { Ctx } from '../lib/context.js'
import { accountCodes } from './common.js'

type Sum = { qty: Decimal; value: Decimal; expiresOn: string | null }

// Signed sums of movements up to `at`, grouped by `keyOf`.
function sums(ctx: Ctx, at: string, keyOf: (r: { itemId: string; warehouseId: string; lotNo: string | null }) => string, warehouseId?: string) {
  const conds: SQL[] = [eq(m.empresaId, ctx.empresaId), lte(m.date, at)]
  if (warehouseId) conds.push(eq(m.warehouseId, warehouseId))
  const rows = ctx.db.select({
    itemId: m.itemId, warehouseId: m.warehouseId, lotNo: m.lotNo, expiresOn: m.expiresOn,
    direction: m.direction, quantity: m.quantity, totalCost: m.totalCost,
  }).from(m).where(and(...conds)).all()
  const out = new Map<string, Sum>()
  for (const r of rows) {
    const k = keyOf(r)
    const s = out.get(k) ?? { qty: new Decimal(0), value: new Decimal(0), expiresOn: null }
    const sign = r.direction === 'in' ? 1 : -1
    s.qty = s.qty.plus(new Decimal(r.quantity).mul(sign))
    s.value = s.value.plus(new Decimal(r.totalCost).mul(sign))
    if (r.expiresOn && r.direction === 'in') s.expiresOn = r.expiresOn
    out.set(k, s)
  }
  return out
}

function items(ctx: Ctx, groupId?: string) {
  const conds: SQL[] = [eq(i.empresaId, ctx.empresaId), eq(i.isService, false)]
  if (groupId) conds.push(eq(i.groupId, groupId))
  return ctx.db.select({
    id: i.id, code: i.code, name: i.name, unit: i.unit, minQty: i.minQty, isActive: i.isActive,
    groupCode: g.code, inv: i.inventoryAccountId, gInv: g.inventoryAccountId,
  }).from(i).leftJoin(g, eq(g.id, i.groupId)).where(and(...conds)).orderBy(asc(i.code)).all()
}

// Existencias at a date, by item and warehouse (and lot when asked).
export function stockReport(ctx: Ctx, q: z.output<typeof stockQuery>): StockRow[] {
  const byLot = q.lots === '1'
  const s = sums(ctx, q.at, (r) => `${r.itemId}|${r.warehouseId}|${byLot ? r.lotNo ?? '' : ''}`, q.warehouseId)
  const whs = new Map(ctx.db.select().from(w).where(eq(w.empresaId, ctx.empresaId)).all().map((x) => [x.id, x]))
  const keysByItem = new Map<string, string[]>()
  for (const k of s.keys()) {
    const itemId = k.split('|')[0]!
    keysByItem.set(itemId, [...(keysByItem.get(itemId) ?? []), k])
  }
  const rows: StockRow[] = []
  for (const it of items(ctx, q.groupId)) {
    const keys = keysByItem.get(it.id) ?? []
    const base = { itemId: it.id, itemCode: it.code, itemName: it.name, unit: it.unit, groupCode: it.groupCode, minQty: it.minQty }
    let shown = 0
    for (const k of keys) {
      const v = s.get(k)!
      if (v.qty.isZero() && q.zero !== '1') continue
      const [, whId, lotNo] = k.split('|')
      const wh = whs.get(whId!)
      rows.push({
        ...base, warehouseId: whId!, warehouseCode: wh?.code ?? null, lotNo: lotNo || null,
        expiresOn: lotNo ? v.expiresOn : null, quantity: toQty(v.qty),
        belowMin: !!it.minQty && v.qty.lt(it.minQty),
      })
      shown++
    }
    if (!shown && q.zero === '1' && it.isActive) {
      rows.push({ ...base, warehouseId: null, warehouseCode: null, lotNo: null, expiresOn: null, quantity: toQty(0), belowMin: !!it.minQty && new Decimal(it.minQty).gt(0) })
    }
  }
  return rows
}

// Valuation at a date: Σ frozen totals, so it matches the entries posted.
export function valuationReport(ctx: Ctx, q: z.output<typeof valuationQuery>): Valuation {
  const s = sums(ctx, q.at, (r) => r.itemId)
  const accounts = accountCodes(ctx)
  const byAccount = new Map<string | null, Decimal>()
  const rows: Valuation['rows'] = []
  let total = new Decimal(0)
  for (const it of items(ctx, q.groupId)) {
    const v = s.get(it.id)
    if (!v || (v.qty.isZero() && v.value.isZero())) continue
    const accountId = it.inv ?? it.gInv ?? null
    rows.push({
      itemId: it.id, itemCode: it.code, itemName: it.name, unit: it.unit, groupCode: it.groupCode,
      inventoryAccountCode: accountId ? accounts.get(accountId)?.code ?? null : null,
      quantity: toQty(v.qty), averageCost: v.qty.gt(0) ? v.value.div(v.qty).toFixed(5) : '0.00000', value: toMoney(v.value),
    })
    byAccount.set(accountId, (byAccount.get(accountId) ?? new Decimal(0)).plus(v.value))
    total = total.plus(v.value)
  }
  return {
    at: q.at, rows, total: toMoney(total),
    byAccount: [...byAccount].map(([accountId, value]) => ({
      accountId, accountCode: accountId ? accounts.get(accountId)?.code ?? null : null,
      accountName: accountId ? accounts.get(accountId)?.name ?? null : null, value: toMoney(value),
    })).sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
  }
}
