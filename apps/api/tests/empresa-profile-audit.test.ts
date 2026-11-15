import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../src/testing/test-app.js'

type T = Awaited<ReturnType<typeof createTestApp>>

const setup = () => createTestApp({ modules: [] })

function addUser(app: T, id: string, role: string) {
  app.sqlite
    .prepare("insert into user (id, name, email, role, created_at, updated_at) values (?, ?, ?, ?, 'x', 'x')")
    .run(id, `Nombre ${id}`, `${id}@x.com`, role)
  app.sqlite.prepare("insert into core_user_empresas values (?, ?, 'x')").run(id, app.empresaId)
}

function addEmpresa(app: T, id: string) {
  app.sqlite
    .prepare("insert into core_empresas (id, name, siglas, created_at, updated_at) values (?, ?, ?, 'x', 'x')")
    .run(id, `Empresa ${id}`, id.toUpperCase().slice(0, 8))
}

function addAudit(app: T, o: { id: string; empresa: string; user?: string; at: string; module?: string; action?: string; entity?: string; detail?: string }) {
  app.sqlite
    .prepare('insert into core_audit_log (id, empresa_id, user_id, at, module, action, entity, entity_id, detail) values (?,?,?,?,?,?,?,?,?)')
    .run(o.id, o.empresa, o.user ?? 'u1', o.at, o.module ?? 'core', o.action ?? 'crear', o.entity ?? 'thing', o.id, o.detail ?? null)
}

const profile = { legalName: 'Mi Empresa, S.A. de C.V.', nit: '0614-010101-101-1', nrc: '123456-7', email: 'a@b.com' }

test('profile: GET returns an empty profile before any save; PUT saves and audits before/after', async () => {
  const app = await setup()
  const url = `/api/empresa-profile/${app.empresaId}`
  const empty = await app.request(url)
  assert.equal(empty.status, 200)
  assert.equal(empty.json.legalName, '')
  assert.equal(empty.json.updatedAt, null)

  const put = await app.request(url, { method: 'PUT', body: profile })
  assert.equal(put.status, 200)
  assert.equal(put.json.nit, '0614-010101-101-1')
  assert.equal(put.json.updatedBy, 'user-test')

  await app.request(url, { method: 'PUT', body: { ...profile, legalName: 'Otro nombre' } })
  const rows = app.sqlite
    .prepare("select detail from core_audit_log where entity = 'empresa-profile' order by at, rowid")
    .all() as { detail: string }[]
  assert.equal(rows.length, 2)
  const first = JSON.parse(rows[0]!.detail)
  assert.equal(first.before, null)
  assert.equal(first.after.legalName, profile.legalName)
  const second = JSON.parse(rows[1]!.detail)
  assert.equal(second.before.legalName, profile.legalName)
  assert.equal(second.after.legalName, 'Otro nombre')
  assert.equal((await app.request(url)).json.legalName, 'Otro nombre')
})

test('profile: validation messages in Spanish; failed PUT writes nothing', async () => {
  const app = await setup()
  const url = `/api/empresa-profile/${app.empresaId}`
  const bad = await app.request(url, { method: 'PUT', body: { legalName: 'X', nit: 'ABC', nrc: '12 34', email: 'no' } })
  assert.equal(bad.status, 400)
  const msgs = bad.json.issues.map((i: { message: string }) => i.message).join(' ')
  assert.match(msgs, /NIT solo admite dígitos y guiones/)
  assert.match(msgs, /NRC solo admite dígitos y guiones/)
  assert.match(msgs, /correo no es válido/)
  const noName = await app.request(url, { method: 'PUT', body: { legalName: ' ' } })
  assert.equal(noName.status, 400)
  const n = app.sqlite.prepare("select count(*) n from core_audit_log where entity = 'empresa-profile'").get() as { n: number }
  assert.equal(n.n, 0)
})

test('profile: permissions and empresa isolation', async () => {
  const app = await setup()
  addUser(app, 'sup', 'supervisor')
  addUser(app, 'cons', 'consulta')
  addEmpresa(app, 'otra')
  const url = `/api/empresa-profile/${app.empresaId}`
  assert.equal((await app.request(url, { method: 'PUT', body: profile, role: 'consulta', userId: 'cons' })).status, 403)
  assert.equal((await app.request(url, { role: 'consulta', userId: 'cons' })).status, 200)
  assert.equal((await app.request(url, { method: 'PUT', body: profile, role: 'supervisor', userId: 'sup' })).status, 200)
  // No access to another empresa
  assert.equal((await app.request('/api/empresa-profile/otra', { role: 'supervisor', userId: 'sup' })).status, 403)
  assert.equal((await app.request('/api/empresa-profile/otra', { method: 'PUT', body: profile, role: 'supervisor', userId: 'sup' })).status, 403)
  assert.equal((await app.request('/api/empresa-profile/nope')).status, 404)
})

