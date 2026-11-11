import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { checkContacParity, importContac, ImportRefusedError, type SqlHandle } from '@accounting/legacy-import'
import { createTestApp } from '../../src/testing/test-app.js'
import { GOOD_SALDOS, writeContac } from './fixture.js'
import type { Cell } from './dbf-writer.js'

// The platform test DB, with real migrations. Its TS type hides `transaction`, but the
// runtime object is a better-sqlite3 Database.
async function setup(saldos?: Cell[][]) {
  const t = await createTestApp({ modules: ['chart-of-accounts', 'general-ledger'] })
  const dir = mkdtempSync(path.join(tmpdir(), 'contac-test-'))
  writeContac(dir, saldos)
  const db = t.sqlite as unknown as SqlHandle
  const one = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as Record<string, unknown>
  return { db, dir, one, done: () => rmSync(dir, { recursive: true, force: true }) }
}

test('imports a synthetic CONTAC folder end to end', async () => {
  const s = await setup()
  try {
    const r = importContac(s.db, { sourceDir: s.dir, userId: 'u1' })
    assert.equal(r.empresa.siglas, 'TS')
    assert.deepEqual(r.empresas, [{ siglas: 'TS', withData: true }])
    assert.equal(s.one('SELECT moneda, name FROM core_empresas WHERE siglas = ?', 'TS')['moneda'], 'USD')
    assert.ok(r.warnings['moneda'])
    assert.equal(r.counts['gl_journal_entries'], 5)
    assert.equal(r.counts['gl_journal_lines'], 10)
    assert.equal(r.counts['coa_accounts'], 7) // 6 + placeholder
    assert.equal(r.source['PARTIDAS']!.deleted, 1)
    assert.equal(r.source['DETAPART']!.deleted, 1)

    // Unbalanced entry is imported as-is and flagged.
    assert.deepEqual(r.unbalancedEntries, [{ key: '202401|01|000002', difference: '6.00' }])
    const flags = s.db.prepare('SELECT source_ref, imported_unbalanced AS u, status, source FROM gl_journal_entries').all() as Record<string, unknown>[]
    assert.equal(flags.filter((f) => f['u'] === 1).length, 1)
    assert.ok(flags.every((f) => f['status'] === 'aplicada' && f['source'] === 'importado'))

    // Lines without a header get one.
    assert.deepEqual(r.orphanHeaders, [{ key: '202401|02|000001', lines: 2 }])
    const orphan = s.one("SELECT concept, date, period FROM gl_journal_entries WHERE source_ref = '202401|02|000001'")
    assert.deepEqual(orphan, { concept: '(sin encabezado en el sistema anterior)', date: '2024-01-21', period: '2024-01' })
    assert.deepEqual(r.placeholders.entryTypes, ['02'])

    // Unknown account → placeholder, lines kept.
    assert.deepEqual(r.placeholders.accounts, ['99'])
    const ph = s.one("SELECT name, (SELECT COUNT(*) FROM gl_journal_lines l WHERE l.account_id = a.id) AS n FROM coa_accounts a WHERE code = '99'")
    assert.deepEqual(ph, { name: '(cuenta no encontrada en el catálogo anterior)', n: 1 })

    // Amounts stay exact strings, line order kept, parents linked.
    assert.equal(s.one("SELECT debit FROM gl_journal_lines WHERE debit = '100.50'")['debit'], '100.50')
    assert.equal(s.one("SELECT COUNT(*) AS n FROM coa_accounts WHERE parent_id IS NOT NULL")['n'], 3)
    assert.equal(s.one("SELECT width FROM (SELECT number_width AS width FROM gl_entry_types WHERE code = '01')")['width'], 6)

    // Months: January has a closed and an open entry → open and reported as mixed.
    assert.deepEqual(r.periods, { closed: 1, open: 1, mixed: ['2024-01'] })
    assert.equal(r.counts['gl_fiscal_years'], 1)
    assert.deepEqual(r.budgets, { rowsRead: 2, rowsImported: 1, rowsSkipped: 1, monthsImported: 1 })
    assert.ok(r.warnings['presupuesto_cuenta_no_encontrada'])
    assert.equal(s.one('SELECT COUNT(*) AS n FROM core_audit_log')['n'], 1)
  } finally {
    s.done()
  }
})

test('refuses a second import unless replace is set, keeping the empresa id', async () => {
  const s = await setup()
  try {
    const first = importContac(s.db, { sourceDir: s.dir })
    assert.throws(() => importContac(s.db, { sourceDir: s.dir }), ImportRefusedError)
    // The refused run left nothing behind.
    assert.equal(s.one('SELECT COUNT(*) AS n FROM gl_journal_entries')['n'], 5)
    const second = importContac(s.db, { sourceDir: s.dir, replace: true })
    assert.equal(second.empresa.id, first.empresa.id)
    assert.equal(second.empresa.replaced, true)
    assert.equal(s.one('SELECT COUNT(*) AS n FROM gl_journal_entries')['n'], 5)
    assert.equal(s.one('SELECT COUNT(*) AS n FROM gl_journal_lines')['n'], 10)
    assert.equal(s.one('SELECT COUNT(*) AS n FROM coa_accounts')['n'], 7)
    assert.equal(s.one("SELECT COUNT(*) AS n FROM core_empresas WHERE siglas = 'TS'")['n'], 1)
  } finally {
    s.done()
  }
})

test('parity passes on consistent legacy balances', async () => {
  const s = await setup()
  try {
    const r = importContac(s.db, { sourceDir: s.dir })
    const p = checkContacParity(s.db, s.dir, r.empresa.id)
    assert.equal(p.ok, true)
    assert.equal(p.saldos!.monthsCompared, 2)
    assert.equal(p.saldos!.accountsCompared, 7)
    assert.equal(p.saldos!.rowsCompared, GOOD_SALDOS.length)
    assert.equal(p.saldos!.fieldMismatches, 0)
    assert.equal(p.saldos!.missingInLegacy.count, 0)
    assert.equal(p.saldocc, null) // no SALDOCC in the fixture
  } finally {
    s.done()
  }
})

test('parity reports a mismatch when the legacy balance is off by a cent', async () => {
  const bad = GOOD_SALDOS.map((row) => (row[0] === '202402' && row[1] === '11' ? [...row.slice(0, 5), '135.51', row[6]!] : row))
  const s = await setup(bad as Cell[][])
  try {
    const r = importContac(s.db, { sourceDir: s.dir })
    const p = checkContacParity(s.db, s.dir, r.empresa.id)
    assert.equal(p.ok, false)
    assert.equal(p.saldos!.fieldMismatches, 1)
    assert.equal(p.saldos!.rowsWithMismatch, 1)
    assert.deepEqual(p.saldos!.first[0], {
      period: '2024-02', account: '11', field: 'saldo', legacy: '135.51', computed: '135.50', cause: 'legacy_row_inconsistent',
    })
  } finally {
    s.done()
  }
})

test('parity flags computed movement that legacy balances omit', async () => {
  const s = await setup(GOOD_SALDOS.filter((row) => !(row[0] === '202401' && row[1] === '31')))
  try {
    const r = importContac(s.db, { sourceDir: s.dir })
    const p = checkContacParity(s.db, s.dir, r.empresa.id)
    assert.equal(p.ok, false)
    assert.equal(p.saldos!.missingInLegacy.count, 1)
    assert.deepEqual(p.saldos!.missingInLegacy.first, [{ period: '2024-01', account: '31' }])
  } finally {
    s.done()
  }
})
