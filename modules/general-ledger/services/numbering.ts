import { and, eq, ne, sql } from 'drizzle-orm'
import type { EntryType } from '@accounting/shared'
import { glJournalEntries as e } from '../schema.js'
import type { Ctx } from '../lib/context.js'

// Numbering is per entry type and per month. Voided entries keep their
// number, so they count here and their numbers are never reused.

const numberValue = sql<number>`cast(${e.number} as integer)`

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function highest(ctx: Ctx, period: string, entryTypeId: string): number {
  const row = ctx.db
    .select({ max: sql<number | null>`max(${numberValue})` })
    .from(e)
    .where(and(eq(e.empresaId, ctx.empresaId), eq(e.period, period), eq(e.entryTypeId, entryTypeId)))
    .get()
  return row?.max ?? 0
}

export function nextNumber(ctx: Ctx, period: string, type: EntryType): string {
  return padNumber(highest(ctx, period, type.id) + 1, type.numberWidth)
}

export function isNumberTaken(
  ctx: Ctx,
  period: string,
  entryTypeId: string,
  value: number,
  exceptEntryId?: string,
): boolean {
  const conds = [
    eq(e.empresaId, ctx.empresaId),
    eq(e.period, period),
    eq(e.entryTypeId, entryTypeId),
    sql`${numberValue} = ${value}`,
  ]
  if (exceptEntryId) conds.push(ne(e.id, exceptEntryId))
  return !!ctx.db.select({ id: e.id }).from(e).where(and(...conds)).get()
}

// Number for a new entry: the requested one if free, otherwise the next.
// Must run inside the transaction that inserts the entry.
export function assignNumber(
  ctx: Ctx,
  period: string,
  type: EntryType,
  requested?: string,
): { number: string; reassigned: boolean } {
  if (requested !== undefined) {
    const value = Number(requested)
    if (value > 0 && !isNumberTaken(ctx, period, type.id, value)) {
      return { number: padNumber(value, type.numberWidth), reassigned: false }
    }
    return { number: nextNumber(ctx, period, type), reassigned: true }
  }
  return { number: nextNumber(ctx, period, type), reassigned: false }
}
