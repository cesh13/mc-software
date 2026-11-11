import { sql, type SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Money } from '@accounting/shared'

// Exact money arithmetic as integer cents (bigint). Amounts are stored as
// decimal strings; they are never added as floats.

const MONEY_RE = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

export function toCents(value: string): bigint {
  const m = MONEY_RE.exec(value.trim())
  if (!m) throw new Error(`Invalid money string: ${value}`)
  const cents = BigInt(m[2]!) * 100n + BigInt((m[3] ?? '').padEnd(2, '0'))
  return m[1] ? -cents : cents
}

export function centsToMoney(cents: bigint): Money {
  const neg = cents < 0n
  const abs = neg ? -cents : cents
  const frac = String(abs % 100n).padStart(2, '0')
  return `${neg ? '-' : ''}${abs / 100n}.${frac}`
}

export function normalizeMoney(value: string): Money {
  return centsToMoney(toCents(value))
}

// SQL integer cents of a stored amount column. SQLite sums integers exactly.
export function sqlCents(column: AnySQLiteColumn): SQL<number> {
  return sql<number>`cast(round(cast(${column} as real) * 100) as integer)`
}

// SQLite returns integer sums as JS numbers; exact below 2^53 cents.
export function fromSqlCents(value: number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n
  return typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
}

export type DebitCredit = { debit: bigint; credit: bigint }

export function totalsOf(lines: { debit: string; credit: string }[]) {
  let debit = 0n
  let credit = 0n
  for (const l of lines) {
    debit += toCents(l.debit)
    credit += toCents(l.credit)
  }
  return {
    debit: centsToMoney(debit),
    credit: centsToMoney(credit),
    difference: centsToMoney(debit - credit),
    balanced: debit === credit,
  }
}
