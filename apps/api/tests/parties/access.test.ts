import { test } from 'node:test'
import assert from 'node:assert/strict'
import { act, addEmpresa, addUser, app, get, mk, patch, post } from './helpers.js'

const body = { code: 'N1', name: 'Nuevo', isSupplier: true }

test('permissions by role, reads included', async () => {
  const t = await app()
  for (const u of ['u-consulta', 'u-digitador', 'u-dc', 'u-supervisor', 'u-nadie']) addUser(t, u)
  const p = await mk(t, 'C1')

  // consulta: views, cannot create, update or deactivate
  const consulta = { role: 'consulta', userId: 'u-consulta' }
  assert.equal((await get(t, '', consulta)).status, 200)
  assert.equal((await get(t, `/${p.id}`, consulta)).status, 200)
  assert.equal((await post(t, '', body, consulta)).status, 403)
  assert.equal((await patch(t, `/${p.id}`, { name: 'X' }, consulta)).status, 403)
  assert.equal((await act(t, `/${p.id}/deactivate`, consulta)).status, 403)

  // digitador: views, creates and updates, cannot deactivate
  const dig = { role: 'digitador', userId: 'u-digitador' }
  assert.equal((await get(t, '', dig)).status, 200)
  assert.equal((await post(t, '', body, dig)).status, 201)
  assert.equal((await patch(t, `/${p.id}`, { name: 'Otro nombre' }, dig)).status, 200)
  assert.equal((await act(t, `/${p.id}/deactivate`, dig)).status, 403)
  assert.equal((await act(t, `/${p.id}/reactivate`, dig)).status, 403)

  const dc = { role: 'digitador_consulta', userId: 'u-dc' }
  assert.equal((await act(t, `/${p.id}/deactivate`, dc)).status, 403)

  // a role without packages sees nothing
  const nadie = { role: 'sin-rol', userId: 'u-nadie' }
  assert.equal((await get(t, '', nadie)).status, 403)
  assert.equal((await get(t, `/${p.id}`, nadie)).status, 403)

  // supervisor and owner deactivate and reactivate
  const sup = { role: 'supervisor', userId: 'u-supervisor' }
  assert.equal((await act(t, `/${p.id}/deactivate`, sup)).status, 200)
  assert.equal((await act(t, `/${p.id}/reactivate`)).status, 200)
})

test('every route of the module declares a fine permission', async () => {
  const t = await app()
  addUser(t, 'u-nadie')
  const nadie = { role: 'sin-rol', userId: 'u-nadie' }
  const calls = [
    get(t, '', nadie),
    get(t, '/x', nadie),
    post(t, '', body, nadie),
    patch(t, '/x', { name: 'X' }, nadie),
    act(t, '/x/deactivate', nadie),
    act(t, '/x/reactivate', nadie),
  ]
  // Without a permission check these would answer 200, 404 or 400 instead.
  for (const res of await Promise.all(calls)) {
    assert.equal(res.status, 403)
    assert.equal(res.json.error, 'No tiene permiso para esta acción.')
  }
})

test('another empresa is invisible', async () => {
  const t = await app()
  addEmpresa(t, 'e2', 'DOS')
  const foreign = await mk(t, 'X1', { nrc: '1234567' }, { empresaId: 'e2' })
  await mk(t, 'C1')

  const list = await get(t, '')
  assert.deepEqual(list.json.items.map((p: { code: string }) => p.code), ['C1'])
  assert.equal(list.json.total, 1)
  assert.equal((await get(t, `/${foreign.id}`)).status, 404)
  assert.equal((await patch(t, `/${foreign.id}`, { name: 'Hack' })).status, 404)
  assert.equal((await act(t, `/${foreign.id}/deactivate`)).status, 404)
  // The same NRC and code are free in this empresa.
  assert.equal((await post(t, '', { code: 'X1', name: 'Propio', isCustomer: true, nrc: '123456-7' })).status, 201)
  assert.equal((await get(t, '', { empresaId: 'e2' })).json.total, 1)
})

test('non-owner roles only reach empresas they were granted', async () => {
  const t = await app()
  addEmpresa(t, 'e2', 'DOS')
  addUser(t, 'u1', [t.empresaId])
  assert.equal((await get(t, '', { role: 'supervisor', userId: 'u1' })).status, 200)
  assert.equal((await get(t, '', { role: 'supervisor', userId: 'u1', empresaId: 'e2' })).status, 403)
})
