import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reattributeEntries, type SqlHandle } from '@accounting/legacy-import'
import { account, entry, entryType, get, newApp } from '../general-ledger/fixtures.js'

async function setup() {
  const t = await newApp()
  const a = account(t, { code: '1101' })
  const b = account(t, { code: '2101', type: 'pasivo' })
  const pd = await entryType(t, 'CH')
  const lines = [{ a, d: '10.00' }, { a: b, c: '10.00' }]
  const e1 = await entry(t, pd, '2024-01', lines)
  const e2 = await entry(t, pd, '2024-01', lines)
  const mark = t.sqlite.prepare("update gl_journal_entries set source = 'importado', source_ref = ?, legacy_ref = ? where id = ?")
  mark.run('202401|CH|000001', '202401|CH|000001', e1.id)
  mark.run('202401|CH|000002', '202401|CH|000002', e2.id)
  return { t, e1, e2, db: t.sqlite as unknown as SqlHandle }
}

test('reattributeEntries: moves imported entries to their module, idempotent, reports misses', async () => {
  const { t, e1, e2, db } = await setup()
  const items = [
    { legacyKey: '202401|CH|000001', toSource: 'bancos', sourceRef: 'bnk-1', confidence: 'exacta' as const },
    { legacyKey: '202401|CH|000009', toSource: 'bancos', sourceRef: 'bnk-9', confidence: 'exacta' as const },
    { legacyKey: '202401|CH|000001', toSource: 'bancos', sourceRef: 'bnk-1', confidence: 'exacta' as const },
  ]
  const r = reattributeEntries(db, t.empresaId, items, { now: '2026-11-15T00:00:00.000Z' })
  assert.deepEqual(r, { updated: 1, notFound: ['202401|CH|000009'], duplicates: ['202401|CH|000001'] })
  const row = t.sqlite.prepare('select source, source_ref, origin_confidence from gl_journal_entries where id = ?').get(e1.id)
  assert.deepEqual(row, { source: 'bancos', source_ref: 'bnk-1', origin_confidence: 'exacta' })
  assert.equal((await get(t, `/entries/${e1.id}`)).json.editable, false)
  assert.equal((t.sqlite.prepare('select source from gl_journal_entries where id = ?').get(e2.id) as { source: string }).source, 'importado')
  // Running again changes nothing: the entry is no longer 'importado'.
  assert.equal(reattributeEntries(db, t.empresaId, [items[0]!]).updated, 0)
  const audits = t.sqlite.prepare("select count(*) as n from core_audit_log where action = 'reatribuir'").get() as { n: number }
  assert.equal(audits.n, 2)
  assert.throws(() => reattributeEntries(db, t.empresaId, [{ ...items[0]!, toSource: 'manual' }]))
})
