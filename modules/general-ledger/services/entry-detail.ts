import { and, asc, eq, inArray } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import type { Entry, EntryLine } from '@accounting/shared'
import {
  glCostCenters as cc,
  glEntryTypes as t,
  glJournalEntries as e,
  glJournalLines as l,
} from '../schema.js'
import { coaAccountsRef as acc } from '../refs.js'
import type { Ctx } from '../lib/context.js'
import { listEntriesById, neighbours } from './entries-read.js'
import { isPeriodClosed } from './periods.js'

export type EntryRow = typeof e.$inferSelect

export const EDITABLE_SOURCES = ['manual', 'importado'] as const

// Header row of an entry of the current empresa (another empresa's is invisible).
export function loadEntry(ctx: Ctx, id: string): EntryRow {
  const row = ctx.db
    .select()
    .from(e)
    .where(and(eq(e.id, id), eq(e.empresaId, ctx.empresaId)))
    .get()
  if (!row) throw new RuleError('La partida no existe.', 404, 'entry_not_found')
  return row
}

export function linesOf(ctx: Ctx, entryIds: string[]): Map<string, EntryLine[]> {
  const out = new Map<string, EntryLine[]>()
  if (entryIds.length === 0) return out
  const rows = ctx.db
    .select({
      entryId: l.entryId,
      id: l.id,
      lineNo: l.lineNo,
      accountId: l.accountId,
      accountCode: acc.code,
      accountName: acc.name,
      costCenterId: l.costCenterId,
      costCenterCode: cc.code,
      costCenterName: cc.name,
      detail: l.detail,
      debit: l.debit,
      credit: l.credit,
      collectDate: l.collectDate,
    })
    .from(l)
    .innerJoin(acc, eq(acc.id, l.accountId))
    .leftJoin(cc, eq(cc.id, l.costCenterId))
    .where(inArray(l.entryId, entryIds))
    .orderBy(asc(l.entryId), asc(l.lineNo))
    .all()
  for (const { entryId, ...line } of rows) {
    const list = out.get(entryId) ?? []
    list.push(line)
    out.set(entryId, list)
  }
  return out
}

export function getEntry(ctx: Ctx, id: string): Entry {
  const row = loadEntry(ctx, id)
  const [item] = listEntriesById(ctx, [id])
  const type = ctx.db.select({ name: t.name }).from(t).where(eq(t.id, row.entryTypeId)).get()
  const closed = isPeriodClosed(ctx, row.period)
  return {
    ...item!,
    entryTypeName: type?.name ?? '',
    sourceRef: row.sourceRef,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    periodStatus: closed ? 'closed' : 'open',
    editable:
      row.isActive && !closed && (EDITABLE_SOURCES as readonly string[]).includes(row.source),
    lines: linesOf(ctx, [id]).get(id) ?? [],
    ...neighbours(ctx, row.period, id),
  }
}