test('audit: requires core.audit.view; supervisor can, consulta cannot', async () => {
  const app = await setup()
  addUser(app, 'sup', 'supervisor')
  addUser(app, 'cons', 'consulta')
  assert.equal((await app.request('/api/audit', { role: 'consulta', userId: 'cons' })).status, 403)
  assert.equal((await app.request('/api/audit/export', { role: 'consulta', userId: 'cons' })).status, 403)
  assert.equal((await app.request('/api/audit', { role: 'supervisor', userId: 'sup' })).status, 200)
  assert.equal((await app.request('/api/audit', { role: 'supervisor', userId: 'sup', empresaId: null })).status, 400)
})

test('audit: filters, user name join, newest first, pagination', async () => {
  const app = await setup()
  addUser(app, 'u1', 'supervisor')
  const e = app.empresaId
  addAudit(app, { id: 'a1', empresa: e, at: '2026-01-01T10:00:00.000Z', module: 'core', action: 'crear', entity: 'empresa' })
  addAudit(app, { id: 'a2', empresa: e, at: '2026-01-02T10:00:00.000Z', module: 'gl', action: 'contabilizar', entity: 'entry', detail: '{"total":"10.00"}' })
  addAudit(app, { id: 'a3', empresa: e, at: '2026-01-03T23:59:00.000Z', module: 'gl', action: 'anular', entity: 'entry', user: 'u2' })
  const get = (qs = '') => app.request(`/api/audit?${qs}`)

  const all = await get()
  assert.deepEqual(all.json.rows.map((r: { id: string }) => r.id), ['a3', 'a2', 'a1'])
  assert.equal(all.json.total, 3)
  assert.equal(all.json.rows[2].userName, 'Nombre u1')
  assert.equal(all.json.rows[0].userName, null)

  const ids = async (qs: string) => (await get(qs)).json.rows.map((r: { id: string }) => r.id)
  assert.deepEqual(await ids('module=gl'), ['a3', 'a2'])
  assert.deepEqual(await ids('userId=u2'), ['a3'])
  assert.deepEqual(await ids('entity=empresa&entityId=a1'), ['a1'])
  assert.deepEqual(await ids('from=2026-01-02&to=2026-01-02'), ['a2'])
  assert.deepEqual(await ids('to=2026-01-03'), ['a3', 'a2', 'a1'])
  assert.deepEqual(await ids('q=contabilizar'), ['a2'])
  assert.deepEqual(await ids('q=10.00'), ['a2'])
  assert.deepEqual(await ids('q=%25'), [])

  const page = await get('limit=2&offset=1')
  assert.deepEqual(page.json.rows.map((r: { id: string }) => r.id), ['a2', 'a1'])
  assert.equal(page.json.total, 3)
  assert.equal((await get('limit=501')).status, 400)
  assert.equal((await get('from=hoy')).status, 400)
})

test('audit: empresa isolation and the all scope', async () => {
  const app = await setup()
  addUser(app, 'sup', 'supervisor')
  addEmpresa(app, 'otra')
  addAudit(app, { id: 'mine', empresa: app.empresaId, at: '2026-01-01T00:00:00.000Z' })
  addAudit(app, { id: 'theirs', empresa: 'otra', at: '2026-01-02T00:00:00.000Z' })
  const sup = { role: 'supervisor', userId: 'sup' }

  const own = await app.request('/api/audit', sup)
  assert.deepEqual(own.json.rows.map((r: { id: string }) => r.id), ['mine'])
  assert.equal((await app.request('/api/audit?empresaId=otra', sup)).status, 403)
  assert.equal((await app.request('/api/audit/export?empresaId=otra', sup)).status, 403)
  assert.equal((await app.request('/api/audit?empresaId=all', sup)).status, 403)
  // Header pointing at an empresa the supervisor lacks
  assert.equal((await app.request('/api/audit', { ...sup, empresaId: 'otra' })).status, 403)

  const everything = await app.request('/api/audit?empresaId=all')
  assert.equal(everything.status, 200)
  assert.equal(everything.json.total, 2)
  const other = await app.request('/api/audit?empresaId=otra')
  assert.deepEqual(other.json.rows.map((r: { id: string }) => r.id), ['theirs'])
})

test('audit: CSV export honours filters and escapes values', async () => {
  const app = await setup()
  addUser(app, 'u1', 'supervisor')
  addAudit(app, { id: 'c1', empresa: app.empresaId, at: '2026-01-01T00:00:00.000Z', action: 'crear', detail: '{"a":"x,y"}' })
  addAudit(app, { id: 'c2', empresa: app.empresaId, at: '2026-01-02T00:00:00.000Z', action: 'anular' })
  const res = await app.request('/api/audit/export?q=crear')
  assert.equal(res.status, 200)
  const csv = res.json as string
  assert.ok(csv.startsWith('Fecha,Usuario,Empresa'))
  assert.ok(csv.includes('"{""a"":""x,y""}"'))
  assert.ok(csv.includes('Nombre u1'))
  assert.ok(!csv.includes('anular'))
})
