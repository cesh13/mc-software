import { Decimal } from 'decimal.js'
import type { SqlHandle } from './types.js'

// Balances recomputed from the imported journal lines (never read from a balance table).
// Rules: business-rules.md §5 — debit-natured types 1, 4, 6 (activo, gastos, orden):
// balance = previous + debits − credits; the rest: previous − debits + credits.
// Movements roll up the whole parent chain.

const DEBIT_NATURE = new Set(['activo', 'gastos', 'orden'])
const ZERO = new Decimal(0)

export type Balance = {
  debit: Decimal // debits of the month (with roll-up)
  credit: Decimal
  previous: Decimal // balance at the end of the previous month
  balance: Decimal // balance at the end of the month
  net: Decimal // balance − previous
}

type Series = { periods: string[]; debit: Decimal[]; credit: Decimal[]; cumulative: Decimal[] }

export type Ledger = {
  codes: Map<string, string> // account code → id
  at(accountCode: string, costCenter: string, period: string): Balance
  periodsWithEntries: Set<string>
}

type AccountRow = { id: string; code: string; parent_id: string | null; type: string }
type SumRow = { period: string; account_id: string; cc: string | null; d: number; c: number }

const cents = (n: number) => new Decimal(n).div(100)

// `byCostCenter` keeps a separate series per (account, cost center); otherwise cost centers are merged.
export function loadLedger(db: SqlHandle, empresaId: string, byCostCenter: boolean): Ledger {
  const accounts = new Map<string, AccountRow>()
  for (const a of db.prepare('SELECT id, code, parent_id, type FROM coa_accounts WHERE empresa_id = ?').all(empresaId) as AccountRow[]) {
    accounts.set(a.id, a)
  }
  // Exact sums as integer cents (amounts are 2-decimal strings).
  const sums = db
    .prepare(
      `SELECT e.period AS period, l.account_id AS account_id, k.code AS cc,
              SUM(CAST(ROUND(CAST(l.debit AS REAL) * 100) AS INTEGER)) AS d,
              SUM(CAST(ROUND(CAST(l.credit AS REAL) * 100) AS INTEGER)) AS c
         FROM gl_journal_lines l
         JOIN gl_journal_entries e ON e.id = l.entry_id
         LEFT JOIN gl_cost_centers k ON k.id = l.cost_center_id
        WHERE e.empresa_id = ? AND e.status = 'aplicada' AND e.is_active = 1
        GROUP BY e.period, l.account_id, k.code`,
    )
    .all(empresaId) as SumRow[]

  const monthly = new Map<string, { debit: Decimal; credit: Decimal; period: string; seriesKey: string }>()
  const periodsWithEntries = new Set<string>()
  for (const s of sums) {
    periodsWithEntries.add(s.period)
    const cc = byCostCenter ? (s.cc ?? '') : ''
    let id: string | null = s.account_id
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      seen.add(id)
      const seriesKey = `${id}|${cc}`
      const key = `${seriesKey}|${s.period}`
      const cell = monthly.get(key) ?? { debit: ZERO, credit: ZERO, period: s.period, seriesKey }
      cell.debit = cell.debit.plus(cents(s.d))
      cell.credit = cell.credit.plus(cents(s.c))
      monthly.set(key, cell)
      id = accounts.get(id)?.parent_id ?? null
    }
  }

  const series = new Map<string, Series>()
  for (const cell of [...monthly.values()].sort((a, b) => a.period.localeCompare(b.period))) {
    const s = series.get(cell.seriesKey) ?? { periods: [], debit: [], credit: [], cumulative: [] }
    const accountId = cell.seriesKey.split('|')[0]!
    const debitNature = DEBIT_NATURE.has(accounts.get(accountId)?.type ?? 'activo')
    const net = debitNature ? cell.debit.minus(cell.credit) : cell.credit.minus(cell.debit)
    s.periods.push(cell.period)
    s.debit.push(cell.debit)
    s.credit.push(cell.credit)
    s.cumulative.push((s.cumulative.at(-1) ?? ZERO).plus(net))
    series.set(cell.seriesKey, s)
  }

  const codes = new Map([...accounts.values()].map((a) => [a.code, a.id]))
  return {
    codes,
    periodsWithEntries,
    at(accountCode, costCenter, period) {
      const id = codes.get(accountCode)
      const s = id ? series.get(`${id}|${byCostCenter ? costCenter : ''}`) : undefined
      if (!s) return { debit: ZERO, credit: ZERO, previous: ZERO, balance: ZERO, net: ZERO }
      // Last month <= period (balance) and last month < period (previous).
      let i = s.periods.length - 1
      while (i >= 0 && s.periods[i]! > period) i--
      const hit = i >= 0 && s.periods[i] === period
      const balance = i >= 0 ? s.cumulative[i]! : ZERO
      const prevIdx = hit ? i - 1 : i
      const previous = prevIdx >= 0 ? s.cumulative[prevIdx]! : ZERO
      return {
        debit: hit ? s.debit[i]! : ZERO,
        credit: hit ? s.credit[i]! : ZERO,
        previous,
        balance,
        net: balance.minus(previous),
      }
    },
  }
}

// Every (account, cost center, period) that has movement, for the "missing in legacy" check.
export function movementKeys(db: SqlHandle, empresaId: string, byCostCenter: boolean): Set<string> {
  const accounts = new Map<string, string | null>()
  const codeOf = new Map<string, string>()
  for (const a of db.prepare('SELECT id, code, parent_id FROM coa_accounts WHERE empresa_id = ?').all(empresaId) as AccountRow[]) {
    accounts.set(a.id, a.parent_id)
    codeOf.set(a.id, a.code)
  }
  const rows = db
    .prepare(
      `SELECT DISTINCT e.period AS period, l.account_id AS account_id, k.code AS cc
         FROM gl_journal_lines l JOIN gl_journal_entries e ON e.id = l.entry_id
         LEFT JOIN gl_cost_centers k ON k.id = l.cost_center_id
        WHERE e.empresa_id = ? AND e.status = 'aplicada' AND e.is_active = 1`,
    )
    .all(empresaId) as SumRow[]
  const out = new Set<string>()
  for (const r of rows) {
    let id: string | null = r.account_id
    const seen = new Set<string>()
    while (id && !seen.has(id)) {
      seen.add(id)
      out.add(`${r.period}|${codeOf.get(id)}|${byCostCenter ? (r.cc ?? '') : ''}`)
      id = accounts.get(id) ?? null
    }
  }
  return out
}
