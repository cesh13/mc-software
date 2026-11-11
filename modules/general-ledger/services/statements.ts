import { eq } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import { type BalanceSheet, type IncomeStatement, type JournalReport } from '@accounting/shared'
import { glJournalEntries as e } from '../schema.js'
import { centsToMoney, toCents } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { Chart } from './accounts.js'
import { rolledBalances, section, sectionTotal } from './balances.js'
import { selectEntries } from './entries-read.js'
import { linesOf } from './entry-detail.js'
import { fiscalYearOf } from './fiscal-years.js'

// Diario: applied, active entries of the period with their lines.
export function journal(ctx: Ctx, period: string): JournalReport {
  const items = selectEntries(ctx, [eq(e.period, period), eq(e.status, 'aplicada'), eq(e.isActive, true)])
  const lines = linesOf(ctx, items.map((i) => i.id))
  let debit = 0n
  let credit = 0n
  for (const i of items) {
    debit += toCents(i.totals.debit)
    credit += toCents(i.totals.credit)
  }
  return {
    period,
    entries: items.map((i) => ({ ...i, lines: lines.get(i.id) ?? [] })),
    totals: { debit: centsToMoney(debit), credit: centsToMoney(credit) },
  }
}

// Balance General at the end of `period`. The result of the fiscal year
// (ingresos − gastos) stands in for the closing entry until it is applied,
// so activo = pasivo + capital + resultados.
export function balanceSheet(ctx: Ctx, period: string): BalanceSheet {
  const chart = Chart.load(ctx)
  const fiscalYear = fiscalYearOf(ctx, period)
  // prev* = before the fiscal year; debit/credit = fiscal year up to period.
  const sums = rolledBalances(ctx, chart, { to: period, splitAt: fiscalYear.startPeriod })

  const resultOf = (pick: 'prev' | 'current') => {
    let r = 0n
    for (const a of chart.accounts) {
      if (!a.isDetail || (a.type !== 'ingresos' && a.type !== 'gastos')) continue
      const s = sums.get(a.accountId)
      if (!s) continue
      const net = pick === 'prev' ? s.prevCredit - s.prevDebit : s.credit - s.debit
      r += net
    }
    return r
  }
  const currentYear = resultOf('current')
  const priorYears = resultOf('prev')

  const activo = sectionTotal(chart, sums, 'activo')
  const right =
    sectionTotal(chart, sums, 'pasivo') + sectionTotal(chart, sums, 'capital') + currentYear + priorYears
  return {
    period,
    fiscalYear,
    activo: section(chart, sums, 'activo'),
    pasivo: section(chart, sums, 'pasivo'),
    capital: section(chart, sums, 'capital'),
    orden: section(chart, sums, 'orden'),
    contra: section(chart, sums, 'contra'),
    currentYearResult: centsToMoney(currentYear),
    priorYearsResult: centsToMoney(priorYears),
    difference: centsToMoney(activo - right),
  }
}

// Estado de Resultados for a range of periods, without the closing entry.
export function incomeStatement(ctx: Ctx, from: string, to: string): IncomeStatement {
  if (from > to) throw new RuleError('El período inicial es posterior al final.', 400, 'invalid_range')
  const chart = Chart.load(ctx)
  const sums = rolledBalances(ctx, chart, { from, to, excludeClosing: true })
  const ingresos = section(chart, sums, 'ingresos')
  const gastos = section(chart, sums, 'gastos')
  return {
    from,
    to,
    ingresos,
    gastos,
    netResult: centsToMoney(toCents(ingresos.total) - toCents(gastos.total)),
  }
}
