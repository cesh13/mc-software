import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../src/testing/test-app.js'

type T = Awaited<ReturnType<typeof createTestApp>>

async function setup() {
  return createTestApp({
    modules: ['chart-of-accounts'],
    createAccount: async ({ name, email }) => {
      if (email === 'dup@x.com') throw new Error('User already exists')
      const id = `new-${email}`
      t.sqlite
        .prepare("insert into user (id, name, email, created_at, updated_at) values (?, ?, ?, 'x', 'x')")
        .run(id, name, email)
      return { id }
    },
  }).then((app) => ((t = app), app))
}
let t: T

function addUser(app: T, id: string, role: string, banned = 0) {
  app.sqlite
    .prepare(
      "insert into user (id, name, email, role, banned, created_at, updated_at) values (?, ?, ?, ?, ?, 'x', 'x')",
    )
    .run(id, `Nombre ${id}`, `${id}@x.com`, role, banned)
}

const audit = (app: T, action: string) =>
  (app.sqlite.prepare("select count(*) as n from core_audit_log where entity='usuario' and action=?").get(action) as { n: number }).n

test('lists users with their empresa ids', async () => {
  const app = await setup()
  addUser(app, 'u1', 'digitador')
  app.sqlite.prepare("insert into core_user_empresas values ('u1', 'empresa-test', 'x')").run()
  const res = await app.request('/api/users')
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, [
    { id: 'u1', name: 'Nombre u1', email: 'u1@x.com', role: 'digitador', banned: false, empresaIds: ['empresa-test'] },
  ])
})

test('only supervise-capable roles may use the route', async () => {
  const app = await setup()
  for (const role of ['digitador', 'consulta']) {
    assert.equal((await app.request('/api/users', { role })).status, 403)
    assert.equal((await app.request('/api/users', { role, body: {} })).status, 403)
  }
  const anon = await app.app.request('/api/users')
  assert.equal(anon.status, 401)
  assert.equal((await app.request('/api/users', { role: 'supervisor' })).status, 200)
})

test('creates a user with role and empresa grants, and audits it', async () => {
  const app = await setup()
  const res = await app.request('/api/users', {
    role: 'supervisor',
    body: { name: 'Ana', email: 'Ana@X.com', password: 'secreto123', role: 'digitador', empresaIds: ['empresa-test'] },
  })
  assert.equal(res.status, 201)
  assert.equal(res.json.role, 'digitador')
  assert.equal(res.json.email, 'ana@x.com')
  assert.deepEqual(res.json.empresaIds, ['empresa-test'])
  assert.equal(audit(app, 'crear'), 1)
})

test('rejects invalid input, alias roles, unknown empresas and duplicate emails', async () => {
  const app = await setup()
  const post = (body: object) => app.request('/api/users', { body })
  const ok = { name: 'Ana', email: 'ana@x.com', password: 'secreto123', role: 'consulta' }
  assert.equal((await post({ ...ok, password: 'corta' })).status, 400)
  assert.equal((await post({ ...ok, email: 'no-es-correo' })).status, 400)
  assert.equal((await post({ ...ok, name: ' ' })).status, 400)
  assert.equal((await post({ ...ok, role: 'admin' })).status, 400)
  assert.equal((await post({ ...ok, role: 'member' })).status, 400)
  const bad = await post({ ...ok, empresaIds: ['nope'] })
  assert.equal(bad.status, 400)
  assert.equal(bad.json.code, 'empresa_no_existe')
  assert.equal((await post(ok)).status, 201)
  const dup = await post(ok)
  assert.equal(dup.status, 409)
  assert.equal(dup.json.code, 'correo_duplicado')
  const dup2 = await post({ ...ok, email: 'dup@x.com' })
  assert.equal(dup2.status, 409)
})

