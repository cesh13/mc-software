import { and, eq, like, sql } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import { periodLabel, type PeriodStatusRow } from '@accounting/shared'
import { glJournalEntries, glPeriods } from '../schema.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { DetailedRuleError } from '../lib/errors.js'

export function isPeriodClosed(ctx: Ctx, period: string): boolean {
  const row = ctx.db
    .select({ status: glPeriods.status })
    .from(glPeriods)
    .where(and(eq(glPeriods.empresaId, ctx.empresaId), eq(glPeriods.period, period)))
    .get()
  return row?.status === 'closed'
}

export function assertPeriodOpen(ctx: Ctx, period: string): void {
  if (isPeriodClosed(ctx, period)) {
    throw new RuleError(
      `El mes ${periodLabel(period)} está cerrado; solo se puede consultar.`,
      409,
      'period_closed',
    )
  }
}

export function listPeriods(ctx: Ctx, year: string): PeriodStatusRow[] {
  const rows = ctx.db
    .select()
    .from(glPeriods)
    .where(and(eq(glPeriods.empresaId, ctx.empresaId), like(glPeriods.period, `${year}-%`)))
    .all()
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
    result.push({
      period,
      label: periodLabel(period),
      status: row?.status ?? 'open',
      closedAt: row?.status === 'closed' ? row.closedAt : null,
      closedBy: row?.status === 'closed' ? row.closedBy : null,
      entries: { aplicada: n?.aplicada ?? 0, borrador: n?.borrador ?? 0, voided: n?.voided ?? 0 },
    })
  }
  return result
}

function setStatus(ctx: Ctx, period: string, status: 'open' | 'closed') {
  const now = nowIso()
  const closedBy = status === 'closed' ? ctx.userId : null
  const closedAt = status === 'closed' ? now : null
  const existing = ctx.db
    .select({ id: glPeriods.id })
    .from(glPeriods)
    .where(and(eq(glPeriods.empresaId, ctx.empresaId), eq(glPeriods.period, period)))
    .get()
  if (existing) {
    ctx.db.update(glPeriods)
      .set({ status, closedBy, closedAt, updatedAt: now })
      .where(eq(glPeriods.id, existing.id))
      .run()
  } else {
    ctx.db.insert(glPeriods)
      .values({ id: newId(), empresaId: ctx.empresaId, period, status, closedBy, closedAt, updatedAt: now })
      .run()
  }
}

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
  inTx(ctx, (tx) => {
    setStatus(tx, period, 'closed')
    auditIn(tx, 'cerrar_mes', 'period', period)
  })
  return listPeriods(ctx, period.slice(0, 4)).find((p) => p.period === period)!
}

export function reopenPeriod(ctx: Ctx, period: string): PeriodStatusRow {
  if (!isPeriodClosed(ctx, period)) {
    throw new RuleError(`El mes ${periodLabel(period)} no está cerrado.`, 409, 'period_not_closed')
  }
  inTx(ctx, (tx) => {
    setStatus(tx, period, 'open')
    auditIn(tx, 'abrir_mes', 'period', period)
  })
  return listPeriods(ctx, period.slice(0, 4)).find((p) => p.period === period)!
}
