import { and, eq, gte, lt, lte, ne, sql, type SQL } from 'drizzle-orm'
import type { GlAccountType, StatementRow, StatementSection } from '@accounting/shared'
import { glJournalEntries as e, glJournalLines as l } from '../schema.js'
import { centsToMoney, fromSqlCents, sqlCents } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { natured, toReportAccount, type Chart } from './accounts.js'

// Balances are never stored: they are aggregated from the lines of applied,
// active entries. SQL sums integer cents per account; the hierarchy roll-up
// happens in JS with bigint.

export type Sums = { prevDebit: bigint; prevCredit: bigint; debit: bigint; credit: bigint }

export type AggregateFilter = {
  // Periods up to and including `to`.
  to: string
  // Periods before `splitAt` go to prev*; the rest to debit/credit.
  splitAt?: string
  // Periods from `from` (inclusive) only.
  from?: string
  costCenterId?: string
  excludeClosing?: boolean
}

export function zeroSums(): Sums {
  return { prevDebit: 0n, prevCredit: 0n, debit: 0n, credit: 0n }
}

export function countedEntries(ctx: Ctx): SQL[] {
  return [eq(e.empresaId, ctx.empresaId), eq(e.status, 'aplicada'), eq(e.isActive, true)]
}

// Raw sums per detail account (and per cost center when asked).
export function aggregate(ctx: Ctx, f: AggregateFilter, byCostCenter = false) {
  const where = [...countedEntries(ctx), lte(e.period, f.to)]
  if (f.from) where.push(gte(e.period, f.from))
  if (f.costCenterId) where.push(eq(l.costCenterId, f.costCenterId))
  if (f.excludeClosing) where.push(ne(e.source, 'cierre'))
  const d = sqlCents(l.debit)
  const c = sqlCents(l.credit)
  const split = f.splitAt ?? '0000-00'
  const isPrev = lt(e.period, split)
  const groupBy = byCostCenter ? [l.accountId, l.costCenterId] : [l.accountId]
  return ctx.db
    .select({
      accountId: l.accountId,
      costCenterId: byCostCenter ? l.costCenterId : sql<string | null>`null`,
      prevDebit: sql<number>`coalesce(sum(case when ${isPrev} then ${d} else 0 end), 0)`,
      prevCredit: sql<number>`coalesce(sum(case when ${isPrev} then ${c} else 0 end), 0)`,
      debit: sql<number>`coalesce(sum(case when ${isPrev} then 0 else ${d} end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${isPrev} then 0 else ${c} end), 0)`,
    })
    .from(l)
    .innerJoin(e, eq(e.id, l.entryId))
    .where(and(...where))
    .groupBy(...groupBy)
    .all()
    .map((r) => ({
      accountId: r.accountId,
      costCenterId: r.costCenterId,
      prevDebit: fromSqlCents(r.prevDebit),
      prevCredit: fromSqlCents(r.prevCredit),
      debit: fromSqlCents(r.debit),
      credit: fromSqlCents(r.credit),
    }))
}

// Adds every account's sums to itself and to its whole parent chain.
export function rollUp(chart: Chart, rows: ({ accountId: string } & Sums)[]): Map<string, Sums> {
  const out = new Map<string, Sums>()
  for (const r of rows) {
    const chain = chart.byId.has(r.accountId) ? chart.chain(r.accountId) : [r.accountId]
    for (const id of chain) {
      const s = out.get(id) ?? zeroSums()
      s.prevDebit += r.prevDebit
      s.prevCredit += r.prevCredit
      s.debit += r.debit
      s.credit += r.credit
      out.set(id, s)
    }
  }
  return out
}

export function rolledBalances(ctx: Ctx, chart: Chart, f: AggregateFilter): Map<string, Sums> {
  return rollUp(chart, aggregate(ctx, f))
}

// Natured balance of all sums (prev + current).
export function balanceOf(type: GlAccountType, s: Sums | undefined): bigint {
  if (!s) return 0n
  return natured(type, s.prevDebit + s.debit, s.prevCredit + s.credit)
}

// Accounts of one type with a non-zero balance, in code order. The total is
// the sum over detail accounts.
export function section(chart: Chart, sums: Map<string, Sums>, type: GlAccountType): StatementSection {
  const rows: StatementRow[] = []
  let total = 0n
  for (const a of chart.accounts) {
    if (a.type !== type) continue
    const balance = balanceOf(type, sums.get(a.accountId))
    if (a.isDetail) total += balance
    if (balance === 0n && !sums.has(a.accountId)) continue
    rows.push({ ...toReportAccount(a), balance: centsToMoney(balance) })
  }
  return { type, rows, total: centsToMoney(total) }
}

export function sectionTotal(chart: Chart, sums: Map<string, Sums>, type: GlAccountType): bigint {
  let total = 0n
  for (const a of chart.accounts) {
    if (a.type === type && a.isDetail) total += balanceOf(type, sums.get(a.accountId))
  }
  return total
}
