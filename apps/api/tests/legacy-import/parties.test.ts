import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { importParties, type SqlHandle } from '@accounting/legacy-import'
import { createTestApp } from '../../src/testing/test-app.js'
import { writeMcerp } from './parties-fixture.js'

async function setup() {
  const t = await createTestApp({ modules: ['parties'] })
  const dir = mkdtempSync(path.join(tmpdir(), 'parties-test-'))
  writeMcerp(dir)
  // A party captured in the platform before the import, with an NRC the IVA book also has.
  const manual = await t.request('/api/parties/parties', { body: { code: 'M1', name: 'Capturado', isCustomer: true, nrc: '99-9' } })
  assert.equal(manual.status, 201)
  const db = t.sqlite as unknown as SqlHandle
  const party = (code: string) => db.prepare('SELECT * FROM pty_parties WHERE code = ?').get(code) as Record<string, unknown>
  const refs = (code: string) => JSON.parse(String(party(code)['legacy_refs'])) as { table: string; key: string }[]
  return { t, db, dir, party, refs, done: () => rmSync(dir, { recursive: true, force: true }) }
}

test('imports the legacy masters and merges by NRC, then NIT', async () => {
  const s = await setup()
  try {
    const r = importParties(s.db, { sourceRoot: s.dir, now: '2026-11-15T00:00:00.000Z' })
    assert.equal(r.empresa.id, s.t.empresaId)
    assert.deepEqual(r.missingSources, ['INV64.CONTRIBU', 'INV64.CLIENTES'])
    assert.equal(r.source['CXC64.CCCLI01']!.live, 4)
    assert.equal(r.source['CXC64.CCCLI01']!.deleted, 1)
    assert.equal(r.rowsRead, 13)
    assert.deepEqual(r.counts, {
      partiesCreated: 6, partiesUpdated: 1, customers: 3, suppliers: 5, bothRoles: 2,
      persons: 1, companies: 5, inactive: 1, withoutTaxId: 2, codesGeneratedNoLegacyCode: 0, codesGeneratedCodeTaken: 1,
    })
    assert.deepEqual(r.mergesSummary, { total: 3, bothRoles: 2, repeatedInSource: 1, byNit: 1, intoExisting: 1 })
    assert.deepEqual(r.conflictsSummary, { nombre_distinto: 2, nit_distinto: 0, nit_en_varios_nrc: 0, mismo_nit_distinto_nrc: 0 })
    assert.deepEqual(r.conflicts.map((c) => c.key).sort(), ['nrc:12345-6', 'nrc:777-7'])
    assert.equal(r.warnings['nrc_invalido']!.count, 1)

    // Customer + both supplier copies + the IVA book's copy became one party.
    const uno = s.party('C001')
    assert.equal(uno['name'], 'Ferreteria Uno S.A. de C.V.')
    assert.equal(uno['trade_name'], 'La Uno')
    assert.deepEqual([uno['nrc'], uno['nit'], uno['is_customer'], uno['is_supplier']], ['12345-6', '0614-150190-101-1', 1, 1])
    assert.deepEqual(s.refs('C001').map((x) => `${x.table}|${x.key}`), [
      'CXC64.CCCLI01|C001', 'CONTAC.PROVEDOR|P01', 'IVA64.CLIENTES|12345-6', 'INV64.PROVEDOR|0P01',
    ])
    // Two customer codes with the same NRC (written differently) are one party.
    assert.deepEqual(s.refs('C003').map((x) => x.key), ['C003', 'C004', 'P02'])
    assert.equal(s.party('C003')['is_foreign'], 1)
    // CCCLI01 name = razón social FRES; FNCLI becomes the trade name.
    assert.deepEqual([s.party('C003')['name'], s.party('C003')['trade_name']], ['Comercial Tres S.A.', 'Tienda Tres'])
    // P03 has no NRC; its NIT matches the IVA supplier 55-5.
    assert.deepEqual([s.party('P03')['nrc'], s.party('P03')['is_supplier']], ['55-5', 1])
    // The captured party gained the supplier role and the legacy ref.
    assert.deepEqual([s.party('M1')['is_customer'], s.party('M1')['is_supplier'], s.party('M1')['name']], [1, 1, 'Capturado'])
    // Code C002 belongs to the customer; the supplier with that code got a generated one.
    assert.deepEqual([s.party('C002')['kind'], s.party('C002')['is_active'], s.party('C002')['dui']], ['person', 0, '01234567-8'])
    assert.deepEqual(s.refs('T00006'), [{ table: 'CONTAC.PROVEDOR', key: 'C002' }])
    assert.equal(s.party('P05')['nrc'], null)
    const audit = s.db.prepare("SELECT COUNT(*) AS n FROM core_audit_log WHERE module = 'legacy-import' AND entity = 'parties'").get() as { n: number }
    assert.equal(audit.n, 1)
  } finally {
    s.done()
  }
})

test('a second run imports nothing new; --replace repeats the load', async () => {
  const s = await setup()
  try {
    importParties(s.db, { sourceRoot: s.dir })
    const count = () => (s.db.prepare('SELECT COUNT(*) AS n FROM pty_parties').get() as { n: number }).n
    assert.equal(count(), 7)

    const again = importParties(s.db, { sourceRoot: s.dir })
    assert.equal(again.rowsAlreadyImported, 13)
    assert.equal(again.counts.partiesCreated, 0)
    assert.equal(count(), 7)

    const replaced = importParties(s.db, { sourceRoot: s.dir, replace: true })
    assert.deepEqual(replaced.replaced, { deleted: 6, detached: 1 })
    assert.equal(replaced.counts.partiesCreated, 6)
    assert.equal(replaced.counts.partiesUpdated, 1)
    assert.equal(count(), 7)
    assert.deepEqual(s.refs('M1'), [{ table: 'IVA64.CONTRIBU', key: '99-9' }])
  } finally {
    s.done()
  }
})

test('refuses an unknown empresa and a missing folder', async () => {
  const s = await setup()
  try {
    assert.throws(() => importParties(s.db, { sourceRoot: s.dir, siglas: 'NO' }), /La empresa NO no existe/)
    assert.throws(() => importParties(s.db, { sourceRoot: path.join(s.dir, 'nada') }), /No existe la carpeta/)
    assert.equal((s.db.prepare('SELECT COUNT(*) AS n FROM pty_parties').get() as { n: number }).n, 1)
  } finally {
    s.done()
  }
})
