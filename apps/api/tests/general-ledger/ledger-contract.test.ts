import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Db, LedgerPosting, ServiceContext } from '@accounting/shared/server'
import type { PostEntryRequest } from '@accounting/shared'
import { writeAudit } from '../../src/lib/audit.js'
import { account, entryType, get, newApp, post, put, type App } from './fixtures.js'

// The ledger contract (contratos.md §1) driven as a consumer module would:
// through the service registry, with a context on the consumer's transaction.
async function setup() {
  const t = await newApp()
  const cash = account(t, { code: '1101' })
  const income = account(t, { code: '4101', type: 'ingresos' })
  const typeId = await entryType(t, 'CH')
  const registry = t.directory.forActive(new Set(['chart-of-accounts', 'general-ledger']))
  const ledger = (db: Db = t.db) => {
    const ctx: ServiceContext = {
      db, empresaId: t.empresaId, userId: 'bank-user', role: 'digitador',
      audit: (entry, tx) => writeAudit(tx ?? db, { userId: 'bank-user', empresaId: t.empresaId }, entry),
    }
    return registry.require<LedgerPosting>('ledger', ctx)
  }
  const req = (over: Partial<PostEntryRequest> = {}): PostEntryRequest => ({
    source: 'bancos', sourceRef: 'doc-1', entryTypeId: typeId, date: '2026-03-10', concept: 'Cheque 100',
    lines: [{ accountId: income, debit: '0.00', credit: '50.00' }, { accountId: cash, debit: '50.00', credit: '0.00' }],
    ...over,
  })
  return { t, ledger, req, cash, income }
}

const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return (e as { code?: string }).code }
  return 'no_error'
}
const count = (t: App, sql: string, ...args: unknown[]) => (t.sqlite.prepare(sql).get(...args) as { n: number }).n

test('post: applied, numbered by the GL, idempotent, read-only in the GL screens', async () => {
  const { t, ledger, req } = await setup()
  const ref = ledger().post(req())
  assert.equal(ref.period, '2026-03')
  assert.equal(ref.number, '000001')
  assert.equal(ledger().post(req()).entryId, ref.entryId)
  assert.equal(code(() => ledger().post(req({ concept: 'otro' }))), 'already_posted')
  const entry = await get(t, `/entries/${ref.entryId}`)
  assert.equal(entry.json.status, 'aplicada')
  assert.equal(entry.json.source, 'bancos')
  assert.equal(entry.json.editable, false)
  assert.equal((await post(t, `/entries/${ref.entryId}/void`)).json.code, 'entry_from_other_module')
  assert.notEqual((await put(t, `/entries/${ref.entryId}`, {})).status, 200)
  assert.equal(ledger().find({ source: 'bancos', sourceRef: 'doc-1' })?.entryId, ref.entryId)
  assert.equal(count(t, "select count(*) as n from core_audit_log where action = 'contabilizar'"), 1)
})

test('post validates like manual capture: balance, lines, origin, closed month', async () => {
  const { t, ledger, req, cash } = await setup()
  const unbalanced = req({
    lines: [{ accountId: cash, debit: '10.00', credit: '0.00' }, { accountId: cash, debit: '0.00', credit: '9.00' }],
  })
  assert.equal(code(() => ledger().post(unbalanced)), 'unbalanced')
  assert.equal(code(() => ledger().post(req({ lines: [req().lines[0]!] }))), 'too_few_lines')
  assert.equal(code(() => ledger().post(req({ source: 'manual' as never }))), 'invalid_source')
  await post(t, '/periods/2026-03/close')
  assert.equal(code(() => ledger().post(req())), 'period_closed')
  assert.equal(count(t, 'select count(*) as n from gl_journal_entries'), 0)
})

test('reversion: an error after post inside the consumer transaction leaves nothing written', async () => {
  const { t, ledger, req } = await setup()
  assert.throws(() =>
    t.db.transaction((tx) => {
      ledger(tx as unknown as Db).post(req())
      throw new Error('document failed after posting')
    }),
  )
  assert.equal(count(t, 'select count(*) as n from gl_journal_entries'), 0)
  assert.equal(count(t, 'select count(*) as n from gl_journal_lines'), 0)
  assert.equal(count(t, "select count(*) as n from core_audit_log where action = 'contabilizar'"), 0)
  assert.equal(ledger().post(req()).number, '000001')
})

test('replace: in place in the same month and type; new entry when the month changes; refused when closed', async () => {
  const { t, ledger, req, cash, income } = await setup()
  const first = ledger().post(req())
  const lines = [{ accountId: income, debit: '0.00', credit: '70.00' }, { accountId: cash, debit: '70.00', credit: '0.00' }]
  const same = ledger().replace(req({ lines, concept: 'Cheque 100 corregido' }))
  assert.equal(same.entryId, first.entryId)
  assert.equal(same.number, first.number)
  const moved = ledger().replace(req({ lines, date: '2026-04-02' }))
  assert.notEqual(moved.entryId, first.entryId)
  assert.equal(moved.period, '2026-04')
  assert.equal(count(t, 'select count(*) as n from gl_journal_entries where id = ? and is_active = 0', first.entryId), 1)
  await post(t, '/periods/2026-04/close')
  assert.equal(code(() => ledger().replace(req({ lines, date: '2026-04-03' }))), 'period_closed')
  assert.equal(code(() => ledger().replace(req({ sourceRef: 'nope' }))), 'entry_not_found')
})

test('void: anulada in an open month; reversal in an open month when the original month is closed', async () => {
  const { t, ledger, req } = await setup()
  ledger().post(req())
  const open = ledger().void({ source: 'bancos', sourceRef: 'doc-1' }, { date: '2026-03-20', reason: 'Cheque mal emitido' })
  assert.equal(open.kind, 'anulada')
  assert.equal(ledger().find({ source: 'bancos', sourceRef: 'doc-1' }), null)

  ledger().post(req({ sourceRef: 'doc-2' }))
  await post(t, '/periods/2026-03/close')
  const key = { source: 'bancos' as const, sourceRef: 'doc-2' }
  assert.equal(code(() => ledger().void(key, { date: '2026-03-25', reason: 'motivo' })), 'period_closed')
  const rev = ledger().void(key, { date: '2026-04-05', reason: 'Cheque anulado' })
  assert.equal(rev.kind, 'reversada')
  if (rev.kind !== 'reversada') return
  assert.equal(rev.reversal.period, '2026-04')
  assert.equal(rev.original.reversedBy, rev.reversal.entryId)
  const lines = t.sqlite
    .prepare('select debit, credit from gl_journal_lines where entry_id = ? order by line_no')
    .all(rev.reversal.entryId)
  assert.deepEqual(lines, [{ debit: '50.00', credit: '0.00' }, { debit: '0.00', credit: '50.00' }])
  assert.equal(code(() => ledger().void(key, { date: '2026-04-06', reason: 'otra vez' })), 'entry_voided')
  const tb = await get(t, '/reports/trial-balance?period=2026-04')
  assert.equal(tb.json.rows.find((r: { code: string }) => r.code === '1101').balance, '0.00')
})

test('preview validates without writing', async () => {
  const { t, ledger, req } = await setup()
  assert.deepEqual(ledger().preview(req()), {
    period: '2026-03', nextNumber: '000001', totals: { debit: '50.00', credit: '50.00' },
  })
  assert.equal(count(t, 'select count(*) as n from gl_journal_entries'), 0)
})
