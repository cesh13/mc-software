import { Decimal } from 'decimal.js'
import { and, eq, isNull } from 'drizzle-orm'
import { toMoney, toQty } from '@accounting/shared'
import { newId, nowIso, RuleError, type SequencesService } from '@accounting/shared/server'
import { invDocuments as d, invItems as i, invMovements as m } from '../schema.js'
import { auditIn, inTx, periodsOf, type Ctx } from '../lib/context.js'
import { costIn, costOut } from './cost.js'
import { assertStock, loadDocumentRefs, today, type DocInput } from './document-checks.js'
import { postDocument, voidPosting } from './posting.js'
import { notFound } from './common.js'

const SEQ_SCOPE = 'inv_document'

function nextNumber(ctx: Ctx, typeId: string): string {
  const seq = ctx.services.require<SequencesService>('sequences', ctx)
  if (!seq.peek(SEQ_SCOPE, typeId)) seq.define({ scope: SEQ_SCOPE, key: typeId, nextValue: 1, width: 6 })
  return seq.next(SEQ_SCOPE, typeId).formatted
}

type Mov = Omit<typeof m.$inferInsert, 'id' | 'empresaId' | 'documentId' | 'createdAt'>

function insertMovement(ctx: Ctx, documentId: string, mov: Mov): void {
  ctx.db.insert(m).values({ ...mov, id: newId(), empresaId: ctx.empresaId, documentId, createdAt: nowIso() }).run()
}

// Saves and applies a document: numbers it, moves stock at the average cost,
// freezes the costs and posts its entry, all in one transaction.
export function createDocument(ctx: Ctx, input: DocInput): string {
  const { type, warehouse, dest, items } = loadDocumentRefs(ctx, input)
  periodsOf(ctx).assertOpen(input.date, ['inventory'])
  const codes = new Map([...items.values()].map((it) => [it.id, it.code]))
  const lot = (itemId: string, lotNo?: string | null) => (items.get(itemId)!.tracksLots ? lotNo ?? null : null)
  const outs = type.direction === 'in' ? [] : input.lines.map((l) => ({
    itemId: l.itemId, warehouseId: warehouse.id, lotNo: lot(l.itemId, l.lotNo), quantity: l.quantity,
  }))
  assertStock(ctx, outs, input.allowNegative, codes)

  return inTx(ctx, (tx) => {
    const id = newId()
    const number = nextNumber(tx, type.id)
    const now = nowIso()
    tx.db.insert(d).values({
      id, empresaId: tx.empresaId, typeId: type.id, number, date: input.date, warehouseId: warehouse.id,
      destWarehouseId: dest?.id ?? null, partyId: input.partyId ?? null, reference: input.reference ?? null,
      notes: input.notes ?? null, status: 'aplicado', totalCost: '0.00', createdBy: tx.userId, createdAt: now, updatedAt: now,
    }).run()
    const totals: { itemId: string; total: string }[] = []
    input.lines.forEach((l, n) => {
      const base = {
        lineNo: n + 1, itemId: l.itemId, quantity: l.quantity, date: input.date,
        lotNo: lot(l.itemId, l.lotNo), expiresOn: lot(l.itemId, l.lotNo) ? l.expiresOn ?? null : null,
      }
      if (type.direction === 'in') {
        const c = costIn(tx, l.itemId, l.quantity, { unitCost: l.unitCost! })
        insertMovement(tx, id, { ...base, warehouseId: warehouse.id, direction: 'in', unitCost: c.unitCost, totalCost: c.total })
        totals.push({ itemId: l.itemId, total: c.total })
        return
      }
      const c = costOut(tx, l.itemId, l.quantity)
      insertMovement(tx, id, { ...base, warehouseId: warehouse.id, direction: 'out', unitCost: c.unitCost, totalCost: c.total })
      if (type.direction === 'transfer') {
        costIn(tx, l.itemId, l.quantity, { total: c.total })
        insertMovement(tx, id, { ...base, warehouseId: dest!.id, direction: 'in', unitCost: c.unitCost, totalCost: c.total })
      }
      totals.push({ itemId: l.itemId, total: c.total })
    })
    const totalCost = toMoney(totals.reduce((a, t) => a.plus(t.total), new Decimal(0)))
    tx.db.update(d).set({ totalCost }).where(eq(d.id, id)).run()
    const entry = postDocument(tx, {
      id, number, date: input.date, typeCode: type.code, typeName: type.name, direction: type.direction,
      counterAccountId: type.counterAccountId ?? null, lines: totals,
    })
    auditIn(tx, 'crear', 'movimiento_inventario', id, {
      type: type.code, number, date: input.date, lines: input.lines.length, totalCost, entry: entry?.number ?? null,
    })
    return id
  })
}

// Voids with reversal movements at the frozen costs; the entry is voided (or
// reversed, if its month is closed). Dated on the document's day when its
// inventory month is open, otherwise today.
export function voidDocument(ctx: Ctx, id: string, reason: string, allowNegative?: boolean): void {
  const doc = ctx.db.select().from(d).where(and(eq(d.id, id), eq(d.empresaId, ctx.empresaId))).get()
  if (!doc) throw notFound('El movimiento')
  if (doc.status === 'anulado') throw new RuleError('El movimiento ya está anulado.', 409, 'already_voided')
  const periods = periodsOf(ctx)
  const date = periods.status(doc.date, 'inventory') === 'open' ? doc.date : today()
  periods.assertOpen(date, ['inventory'])
  const movs = ctx.db.select().from(m).where(and(eq(m.documentId, id), isNull(m.reversalOf))).all()
  const outs = movs.filter((x) => x.direction === 'in').map((x) => ({
    itemId: x.itemId, warehouseId: x.warehouseId, lotNo: x.lotNo, quantity: x.quantity,
  }))
  const codes = new Map(ctx.db.select({ id: i.id, code: i.code }).from(i).where(eq(i.empresaId, ctx.empresaId)).all().map((r) => [r.id, r.code]))
  assertStock(ctx, outs, allowNegative, codes)

  inTx(ctx, (tx) => {
    for (const x of movs) {
      const back = x.direction === 'in' ? 'out' : 'in'
      if (back === 'out') costOut(tx, x.itemId, x.quantity, { total: x.totalCost })
      else costIn(tx, x.itemId, x.quantity, { total: x.totalCost })
      insertMovement(tx, id, {
        lineNo: x.lineNo, itemId: x.itemId, warehouseId: x.warehouseId, direction: back, quantity: toQty(x.quantity),
        unitCost: x.unitCost, totalCost: x.totalCost, lotNo: x.lotNo, expiresOn: x.expiresOn, date, reversalOf: x.id,
      })
    }
    const now = nowIso()
    tx.db.update(d).set({ status: 'anulado', voidReason: reason, voidedAt: now, voidedBy: tx.userId, updatedAt: now })
      .where(eq(d.id, id)).run()
    const result = voidPosting(tx, id, date, `Anulación de movimiento de inventario: ${reason}`)
    auditIn(tx, 'anular', 'movimiento_inventario', id, { reason, date, entry: result?.kind ?? null })
  })
}
