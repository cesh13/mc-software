import { and, asc, eq, inArray, like, or, sql, type SQL } from 'drizzle-orm'
import type { EntryListItem, entryListQuery } from '@accounting/shared'
import type { z } from 'zod'
import { glEntryTypes as t, glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { centsToMoney, fromSqlCents, sqlCents } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'

// Entry headers with their totals, computed in SQL as integer cents.

export const numberOrder = sql`cast(${e.number} as integer)`

const listCols = {
  id: e.id,
  period: e.period,
  entryTypeId: e.entryTypeId,
  entryTypeCode: t.code,
  number: e.number,
  date: e.date,
  concept: e.concept,
  status: e.status,
  source: e.source,
  importedUnbalanced: e.importedUnbalanced,
  isActive: e.isActive,
  lineCount: sql<number>`count(${l.id})`,
  debitCents: sql<number>`coalesce(sum(${sqlCents(l.debit)}), 0)`,
  creditCents: sql<number>`coalesce(sum(${sqlCents(l.credit)}), 0)`,
}

type ListRow = { debitCents: number; creditCents: number } & Omit<EntryListItem, 'totals'>

function toItem(row: ListRow): EntryListItem {
  const { debitCents, creditCents, ...rest } = row
  const d = fromSqlCents(debitCents)
  const c = fromSqlCents(creditCents)
  return {
    ...rest,
    totals: { debit: centsToMoney(d), credit: centsToMoney(c), difference: centsToMoney(d - c) },
  }
}

export function selectEntries(ctx: Ctx, where: SQL[]): EntryListItem[] {
  return ctx.db
    .select(listCols)
    .from(e)
    .innerJoin(t, eq(t.id, e.entryTypeId))
    .leftJoin(l, eq(l.entryId, e.id))
    .where(and(eq(e.empresaId, ctx.empresaId), ...where))
    .groupBy(e.id)
    .orderBy(asc(e.period), asc(t.code), asc(numberOrder), asc(e.id))
    .all()
    .map(toItem)
}

export function listEntries(ctx: Ctx, q: z.output<typeof entryListQuery>): EntryListItem[] {
  const where: SQL[] = [eq(e.period, q.period)]
  if (q.entryTypeId) where.push(eq(e.entryTypeId, q.entryTypeId))
  if (q.status) where.push(eq(e.status, q.status))
  if (!q.includeVoided) where.push(eq(e.isActive, true))
  if (q.q) {
    const pattern = `%${q.q}%`
    where.push(or(like(e.concept, pattern), like(e.number, pattern))!)
  }
  return selectEntries(ctx, where)
}

export function listEntriesById(ctx: Ctx, ids: string[]): EntryListItem[] {
  if (ids.length === 0) return []
  return selectEntries(ctx, [inArray(e.id, ids)])
}

// "Partidas descuadradas": active drafts and imported unbalanced entries.
export function unbalancedEntries(ctx: Ctx, period?: string): EntryListItem[] {
  const where: SQL[] = [
    eq(e.isActive, true),
    or(eq(e.status, 'borrador'), eq(e.importedUnbalanced, true))!,
  ]
  if (period) where.push(eq(e.period, period))
  return selectEntries(ctx, where)
}

// Ids of the period's entries in screen order, for Anterior / Siguiente.
export function neighbours(ctx: Ctx, period: string, id: string) {
  const ids = ctx.db
    .select({ id: e.id })
    .from(e)
    .innerJoin(t, eq(t.id, e.entryTypeId))
    .where(and(eq(e.empresaId, ctx.empresaId), eq(e.period, period), or(eq(e.isActive, true), eq(e.id, id))))
    .orderBy(asc(t.code), asc(numberOrder), asc(e.id))
    .all()
    .map((r) => r.id)
  const i = ids.indexOf(id)
  return { prevId: i > 0 ? ids[i - 1]! : null, nextId: i >= 0 && i < ids.length - 1 ? ids[i + 1]! : null }
}
