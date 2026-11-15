import { and, eq, like, sql } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import { periodLabel, type PeriodStatusRow } from '@accounting/shared'
import { glJournalEntries } from '../schema.js'
import { inTx, periodsOf, type Ctx } from '../lib/context.js'
import { DetailedRuleError } from '../lib/errors.js'

// The GL month state lives in the platform's core_periods (area 'gl').
export function isPeriodClosed(ctx: Ctx, period: string): boolean {
  return periodsOf(ctx).status(period, 'gl') !== 'open'
}

export function assertPeriodOpen(ctx: Ctx, period: string): void {
  periodsOf(ctx).assertOpen(period, ['gl'])
}

export function listPeriods(ctx: Ctx, year: string): PeriodStatusRow[] {
  const rows = periodsOf(ctx).list('gl', year)
  const counts = ctx.db
    .select({
      period: glJournalEntries.period,
      aplicada: sql<number>`sum(case when ${glJournalEntries.isActive} = 1 and ${glJournalEntries.status} = 'aplicada' then 1 else 0 end)`,
      borrador: sql<number>`sum(case when ${glJournalEntries.isActive} = 1 and ${glJournalEntries.status} = 'borrador' then 1 else 0 end)`,
      voided: sql<number>`sum(case when ${glJournalEntries.isActive} = 0 then 1 else 0 end)`,
    })
    .from(glJournalEntries)
    .where(and(eq(glJournalEntries.empresaId, ctx.empresaId), like(glJournalEntries.period, `${year}-%`)))
    .groupBy(glJournalEntries.period)
    .all()
  const result: PeriodStatusRow[] = []
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`
    const row = rows.find((r) => r.period === period)
    const n = counts.find((r) => r.period === period)
    const closed = !!row && row.status !== 'open'
    result.push({
      period,
      label: periodLabel(period),
      status: closed ? 'closed' : 'open',
      closedAt: closed ? row.closedAt : null,
      closedBy: closed ? row.closedBy : null,
      entries: { aplicada: n?.aplicada ?? 0, borrador: n?.borrador ?? 0, voided: n?.voided ?? 0 },
    })
  }
  return result
}

const rowOf = (ctx: Ctx, period: string) => listPeriods(ctx, period.slice(0, 4)).find((p) => p.period === period)!

export function closePeriod(ctx: Ctx, period: string): PeriodStatusRow {
  if (isPeriodClosed(ctx, period)) {
    throw new RuleError(`El mes ${periodLabel(period)} ya está cerrado.`, 409, 'period_already_closed')
  }
  const drafts = ctx.db
    .select({ n: sql<number>`count(*)` })
    .from(glJournalEntries)
    .where(
      and(
        eq(glJournalEntries.empresaId, ctx.empresaId),
        eq(glJournalEntries.period, period),
        eq(glJournalEntries.status, 'borrador'),
        eq(glJournalEntries.isActive, true),
      ),
    )
    .get()
  const n = drafts?.n ?? 0
  if (n > 0) {
    throw new DetailedRuleError(
      `No se puede cerrar el mes: tiene ${n} partida(s) en borrador. Aplíquelas o anúlelas primero.`,
      409,
      'period_has_drafts',
      { count: n },
    )
  }
  inTx(ctx, (tx) => periodsOf(tx).close(period, 'gl'))
  return rowOf(ctx, period)
}

// Reopening needs a reason (contratos.md §2); the core service audits it.
export function reopenPeriod(ctx: Ctx, period: string, reason: string): PeriodStatusRow {
  inTx(ctx, (tx) => periodsOf(tx).reopen(period, 'gl', reason))
  return rowOf(ctx, period)
}
