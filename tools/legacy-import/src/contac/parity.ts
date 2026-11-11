import { Decimal } from 'decimal.js'
import { addMonths, periodFromSalfec } from '@accounting/shared'
import { loadLedger, movementKeys, type Balance } from './balances.js'
import { openTable, str, type Row } from './source.js'
import type { SqlHandle } from './types.js'

export type Mismatch = {
  period: string
  account: string
  costCenter?: string
  field: string
  legacy: string
  computed: string
  cause: MismatchCause
}

// Why a legacy row differs from the recomputed value:
// - legacy_chain_broken: the legacy saldoant is not the legacy saldo of the previous month.
// - legacy_row_inconsistent: the legacy row breaks the §5 formula by itself (out of sync).
// - month_without_entries: the legacy table shows movement in a month that has no entries at all.
// - carried_from_earlier_month: this month's movement matches; the balance differs only by an
//   offset that came from an earlier month of the same account (cascade, not a new difference).
// - other: needs investigation.
export type MismatchCause = 'carried_from_earlier_month' | 'legacy_chain_broken' | 'legacy_row_inconsistent' | 'month_without_entries' | 'other'

export type ParityTable = {
  table: string
  legacyRows: number
  monthsCompared: number
  accountsCompared: number
  rowsCompared: number
  rowsWithMismatch: number
  fieldMismatches: number
  byField: Record<string, number>
  byCause: Record<MismatchCause, number>
  first: Mismatch[]
  // Computed movement with no legacy row at all.
  missingInLegacy: { count: number; first: { period: string; account: string; costCenter?: string }[] }
  encoding: string
}

export type ParityReport = { empresaId: string; saldos: ParityTable | null; saldocc: ParityTable | null; ok: boolean }

export type ParityOptions = { limit?: number }

const FIELDS: [string, keyof Balance, string][] = [
  ['saldoant', 'previous', 'saldoant'],
  ['cargos', 'debit', 'cargos'],
  ['abonos', 'credit', 'abonos'],
  ['saldo', 'balance', 'saldo'],
  ['saldomes', 'net', 'saldomes'],
]

const dec = (v: unknown): Decimal => {
  try {
    return v === null || v === undefined || v === '' ? new Decimal(0) : new Decimal(String(v))
  } catch {
    return new Decimal(NaN)
  }
}

function compare(
  db: SqlHandle, empresaId: string, name: string, rows: Row[], byCc: boolean, limit: number, encoding: string,
): ParityTable {
  const ledger = loadLedger(db, empresaId, byCc)
  const types = new Map(
    (db.prepare('SELECT code, type FROM coa_accounts WHERE empresa_id = ?').all(empresaId) as { code: string; type: string }[]).map((a) => [a.code, a.type]),
  )
  const out: ParityTable = {
    table: name, legacyRows: rows.length, monthsCompared: 0, accountsCompared: 0, rowsCompared: 0,
    rowsWithMismatch: 0, fieldMismatches: 0, byField: {}, byCause: { carried_from_earlier_month: 0, legacy_chain_broken: 0, legacy_row_inconsistent: 0, month_without_entries: 0, other: 0 },
    first: [], missingInLegacy: { count: 0, first: [] }, encoding,
  }
  const months = new Set<string>()
  const accounts = new Set<string>()
  const seen = new Set<string>()
  const legacySaldo = new Map<string, Decimal>()
  for (const r of rows) {
    legacySaldo.set(`${periodFromSalfec(str(r['salfec']))}|${str(r['cuenta'])}|${byCc ? str(r['ccosto']) : ''}`, dec(r['saldo']))
  }

  for (const r of rows) {
    const period = periodFromSalfec(str(r['salfec']))
    const account = str(r['cuenta'])
    const cc = byCc ? str(r['ccosto']) : ''
    months.add(period)
    accounts.add(account)
    seen.add(`${period}|${account}|${cc}`)
    out.rowsCompared++
    const mine = ledger.at(account, cc, period)

    const debitNature = ['activo', 'gastos', 'orden'].includes(types.get(account) ?? 'activo')
    const movement = dec(r['cargos']).minus(dec(r['abonos']))
    const expected = dec(r['saldoant']).plus(debitNature ? movement : movement.neg())
    const sameMovement = dec(r['cargos']).equals(mine.debit) && dec(r['abonos']).equals(mine.credit)
    const offsetPrev = dec(r['saldoant']).minus(mine.previous)
    const carried = sameMovement && dec(r['saldo']).minus(mine.balance).equals(offsetPrev)
    const prevSaldo = legacySaldo.get(`${addMonths(period, -1)}|${account}|${cc}`)
    const chainBroken = prevSaldo !== undefined && !prevSaldo.equals(dec(r['saldoant']))
    const cause: MismatchCause = carried
      ? 'carried_from_earlier_month'
      : chainBroken
      ? 'legacy_chain_broken'
      : !dec(r['saldo']).equals(expected)
      ? 'legacy_row_inconsistent'
      : !ledger.periodsWithEntries.has(period)
        ? 'month_without_entries'
        : 'other'

    let rowBad = false
    for (const [field, key] of FIELDS.map(([f, k]) => [f, k] as const)) {
      const legacy = dec(r[field])
      if (legacy.equals(mine[key])) continue
      rowBad = true
      out.fieldMismatches++
      out.byField[field] = (out.byField[field] ?? 0) + 1
      if (out.first.length < limit) {
        out.first.push({
          period, account, ...(byCc ? { costCenter: cc } : {}), field,
          legacy: legacy.toFixed(2), computed: mine[key].toFixed(2), cause,
        })
      }
    }
    if (rowBad) {
      out.rowsWithMismatch++
      out.byCause[cause]++
    }
  }
  out.monthsCompared = months.size
  out.accountsCompared = accounts.size

  for (const key of movementKeys(db, empresaId, byCc)) {
    if (seen.has(key)) continue
    const [period, account, cc] = key.split('|') as [string, string, string]
    const b = ledger.at(account, cc ?? '', period)
    if (b.debit.isZero() && b.credit.isZero()) continue
    out.missingInLegacy.count++
    if (out.missingInLegacy.first.length < limit) {
      out.missingInLegacy.first.push({ period, account, ...(byCc ? { costCenter: cc } : {}) })
    }
  }
  return out
}

// Recomputes balances from the imported lines and compares them to the cent with
// the legacy SALDOS (per account) and SALDOCC (per account and cost center).
export function checkContacParity(
  db: SqlHandle, sourceDir: string, empresaId: string, options: ParityOptions = {},
): ParityReport {
  const limit = options.limit ?? 20
  const run = (name: string, byCc: boolean): ParityTable | null => {
    const table = openTable(sourceDir, name)
    if (!table) return null
    const rows = [...table.records()].map((r) => r.values)
    return compare(db, empresaId, name.toUpperCase(), rows, byCc, limit, table.encoding)
  }
  const saldos = run('saldos', false)
  const saldocc = run('saldocc', true)
  const ok = [saldos, saldocc].every((t) => t === null || (t.fieldMismatches === 0 && t.missingInLegacy.count === 0))
  return { empresaId, saldos, saldocc, ok }
}
