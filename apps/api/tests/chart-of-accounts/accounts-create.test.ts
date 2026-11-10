import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { get, mk, post, addEmpresa, rawAccount } from './helpers.js'

type Row = { code: string }
const codes = (rows: Row[]) => rows.map((r) => r.code)

test('creates root and child accounts with computed level', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const root = await mk(t, '1')
  assert.equal(root.level, 1)
  const child = await post(t, '/accounts', { code: ' 11 ', name: 'Caja', type: 'activo', parentCode: '1' })
  assert.equal(child.status, 201)
  assert.equal(child.json.code, '11')
  assert.equal(child.json.level, 2)
  assert.equal(child.json.parentId, root.id)
  assert.equal(child.json.parentCode, '1')
  const leaf = await post(t, '/accounts', {
    code: '111',
    name: 'Caja general',
    type: 'activo',
    parentId: child.json.id,
    isDetail: true,
  })
  assert.equal(leaf.json.level, 3)
  assert.equal(leaf.json.isDetail, true)
  const list = await get(t, '/accounts')
  const row = (code: string) => list.json.find((a: Row) => a.code === code)
  assert.equal(row('1').hasChildren, true)
  assert.equal(row('111').hasChildren, false)
})

test('validates code and body', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const base = { name: 'X', type: 'activo' }
  assert.equal((await post(t, '/accounts', { ...base })).status, 400)
  assert.equal((await post(t, '/accounts', { ...base, code: '   ' })).status, 400)
  const long = await post(t, '/accounts', { ...base, code: '123456789012345' })
  assert.equal(long.status, 400)
  assert.equal(long.json.code, 'validation')
  assert.equal((await post(t, '/accounts', { code: '1', name: 'X', type: 'otro' })).status, 400)
  const fourteen = await post(t, '/accounts', { ...base, code: '12345678901234' })
  assert.equal(fourteen.status, 201)
  const bad = await t.app.request('/api/chart-of-accounts/accounts', {
    method: 'POST',
    headers: { 'x-test-role': 'owner', 'x-empresa-id': t.empresaId, 'content-type': 'application/json' },
    body: '{nope',
  })
  assert.equal(bad.status, 400)
  assert.equal((await bad.json()).code, 'invalid_json')
})

test('rejects duplicate codes within the empresa only', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  await mk(t, '1')
  const dup = await post(t, '/accounts', { code: '1', name: 'Otra', type: 'pasivo' })
  assert.equal(dup.status, 409)
  assert.equal(dup.json.code, 'code_duplicate')
  assert.match(dup.json.error, /Ya existe/)
  addEmpresa(t, 'e2', 'DOS')
  const other = await post(t, '/accounts', { code: '1', name: 'Otra', type: 'activo' }, { empresaId: 'e2' })
  assert.equal(other.status, 201)
})

test('parent rules: exists, active, same type, not detail', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const root = await mk(t, '1')
  await mk(t, '2', { type: 'pasivo' })
  await mk(t, '3', { isDetail: true })
  const c = (body: object) => post(t, '/accounts', { name: 'X', type: 'activo', ...body })

  const missing = await c({ code: '10', parentCode: 'nope' })
  assert.equal(missing.status, 400)
  assert.equal(missing.json.code, 'parent_not_found')
  assert.equal((await c({ code: '10', parentId: 'nope' })).json.code, 'parent_not_found')

  assert.equal((await c({ code: '10', parentCode: '2' })).json.code, 'parent_type_mismatch')

  const detail = await c({ code: '10', parentCode: '3' })
  assert.equal(detail.json.code, 'parent_is_detail')
  assert.equal(detail.json.error, 'La cuenta padre es de detalle.')

  const conflict = await c({ code: '10', parentCode: '2', parentId: root.id })
  assert.equal(conflict.json.code, 'parent_conflict')

  t.sqlite.prepare('update coa_accounts set is_active = 0 where id = ?').run(root.id)
  assert.equal((await c({ code: '10', parentCode: '1' })).json.code, 'parent_inactive')
})

test('requiresCostCenter only on detail accounts; budget group must belong to the empresa', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const bad = await post(t, '/accounts', { code: '1', name: 'X', type: 'gastos', requiresCostCenter: true })
  assert.equal(bad.status, 400)
  assert.equal(bad.json.code, 'cost_center_not_detail')
  const ok = await post(t, '/accounts', {
    code: '1',
    name: 'X',
    type: 'gastos',
    isDetail: true,
    requiresCostCenter: true,
  })
  assert.equal(ok.status, 201)
  assert.equal(ok.json.requiresCostCenter, true)

  const g = (budgetGroupId: string) =>
    post(t, '/accounts', { code: '2', name: 'X', type: 'gastos', budgetGroupId })
  assert.equal((await g('zzz')).json.code, 'budget_group_not_found')

  addEmpresa(t, 'e2', 'DOS')
  const foreign = await post(t, '/budget-groups', { code: 'G1', name: 'Otra' }, { empresaId: 'e2' })
  assert.equal((await g(foreign.json.id)).json.code, 'budget_group_not_found')

  const mine = await post(t, '/budget-groups', { code: 'G1', name: 'Mía' })
  const withGroup = await g(mine.json.id)
  assert.equal(withGroup.status, 201)
  assert.equal(withGroup.json.budgetGroupCode, 'G1')
})

test('list filters, lookup by id and by code', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  await mk(t, '2', { name: 'Pasivos', type: 'pasivo' })
  const a = await mk(t, '1', { name: 'Activo corriente' })
  await mk(t, '11', { name: 'Caja y bancos', parentCode: '1', isDetail: true })
  const dead = await mk(t, '12', { name: 'Vieja', parentCode: '1', isDetail: true })
  t.sqlite.prepare('update coa_accounts set is_active = 0 where id = ?').run(dead.id)

  assert.deepEqual(codes((await get(t, '/accounts')).json), ['1', '11', '2'])
  assert.equal((await get(t, '/accounts?includeInactive=1')).json.length, 4)
  assert.deepEqual(codes((await get(t, '/accounts?detail=1')).json), ['11'])
  assert.deepEqual(codes((await get(t, '/accounts?q=1')).json), ['1', '11'])
  assert.deepEqual(codes((await get(t, '/accounts?q=BANCOS')).json), ['11'])
  assert.equal((await get(t, '/accounts?limit=1')).json.length, 1)

  assert.equal((await get(t, `/accounts/${a.id}`)).json.code, '1')
  assert.equal((await get(t, '/accounts/by-code/11')).json.name, 'Caja y bancos')
  const none = await get(t, '/accounts/by-code/99')
  assert.equal(none.status, 404)
  assert.equal(none.json.code, 'account_not_found')
  assert.equal((await get(t, '/accounts/nope')).status, 404)
})

test('dirty rows do not break listing', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  rawAccount(t, { id: 'x1', code: 'X1', parentId: 'x1', level: 9 })
  assert.equal((await get(t, '/accounts')).status, 200)
})
