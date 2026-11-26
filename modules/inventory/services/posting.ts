import { Decimal } from 'decimal.js'
import { eq, inArray } from 'drizzle-orm'
import { toMoney, type PostLine } from '@accounting/shared'
import { RuleError, type LedgerPosting } from '@accounting/shared/server'
import { invGroups as g, invItems as i } from '../schema.js'
import { settingsOf, type Ctx } from '../lib/context.js'

// One entry per document, in the same transaction (modulos-y-orden §2.3).
// Inventory owns adjustments, internal consumption, opening balances and, in
// the pilot, purchases (until accounts-payable exists). Transfers move value
// between warehouses of the same item account: they never post.
export type PostingDoc = {
  id: string; number: string; date: string; typeCode: string; typeName: string
  direction: 'in' | 'out' | 'transfer'; counterAccountId: string | null
  lines: { itemId: string; total: string }[]
}

export const ledgerOf = (ctx: Ctx) => ctx.services.require<LedgerPosting>('ledger', ctx)
export const SOURCE = 'inventario' as const

export function postingEnabled(ctx: Ctx): boolean {
  return settingsOf(ctx).get<boolean>('inventory', 'postToGl')
}

function accountsOf(ctx: Ctx, itemIds: string[]) {
  const rows = ctx.db.select({
    id: i.id, code: i.code, inv: i.inventoryAccountId, cogs: i.cogsAccountId, gInv: g.inventoryAccountId, gCogs: g.cogsAccountId,
  }).from(i).leftJoin(g, eq(g.id, i.groupId)).where(inArray(i.id, itemIds)).all()
  return new Map(rows.map((r) => [r.id, { code: r.code, inventory: r.inv ?? r.gInv, cogs: r.cogs ?? r.gCogs }]))
}

// Balanced lines for the document, or null when there is nothing to post.
export function entryLines(ctx: Ctx, doc: PostingDoc): PostLine[] | null {
  if (doc.direction === 'transfer') return null
  const accounts = accountsOf(ctx, [...new Set(doc.lines.map((l) => l.itemId))])
  const net = new Map<string, Decimal>() // debit positive
  const add = (account: string, amount: Decimal) => net.set(account, (net.get(account) ?? new Decimal(0)).plus(amount))
  for (const line of doc.lines) {
    const a = accounts.get(line.itemId)!
    if (!a.inventory) {
      throw new RuleError(`El producto ${a.code} no tiene cuenta de inventario (ni su grupo).`, 409, 'item_account_missing')
    }
    const counter = doc.counterAccountId ?? (doc.direction === 'out' ? a.cogs : null)
    if (!counter) {
      throw new RuleError(
        doc.direction === 'out'
          ? `Ni el tipo ${doc.typeCode} ni el producto ${a.code} tienen cuenta de costo o contrapartida.`
          : `El tipo de movimiento ${doc.typeCode} no tiene contrapartida contable.`,
        409, 'counter_account_missing',
      )
    }
    const amount = new Decimal(line.total)
    const sign = doc.direction === 'in' ? 1 : -1
    add(a.inventory, amount.mul(sign))
    add(counter, amount.mul(-sign))
  }
  const lines: PostLine[] = []
  for (const [accountId, v] of net) {
    if (v.isZero()) continue
    lines.push({ accountId, debit: v.gt(0) ? toMoney(v) : '0.00', credit: v.lt(0) ? toMoney(v.neg()) : '0.00' })
  }
  return lines.length >= 2 ? lines : null
}

export function postDocument(ctx: Ctx, doc: PostingDoc) {
  if (!postingEnabled(ctx)) return null
  const lines = entryLines(ctx, doc)
  if (!lines) return null
  const entryTypeId = settingsOf(ctx).get<string | null>('inventory', 'entryTypeId')
  if (!entryTypeId) {
    throw new RuleError(
      'Falta elegir el tipo de partida de inventario (Inventario › Configuración) o desactivar la contabilización.',
      409, 'entry_type_missing',
    )
  }
  return ledgerOf(ctx).post({
    source: SOURCE, sourceRef: doc.id, entryTypeId, date: doc.date,
    concept: `Inventario ${doc.typeCode} ${doc.number} ${doc.typeName}`.slice(0, 120), lines,
  })
}

export function voidPosting(ctx: Ctx, docId: string, date: string, reason: string) {
  const ledger = ledgerOf(ctx)
  const ref = { source: SOURCE, sourceRef: docId }
  return ledger.find(ref) ? ledger.void(ref, { date, reason }) : null
}
