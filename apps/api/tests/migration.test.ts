import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { MigrationRun } from '@accounting/shared'
import { createTestApp } from '../src/testing/test-app.js'
import { writeContac } from './legacy-import/fixture.js'
import { writeMcerp } from './legacy-import/parties-fixture.js'

type App = Awaited<ReturnType<typeof createTestApp>>

async function setup() {
  const t = await createTestApp({ modules: ['chart-of-accounts', 'general-ledger', 'parties'] })
  const root = mkdtempSync(path.join(tmpdir(), 'mcerp-ui-'))
  writeContac(path.join(root, 'CONTAC'))
  writeMcerp(root)
  writeFileSync(path.join(root, 'CONTAC', 'dbf', 'DBF.rar'), 'x')
  return { t, root, done: () => rmSync(root, { recursive: true, force: true }) }
}

async function waitRun(t: App, id: string): Promise<MigrationRun> {
  for (let i = 0; i < 200; i++) {
    const r = await t.request(`/api/migration/runs/${id}`)
    if (r.json.status !== 'running') return r.json
    await new Promise((res) => setTimeout(res, 25))
  }
  throw new Error('trial did not finish')
}

const count = (t: App, sql: string) => (t.sqlite.prepare(sql).get() as { n: number }).n

test('inspect: modules, tables, archives and copy findings, read-only', async () => {
  const s = await setup()
  try {
    const res = await s.t.request('/api/migration/inspect', { body: { root: s.root } })
    assert.equal(res.status, 200)
    const contac = res.json.modules.find((m: { id: string }) => m.id === 'CONTAC')
    assert.ok(contac.folder)
    const partidas = contac.tables.find((x: { table: string }) => x.table === 'PARTIDAS')
    assert.equal(partidas.found, true)
    assert.ok(partidas.live > 0)
    assert.deepEqual(res.json.archives, [path.join('CONTAC', 'dbf', 'DBF.rar')])
    const keys = res.json.findings.map((f: { key: string }) => f.key)
    assert.ok(keys.includes('copia:archivo_comprimido'))
    assert.ok(keys.includes('copia:modulo_ausente'))
    const bad = await s.t.request('/api/migration/inspect', { body: { root: path.join(s.root, 'nope') } })
    assert.equal(bad.status, 400)
    assert.equal(bad.json.code, 'invalid_root')
  } finally {
    s.done()
  }
})

test('trial run imports into a copy: counts and findings, the real database is untouched', async () => {
  const s = await setup()
  try {
    const before = count(s.t, 'select count(*) as n from core_empresas')
    const start = await s.t.request('/api/migration/runs', { body: { root: s.root, importers: ['contac', 'parties'] } })
    assert.equal(start.status, 202)
    assert.equal(start.json.status, 'running')
    const run = await waitRun(s.t, start.json.id)
    assert.equal(run.status, 'ok', run.error ?? '')
    const contac = run.results.find((r) => r.importer === 'contac')!
    const parties = run.results.find((r) => r.importer === 'parties')!
    assert.equal(contac.counts['gl_journal_entries'], 5)
    assert.ok(parties.counts['partiesCreated']! > 0)
    assert.ok(parties.findings.some((f) => f.key === 'parties:nombre_distinto'))
    assert.ok(run.inspection?.modules.length)
    // Nothing reached the real database.
    assert.equal(count(s.t, 'select count(*) as n from core_empresas'), before)
    assert.equal(count(s.t, 'select count(*) as n from gl_journal_entries'), 0)
    assert.equal(count(s.t, 'select count(*) as n from pty_parties'), 0)
    const list = await s.t.request('/api/migration/runs')
    assert.equal(list.json[0].id, run.id)
    assert.ok(list.json[0].findings.decidir > 0)
  } finally {
    s.done()
  }
})

test('a failing importer stops its dependents; unknown importers are refused', async () => {
  const s = await setup()
  try {
    rmSync(path.join(s.root, 'CONTAC', 'dbf', 'partidas.DBF'), { force: true })
    rmSync(path.join(s.root, 'CONTAC', 'dbf', 'PARTIDAS.DBF'), { force: true })
    const start = await s.t.request('/api/migration/runs', { body: { root: s.root, importers: ['contac', 'parties'] } })
    const run = await waitRun(s.t, start.json.id)
    assert.equal(run.status, 'failed')
    assert.match(run.results.find((r) => r.importer === 'parties')!.error ?? '', /Contabilidad falló/)
    const unknown = await s.t.request('/api/migration/runs', { body: { root: s.root, importers: ['nope'] } })
    assert.equal(unknown.status, 400)
  } finally {
    s.done()
  }
})

test('decisions are kept by key; only owners (core.migration.run) reach the screen', async () => {
  const s = await setup()
  try {
    const put = await s.t.request('/api/migration/decisions', {
      method: 'PUT', body: { key: 'parties:nombre_distinto', decision: 'pendiente', note: 'Revisar con contabilidad' },
    })
    assert.equal(put.status, 200)
    await s.t.request('/api/migration/decisions', { method: 'PUT', body: { key: 'parties:nombre_distinto', decision: 'aceptar' } })
    const all = await s.t.request('/api/migration/decisions')
    assert.equal(all.json.length, 1)
    assert.equal(all.json[0].decision, 'aceptar')
    s.t.sqlite.prepare("insert into user (id, name, email, role, created_at, updated_at) values ('s1','S','s@x.com','supervisor','x','x')").run()
    assert.equal((await s.t.request('/api/migration/importers', { role: 'supervisor', userId: 's1' })).status, 403)
    assert.equal(count(s.t, "select count(*) as n from core_audit_log where action = 'decidir-hallazgo'"), 2)
  } finally {
    s.done()
  }
})
