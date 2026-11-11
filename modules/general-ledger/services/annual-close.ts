import { and, eq, gte, lte } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import { lastDayOfPeriod, type AnnualClosePreview, type Entry, type annualCloseInput } from '@accounting/shared'
import type { z } from 'zod'
import { glJournalEntries as e } from '../schema.js'
import { centsToMoney, toCents, totalsOf } from '../lib/cents.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'
import { Chart, getAccount, natured } from './accounts.js'
import { aggregate } from './balances.js'
import { listCostCenters } from './cost-centers.js'
import { getEntry } from './entry-detail.js'
import { activeEntryType, assertDateInPeriod } from './entry-rules.js'
import { insertLines } from './entries-write.js'
import { getFiscalYear, fiscalYearOf } from './fiscal-years.js'
import { assignNumber, nextNumber } from './numbering.js'
import { assertPeriodOpen } from './periods.js'

type Input = z.output<typeof annualCloseInput>
type Line = AnnualClosePreview['lines'][number]

function closingEntryId(ctx: Ctx, start: string, end: string): string | undefined {
  return ctx.db
    .select({ id: e.id })
    .from(e)
    .where(
      and(
        eq(e.empresaId, ctx.empresaId),
        eq(e.source, 'cierre'),
        eq(e.isActive, true),
        gte(e.period, start),
        lte(e.period, end),
      ),
    )
    .get()?.id
}

// Draft closing entry: every detail gastos / ingresos account with a balance
// at the end of the fiscal year is cancelled (per cost center when the
// account uses them) and the difference goes to the result account.
export function previewAnnualClose(ctx: Ctx, input: Input): AnnualClosePreview {
  const fy = input.fiscalYearId ? getFiscalYear(ctx, input.fiscalYearId) : fiscalYearOf(ctx, input.period!)
  const period = fy.endPeriod
  const date = input.date ?? lastDayOfPeriod(period)
  assertDateInPeriod(date, period)
  const type = activeEntryType(ctx, input.entryTypeId)
  const resultAccount = getAccount(ctx, input.resultAccountId)
  if (!resultAccount.isDetail) {
    throw new RuleError(`Cuenta ${resultAccount.code} no es de detalle.`, 400, 'result_account_not_detail')
  }
  if (!resultAccount.isActive) {
    throw new RuleError(`La cuenta ${resultAccount.code} está inactiva.`, 400, 'account_inactive')
  }
  if (resultAccount.type === 'gastos' || resultAccount.type === 'ingresos') {
    throw new RuleError(
      'La cuenta de utilidad o pérdida no puede ser de gastos ni de ingresos.',
      400,
      'result_account_invalid_type',
    )
  }

  const chart = Chart.load(ctx)
  const centers = new Map(listCostCenters(ctx, true).map((c) => [c.id, c]))
  const concept = `CIERRE CONTABLE EJERCICIO/${period.slice(0, 4)}`
  // Cumulative balance at the end of the fiscal year, like the legacy saldo.
  const groups = new Map<string, { accountId: string; costCenterId: string | null; bal: bigint }>()
  for (const r of aggregate(ctx, { to: period }, true)) {
    const a = chart.byId.get(r.accountId)
    if (!a || !a.isDetail || (a.type !== 'gastos' && a.type !== 'ingresos')) continue
    const costCenterId = a.requiresCostCenter ? r.costCenterId : null
    const key = `${a.code}\u0000${costCenterId ? centers.get(costCenterId)?.code ?? costCenterId : ''}`
    const g = groups.get(key) ?? { accountId: a.accountId, costCenterId, bal: 0n }
    g.bal += natured(a.type, r.prevDebit + r.debit, r.prevCredit + r.credit)
    groups.set(key, g)
  }

  const lines: Line[] = []
  const push = (accountId: string, costCenterId: string | null, debit: bigint, credit: bigint) => {
    const a = chart.byId.get(accountId)!
    const cc = costCenterId ? centers.get(costCenterId) : undefined
    lines.push({
      lineNo: lines.length + 1,
      accountId,
      accountCode: a.code,
      accountName: a.name,
      costCenterId,
      costCenterCode: cc?.code ?? null,
      costCenterName: cc?.name ?? null,
      detail: concept,
      debit: centsToMoney(debit),
      credit: centsToMoney(credit),
    })
  }
  for (const key of [...groups.keys()].sort()) {
    const g = groups.get(key)!
    if (g.bal === 0n) continue
    const abs = g.bal < 0n ? -g.bal : g.bal
    // gastos: positive balance → credit; ingresos: positive balance → debit.
    const toDebit = chart.byId.get(g.accountId)!.type === 'ingresos' ? g.bal > 0n : g.bal < 0n
    push(g.accountId, g.costCenterId, toDebit ? abs : 0n, toDebit ? 0n : abs)
  }
  const pre = totalsOf(lines)
  const result = pre.balanced ? 0n : toCents(pre.difference)
  // Profit (more debits) → credit the result account; loss → debit it.
  if (result > 0n) push(resultAccount.accountId, null, 0n, result)
  if (result < 0n) push(resultAccount.accountId, null, -result, 0n)

  const totals = totalsOf(lines)
  return {
    fiscalYear: fy,
    period,
    date,
    concept,
    entryTypeId: type.id,
    number: nextNumber(ctx, period, type),
    alreadyClosed: !!closingEntryId(ctx, fy.startPeriod, fy.endPeriod),
    result: centsToMoney(result),
    lines,
    totals: { debit: totals.debit, credit: totals.credit, difference: totals.difference },
  }
}

// Saves the closing entry as applied with source = 'cierre'.
export function applyAnnualClose(ctx: Ctx, input: Input): Entry {
  const id = inTx(ctx, (tx) => {
    const p = previewAnnualClose(tx, input)
    if (p.alreadyClosed) {
      throw new RuleError(
        `El ejercicio ${p.fiscalYear.name} ya tiene partida de cierre. Anúlela antes de cerrar de nuevo.`,
        409,
        'already_closed',
      )
    }
    if (p.lines.length === 0) {
      throw new RuleError('No hay saldos de gastos ni ingresos que cerrar.', 409, 'nothing_to_close')
    }
    assertPeriodOpen(tx, p.period)
    if (!totalsOf(p.lines).balanced) throw new Error('Closing entry does not balance')
    const type = activeEntryType(tx, p.entryTypeId)
    const { number } = assignNumber(tx, p.period, type)
    const id = newId()
    const now = nowIso()
    tx.db.insert(e)
      .values({
        id, empresaId: ctx.empresaId, period: p.period, entryTypeId: type.id, number, date: p.date,
        concept: p.concept, status: 'aplicada', source: 'cierre',
        sourceRef: `${p.fiscalYear.startPeriod}..${p.fiscalYear.endPeriod}`,
        createdBy: ctx.userId, createdAt: now, updatedAt: now,
      })
      .run()
    insertLines(tx, id, p.lines.map((l) => ({
      lineNo: l.lineNo, accountId: l.accountId, costCenterId: l.costCenterId, detail: l.detail,
      debit: l.debit, credit: l.credit, collectDate: null,
    })))
    auditIn(tx, 'cierre_anual', 'journal_entry', id, {
      fiscalYear: p.fiscalYear, number, result: p.result, totals: p.totals,
    })
    return id
  })
  return getEntry(ctx, id)
}
