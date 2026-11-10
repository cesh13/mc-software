import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { act, addEmpresa, auditRows, get, mk, patch, post } from './helpers.js'

test('creates, lists and renames budget groups', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const g = await post(t, '/budget-groups', { code: ' A1 ', name: 'Operación' })
  assert.equal(g.status, 201)
  assert.equal(g.json.code, 'A1')
  assert.equal(g.json.isActive, true)
  await post(t, '/budget-groups', { code: 'B', name: 'Ventas' })
  assert.deepEqual((await get(t, '/budget-groups')).json.map((x: { code: string }) => x.code), ['A1', 'B'])

  const renamed = await patch(t, `/budget-groups/${g.json.id}`, { name: 'Operaciones' })
  assert.equal(renamed.json.name, 'Operaciones')
  assert.equal((await patch(t, '/budget-groups/nope', { name: 'X' })).status, 404)
  assert.equal(auditRows(t, g.json.id).map((r) => r.action).join(), 'crear,modificar')
})

test('code: max 3 chars, unique per empresa', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  assert.equal((await post(t, '/budget-groups', { code: 'ABCD', name: 'X' })).status, 400)
  assert.equal((await post(t, '/budget-groups', { code: '', name: 'X' })).status, 400)
  await post(t, '/budget-groups', { code: 'ABC', name: 'X' })
  const dup = await post(t, '/budget-groups', { code: 'ABC', name: 'Y' })
  assert.equal(dup.status, 409)
  assert.equal(dup.json.code, 'code_duplicate')
  addEmpresa(t, 'e2', 'DOS')
  assert.equal((await post(t, '/budget-groups', { code: 'ABC', name: 'Y' }, { empresaId: 'e2' })).status, 201)
  const other = await post(t, '/budget-groups', { code: 'ZZ', name: 'Z' })
  const clash = await patch(t, `/budget-groups/${other.json.id}`, { code: 'ABC' })
  assert.equal(clash.status, 409)
})

test('deactivate is refused while accounts use the group', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const g = await post(t, '/budget-groups', { code: 'G', name: 'Grupo' })
  const a = await mk(t, '1', { isDetail: true, budgetGroupId: g.json.id })
  const res = await act(t, `/budget-groups/${g.json.id}/deactivate`)
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'budget_group_in_use')

  await patch(t, `/accounts/${a.id}`, { budgetGroupId: null })
  const ok = await act(t, `/budget-groups/${g.json.id}/deactivate`)
  assert.equal(ok.status, 200)
  assert.equal(ok.json.isActive, false)
  assert.equal((await get(t, '/budget-groups')).json.length, 0)
  assert.equal((await get(t, '/budget-groups?includeInactive=1')).json.length, 1)

  // An inactive group cannot be assigned.
  const assign = await patch(t, `/accounts/${a.id}`, { budgetGroupId: g.json.id })
  assert.equal(assign.json.code, 'budget_group_inactive')
  assert.equal((await act(t, `/budget-groups/${g.json.id}/reactivate`)).json.isActive, true)
})
