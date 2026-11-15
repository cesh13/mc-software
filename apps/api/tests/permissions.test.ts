import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, registerPermissions } from '@accounting/shared'
import { createTestApp } from '../src/testing/test-app.js'

type T = Awaited<ReturnType<typeof createTestApp>>

const setup = () => createTestApp({ modules: ['chart-of-accounts', 'general-ledger'] })

function addUser(app: T, id: string, role: string) {
  app.sqlite
    .prepare("insert into user (id, name, email, role, created_at, updated_at) values (?, ?, ?, ?, 'x', 'x')")
    .run(id, `Nombre ${id}`, `${id}@x.com`, role)
}

function grantEmpresa(app: T, userId: string, empresaId: string) {
  app.sqlite.prepare("insert into core_user_empresas values (?, ?, 'x')").run(userId, empresaId)
}

function addEmpresa(app: T, id: string) {
  app.sqlite
    .prepare("insert into core_empresas (id, name, siglas, created_at, updated_at) values (?, ?, ?, 'x', 'x')")
    .run(id, `Empresa ${id}`, id.toUpperCase().slice(0, 8))
}

const setOverrides = (app: T, userId: string, overrides: unknown[]) =>
  app.request(`/api/permissions/users/${userId}`, { method: 'PUT', body: { overrides } })

test('can(): empresa override beats global override, which beats packages', () => {
  registerPermissions([{ id: 'x.thing.view', label: 'x', group: 'x', packages: ['reports'] }])
  const deny = { permission: 'x.thing.view', effect: 'deny' as const, empresaId: null }
  const grantA = { permission: 'x.thing.view', effect: 'grant' as const, empresaId: 'A' }
  assert.equal(can('consulta', 'x.thing.view'), true)
  assert.equal(can('consulta', 'x.thing.view', { overrides: [deny] }), false)
  assert.equal(can('consulta', 'x.thing.view', { overrides: [deny, grantA], empresaId: 'A' }), true)
  assert.equal(can('consulta', 'x.thing.view', { overrides: [deny, grantA], empresaId: 'B' }), false)
  assert.equal(can('owner', 'x.thing.view', { overrides: [deny] }), true)
  assert.equal(can('digitador', 'unknown.permission'), false)
})

test('every module route declares a permission', async () => {
  const app = await setup()
  addUser(app, 'nobody', 'sin_rol')
  grantEmpresa(app, 'nobody', 'empresa-test')
  const routes = app.app.routes.filter(
    (r) => /^\/api\/(general-ledger|chart-of-accounts)\//.test(r.path) && r.method !== 'ALL',
  )
  assert.ok(routes.length > 30)
  const open: string[] = []
  for (const r of routes) {
    const url = r.path.replace(/:\w+/g, 'x').replace(/\*$/, 'x')
    // A role outside the catalog has no permission at all: anything but 403 means the route is open.
    const res = await app.request(url, {
      method: r.method, role: 'sin_rol', userId: 'nobody', body: r.method === 'GET' ? undefined : {},
    })
    if (res.status !== 403 || res.json?.code === 'empresa_forbidden') open.push(`${r.method} ${r.path} → ${res.status}`)
  }
  assert.deepEqual(open, [])
})

test('roles keep the access they had', async () => {
  const app = await setup()
  addUser(app, 'user-test', 'digitador')
  grantEmpresa(app, 'user-test', 'empresa-test')
  assert.equal((await app.request('/api/general-ledger/entries?period=2024-01', { role: 'digitador' })).status, 200)
  assert.equal((await app.request('/api/general-ledger/reports/journal?period=2024-01', { role: 'digitador' })).status, 403)
  assert.equal((await app.request('/api/general-ledger/reports/journal?period=2024-01', { role: 'consulta' })).status, 200)
  assert.equal((await app.request('/api/chart-of-accounts/accounts', { role: 'consulta' })).status, 200)
  const create = await app.request('/api/chart-of-accounts/accounts', { role: 'consulta', body: {} })
  assert.equal(create.status, 403)
})

test('a deny override hides a screen; a per-empresa grant stays in its empresa', async () => {
  const app = await setup()
  addEmpresa(app, 'empresa-b')
  addUser(app, 'u1', 'digitador_consulta')
  grantEmpresa(app, 'u1', 'empresa-test')
  grantEmpresa(app, 'u1', 'empresa-b')
  const put = await setOverrides(app, 'u1', [
    { permission: 'gl.entry.view', effect: 'deny', empresaId: null },
    { permission: 'gl.period.close', effect: 'grant', empresaId: 'empresa-b' },
  ])
  assert.equal(put.status, 200)
  const as = (empresaId: string) => ({ role: 'digitador_consulta', userId: 'u1', empresaId })
  assert.equal((await app.request('/api/general-ledger/entries?period=2024-01', as('empresa-test'))).status, 403)
  assert.equal((await app.request('/api/general-ledger/periods/2024-01/close', { ...as('empresa-test'), body: {} })).status, 403)
  assert.equal((await app.request('/api/general-ledger/periods/2024-01/close', { ...as('empresa-b'), body: {} })).status, 200)

  const me = await app.request('/api/permissions/me?empresa=empresa-b', { role: 'digitador_consulta', userId: 'u1' })
  assert.ok(me.json.permissions.includes('gl.period.close'))
  assert.ok(!me.json.permissions.includes('gl.entry.view'))
  const other = await app.request('/api/permissions/me?empresa=empresa-test', { role: 'digitador_consulta', userId: 'u1' })
  assert.ok(!other.json.permissions.includes('gl.period.close'))

  const n = app.sqlite.prepare("select count(*) as n from core_audit_log where action = 'permisos'").get() as { n: number }
  assert.equal(n.n, 1)
})

test('override rules: owners cannot be denied, unknown permissions are rejected, only managers edit', async () => {
  const app = await setup()
  addUser(app, 'o2', 'owner')
  addUser(app, 'd1', 'digitador')
  const deny = await setOverrides(app, 'o2', [{ permission: 'gl.entry.view', effect: 'deny', empresaId: null }])
  assert.equal(deny.status, 409)
  const unknown = await setOverrides(app, 'd1', [{ permission: 'gl.nope', effect: 'grant', empresaId: null }])
  assert.equal(unknown.status, 400)
  const byDigitador = await app.request('/api/permissions/users/d1', { role: 'digitador', userId: 'd1' })
  assert.equal(byDigitador.status, 403)
  const view = await app.request('/api/permissions/users/d1')
  assert.equal(view.status, 200)
  assert.ok(view.json.effective.includes('gl.entry.create'))
  assert.ok(!view.json.effective.includes('gl.report.view'))
})
