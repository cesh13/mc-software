import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { act, addEmpresa, addUser, auditRows, get, mk, patch, post } from './helpers.js'

const body = { code: 'N1', name: 'Nueva', type: 'activo' }

test('permissions by role', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  for (const u of ['u-consulta', 'u-digitador', 'u-dc', 'u-supervisor']) addUser(t, u)
  const as = (role: string, userId: string) => ({ role, userId })
  const acct = await mk(t, 'E1', { isDetail: true })

  // consulta: reads and reports only
  const consulta = as('consulta', 'u-consulta')
  assert.equal((await get(t, '/accounts', consulta)).status, 200)
  assert.equal((await get(t, '/integrity', consulta)).status, 200)
  assert.equal((await post(t, '/accounts', body, consulta)).status, 403)
  assert.equal((await patch(t, `/accounts/${acct.id}`, { name: 'X' }, consulta)).status, 403)
  assert.equal((await post(t, '/budget-groups', { code: 'G', name: 'G' }, consulta)).status, 403)
  assert.equal((await act(t, `/accounts/${acct.id}/deactivate`, consulta)).status, 403)

  // digitador: captures, cannot deactivate/reactivate, cannot run the report
  const dig = as('digitador', 'u-digitador')
  assert.equal((await get(t, '/accounts', dig)).status, 200)
  assert.equal((await get(t, '/integrity', dig)).status, 403)
  assert.equal((await post(t, '/accounts', body, dig)).status, 201)
  assert.equal((await patch(t, `/accounts/${acct.id}`, { name: 'Nuevo nombre' }, dig)).status, 200)
  assert.equal((await post(t, '/budget-groups', { code: 'G', name: 'G' }, dig)).status, 201)
  assert.equal((await act(t, `/accounts/${acct.id}/deactivate`, dig)).status, 403)
  assert.equal((await act(t, `/accounts/${acct.id}/reactivate`, dig)).status, 403)

  // digitador_consulta: captures and reports, cannot deactivate
  const dc = as('digitador_consulta', 'u-dc')
  assert.equal((await get(t, '/integrity', dc)).status, 200)
  assert.equal((await act(t, `/accounts/${acct.id}/deactivate`, dc)).status, 403)

  // supervisor and owner can deactivate
  const sup = as('supervisor', 'u-supervisor')
  assert.equal((await act(t, `/accounts/${acct.id}/deactivate`, sup)).status, 200)
  assert.equal((await act(t, `/accounts/${acct.id}/reactivate`)).status, 200)
  assert.equal((await act(t, `/accounts/${acct.id}/deactivate`)).status, 200)
})

test('another empresa is invisible and cannot supply a parent', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  addEmpresa(t, 'e2', 'DOS')
  const foreign = await mk(t, '1', { name: 'Ajena' }).then(async () => {
    const r = await post(t, '/accounts', { code: 'X1', name: 'Solo empresa 2', type: 'activo' }, { empresaId: 'e2' })
    return r.json as { id: string }
  })
  const own = await mk(t, '2')

  const list = await get(t, '/accounts')
  assert.deepEqual(list.json.map((a: { code: string }) => a.code), ['1', '2'])
  assert.equal((await get(t, `/accounts/${foreign.id}`)).status, 404)
  assert.equal((await get(t, '/accounts/by-code/X1')).status, 404)
  assert.equal((await patch(t, `/accounts/${foreign.id}`, { name: 'Hack' })).status, 404)
  assert.equal((await act(t, `/accounts/${foreign.id}/deactivate`)).status, 404)

  const asParentId = await post(t, '/accounts', { code: '10', name: 'H', type: 'activo', parentId: foreign.id })
  assert.equal(asParentId.status, 400)
  assert.equal(asParentId.json.code, 'parent_not_found')
  const asParentCode = await post(t, '/accounts', { code: '10', name: 'H', type: 'activo', parentCode: 'X1' })
  assert.equal(asParentCode.json.code, 'parent_not_found')
  const move = await patch(t, `/accounts/${own.id}`, { parentId: foreign.id })
  assert.equal(move.json.code, 'parent_not_found')

  assert.equal((await get(t, '/accounts', { empresaId: 'e2' })).json.length, 1)
  assert.equal((await get(t, '/integrity', { empresaId: 'e2' })).json.checkedAccounts, 1)
})

test('non-owner roles only reach empresas they were granted', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  addEmpresa(t, 'e2', 'DOS')
  addUser(t, 'u1', [t.empresaId])
  assert.equal((await get(t, '/accounts', { role: 'supervisor', userId: 'u1' })).status, 200)
  assert.equal((await get(t, '/accounts', { role: 'supervisor', userId: 'u1', empresaId: 'e2' })).status, 403)
})

test('create, update, deactivate and reactivate write the audit log', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const a = await mk(t, '1', { isDetail: true })
  await patch(t, `/accounts/${a.id}`, { name: 'Cambiada' })
  await act(t, `/accounts/${a.id}/deactivate`)
  await act(t, `/accounts/${a.id}/reactivate`)
  const rows = auditRows(t, a.id)
  assert.deepEqual(rows.map((r) => r.action), ['crear', 'modificar', 'desactivar', 'reactivar'])
  for (const r of rows) {
    assert.equal(r.module, 'chart-of-accounts')
    assert.equal(r.entity, 'cuenta')
    assert.equal(r.empresa_id, t.empresaId)
    assert.equal(r.user_id, 'user-test')
  }
  const detail = t.sqlite
    .prepare("select detail from core_audit_log where entity_id = ? and action = 'modificar'")
    .get(a.id) as { detail: string }
  assert.equal(JSON.parse(detail.detail).changes.name[1], 'Cambiada')
})

test('failed operations leave no audit row and no changes', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  await mk(t, '1')
  const before = t.sqlite.prepare('select count(*) as n from core_audit_log').get() as { n: number }
  await post(t, '/accounts', { code: '1', name: 'Dup', type: 'activo' })
  const after = t.sqlite.prepare('select count(*) as n from core_audit_log').get() as { n: number }
  assert.equal(after.n, before.n)
})
