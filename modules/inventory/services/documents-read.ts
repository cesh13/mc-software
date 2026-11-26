import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { z } from 'zod'
import type { documentListQuery, InvDocument, InvDocumentLine, InvDocumentSummary } from '@accounting/shared'
import {
  invDocuments as d, invItems as i, invMovementTypes as t, invMovements as m, invWarehouses as w,
} from '../schema.js'
import { ptyPartiesRef as p } from '../refs.js'
import type { Ctx } from '../lib/context.js'
import { notFound } from './common.js'
import { ledgerOf, SOURCE } from './posting.js'

const dw = alias(w, 'dest_w')

const header = {
  id: d.id, typeId: d.typeId, typeCode: t.code, typeName: t.name, direction: t.direction, kind: t.kind,
  number: d.number, date: d.date, warehouseId: d.warehouseId, warehouseCode: w.code,
  destWarehouseId: d.destWarehouseId, destWarehouseCode: dw.code, partyId: d.partyId, partyName: p.name,
  reference: d.reference, notes: d.notes, status: d.status, totalCost: d.totalCost, voidReason: d.voidReason,
}

function base(ctx: Ctx) {
  return ctx.db.select(header).from(d)
    .innerJoin(t, eq(t.id, d.typeId))
    .innerJoin(w, eq(w.id, d.warehouseId))
    .leftJoin(dw, eq(dw.id, d.destWarehouseId))
    .leftJoin(p, eq(p.id, d.partyId))
}

export function listDocuments(ctx: Ctx, q: z.output<typeof documentListQuery>): InvDocumentSummary[] {
  const conds: SQL[] = [eq(d.empresaId, ctx.empresaId)]
  if (q.from) conds.push(gte(d.date, q.from))
  if (q.to) conds.push(lte(d.date, q.to))
  if (q.typeId) conds.push(eq(d.typeId, q.typeId))
  if (q.warehouseId) conds.push(eq(d.warehouseId, q.warehouseId))
  if (q.itemId) {
    conds.push(inArray(d.id, ctx.db.select({ id: m.documentId }).from(m).where(eq(m.itemId, q.itemId))))
  }
  const rows = base(ctx).where(and(...conds)).orderBy(desc(d.date), desc(d.createdAt)).limit(1000).all()
  const counts = new Map(
    ctx.db.select({ id: m.documentId, n: sql<number>`count(distinct ${m.lineNo})` }).from(m)
      .where(and(eq(m.empresaId, ctx.empresaId), inArray(m.documentId, rows.map((r) => r.id))))
      .groupBy(m.documentId).all().map((r) => [r.id, r.n]),
  )
  return rows.map((r) => ({ ...r, lineCount: counts.get(r.id) ?? 0 }))
}

export function getDocument(ctx: Ctx, id: string): InvDocument {
  const row = base(ctx).where(and(eq(d.id, id), eq(d.empresaId, ctx.empresaId))).get()
  if (!row) throw notFound('El movimiento')
  // One line per document line: the origin leg of a transfer, the only leg otherwise.
  const lines: InvDocumentLine[] = ctx.db.select({
    lineNo: m.lineNo, itemId: m.itemId, itemCode: i.code, itemName: i.name, unit: i.unit,
    quantity: m.quantity, unitCost: m.unitCost, totalCost: m.totalCost, lotNo: m.lotNo, expiresOn: m.expiresOn,
  }).from(m).innerJoin(i, eq(i.id, m.itemId))
    .where(and(eq(m.documentId, id), isNull(m.reversalOf), eq(m.warehouseId, row.warehouseId)))
    .orderBy(asc(m.lineNo)).all()
  fillLotExpiry(ctx, lines)
  const entry = ledgerOf(ctx).find({ source: SOURCE, sourceRef: id })
  return { ...row, lines, entry: entry ? { entryId: entry.entryId, number: entry.number, period: entry.period } : null }
}

// A salida does not store the lot's expiry: show the one of the entrada that brought the lot in
// (the latest one when several did, same rule as the stock report).
function fillLotExpiry(ctx: Ctx, lines: InvDocumentLine[]) {
  const missing = lines.filter((l) => l.lotNo && !l.expiresOn)
  if (!missing.length) return
  const rows = ctx.db.select({ itemId: m.itemId, lotNo: m.lotNo, expiresOn: m.expiresOn }).from(m)
    .where(and(
      eq(m.empresaId, ctx.empresaId), eq(m.direction, 'in'), isNotNull(m.expiresOn),
      inArray(m.itemId, [...new Set(missing.map((l) => l.itemId))]),
      inArray(m.lotNo, [...new Set(missing.map((l) => l.lotNo as string))]),
    ))
    .orderBy(asc(m.date), asc(m.createdAt)).all()
  const byLot = new Map(rows.map((r) => [`${r.itemId}|${r.lotNo}`, r.expiresOn]))
  for (const l of missing) l.expiresOn = byLot.get(`${l.itemId}|${l.lotNo}`) ?? null
}

// Costs are sensitive (inv.cost.view): blank them for callers without it.
export function redactCosts<T extends { totalCost: string }>(doc: T & { lines?: InvDocumentLine[] }): T {
  return {
    ...doc, totalCost: '',
    ...(doc.lines ? { lines: doc.lines.map((l) => ({ ...l, unitCost: '', totalCost: '' })) } : {}),
  }
}