test('patch changes name, role and ban; unknown user is 404; alias role is 400', async () => {
  const app = await setup()
  addUser(app, 'u1', 'consulta')
  const patch = (id: string, body: object, role = 'supervisor') =>
    app.request(`/api/users/${id}`, { method: 'PATCH', body, role })
  const r = await patch('u1', { name: 'Nuevo', role: 'digitador_consulta', banned: true })
  assert.equal(r.status, 200)
  assert.deepEqual([r.json.name, r.json.role, r.json.banned], ['Nuevo', 'digitador_consulta', true])
  assert.equal(audit(app, 'bloquear'), 1)
  assert.equal((await patch('u1', { banned: false })).json.banned, false)
  assert.equal(audit(app, 'desbloquear'), 1)
  assert.equal((await patch('nope', { name: 'x' })).status, 404)
  assert.equal((await patch('u1', { role: 'admin' })).status, 400)
  assert.equal((await patch('u1', { name: 'x' }, 'digitador')).status, 403)
})

test('replaces empresa grants and the module empresa check follows them', async () => {
  const app = await setup()
  addUser(app, 'u1', 'digitador')
  const url = '/api/chart-of-accounts/accounts'
  assert.equal((await app.request(url, { role: 'digitador', userId: 'u1' })).status, 403)

  const put = (empresaIds: string[], role = 'supervisor') =>
    app.request('/api/users/u1/empresas', { method: 'PUT', body: { empresaIds }, role })
  const ok = await put(['empresa-test'])
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.json.empresaIds, ['empresa-test'])
  assert.equal((await app.request(url, { role: 'digitador', userId: 'u1' })).status, 200)

  assert.equal((await put(['empresa-test', 'nope'])).status, 400)
  assert.equal((await put([], 'digitador')).status, 403)
  assert.equal((await app.request('/api/users/zz/empresas', { method: 'PUT', body: { empresaIds: [] } })).status, 404)
  assert.equal((await put([])).status, 200)
  assert.equal((await app.request(url, { role: 'digitador', userId: 'u1' })).status, 403)
  assert.equal(audit(app, 'asignar-empresas'), 2)
})

test('a user cannot change their own role or block themself', async () => {
  const app = await setup()
  addUser(app, 'sup', 'supervisor')
  const patch = (body: object) => app.request('/api/users/sup', { method: 'PATCH', body, role: 'supervisor', userId: 'sup' })
  const role = await patch({ role: 'consulta' })
  assert.equal(role.status, 403)
  assert.equal(role.json.code, 'propio_rol')
  const ban = await patch({ banned: true })
  assert.equal(ban.status, 403)
  assert.equal(ban.json.code, 'propio_bloqueo')
  assert.equal((await patch({ name: 'Yo', role: 'supervisor' })).status, 200)
})

test('only an owner may create, modify, block or grant owner', async () => {
  const app = await setup()
  addUser(app, 'own', 'owner')
  addUser(app, 'u1', 'consulta')
  const as = (role: string) => ({ role })
  const create = await app.request('/api/users', {
    ...as('supervisor'),
    body: { name: 'O', email: 'o@x.com', password: 'secreto123', role: 'owner' },
  })
  assert.equal(create.status, 403)
  assert.equal(create.json.code, 'solo_propietario')
  const promote = await app.request('/api/users/u1', { method: 'PATCH', body: { role: 'owner' }, ...as('supervisor') })
  assert.equal(promote.status, 403)
  const block = await app.request('/api/users/own', { method: 'PATCH', body: { banned: true }, ...as('supervisor') })
  assert.equal(block.status, 403)
  const grants = await app.request('/api/users/own/empresas', { method: 'PUT', body: { empresaIds: [] }, ...as('supervisor') })
  assert.equal(grants.status, 403)
  const byOwner = await app.request('/api/users/u1', { method: 'PATCH', body: { role: 'owner' } })
  assert.equal(byOwner.status, 200)
})

test('the last active owner cannot be demoted or blocked', async () => {
  const app = await setup()
  addUser(app, 'own', 'owner')
  const patch = (id: string, body: object) => app.request(`/api/users/${id}`, { method: 'PATCH', body, userId: 'ghost' })
  const demote = await patch('own', { role: 'supervisor' })
  assert.equal(demote.status, 409)
  assert.equal(demote.json.code, 'ultimo_propietario')
  assert.equal((await patch('own', { banned: true })).status, 409)

  addUser(app, 'own2', 'owner', 1) // a blocked owner does not count
  assert.equal((await patch('own', { banned: true })).status, 409)
  addUser(app, 'own3', 'owner')
  assert.equal((await patch('own', { banned: true })).status, 200)
  assert.equal((await patch('own3', { role: 'supervisor' })).status, 409)
})
