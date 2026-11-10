import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { addMovement, get, mk, patch, post } from './helpers.js'

const both = ['chart-of-accounts', 'general-ledger']

async function tree(t: Awaited<ReturnType<typeof createTestApp>>) {
  const a = await mk(t, '1')
  const b = await mk(t, '11', { parentCode: '1' })
  const c = await mk(t, '111', { parentCode: '11', isDetail: true })
  const p = await mk(t, '2', { type: 'pasivo' })
  return { a, b, c, p }
}

test('updates name, flags and budget group', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { c } = await tree(t)
  const g = await post(t, '/budget-groups', { code: 'G', name: 'Grupo' })
  const res = await patch(t, `/accounts/${c.id}`, {
    name: '  Caja chica ',
    requiresCostCenter: true,
    budgetGroupId: g.json.id,
  })
  assert.equal(res.status, 200)
  assert.equal(res.json.name, 'Caja chica')
  assert.equal(res.json.requiresCostCenter, true)
  assert.equal(res.json.budgetGroupCode, 'G')
  const cleared = await patch(t, `/accounts/${c.id}`, { budgetGroupId: null })
  assert.equal(cleared.json.budgetGroupId, null)
  assert.equal((await patch(t, '/accounts/nope', { name: 'X' })).status, 404)
})

test('code is immutable (same code is accepted)', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { a } = await tree(t)
  const res = await patch(t, `/accounts/${a.id}`, { code: '9' })
  assert.equal(res.status, 400)
  assert.equal(res.json.code, 'code_immutable')
  assert.equal((await patch(t, `/accounts/${a.id}`, { code: '1', name: 'Nuevo' })).status, 200)
})

test('cannot become detail while it has children; cost-center flag needs detail', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { a, b } = await tree(t)
  const res = await patch(t, `/accounts/${a.id}`, { isDetail: true })
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'has_children')
  const cc = await patch(t, `/accounts/${b.id}`, { requiresCostCenter: true })
  assert.equal(cc.json.code, 'cost_center_not_detail')
})

test('leaving detail clears the cost-center flag', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const x = await mk(t, 'X', { isDetail: true, requiresCostCenter: true })
  const res = await patch(t, `/accounts/${x.id}`, { isDetail: false })
  assert.equal(res.status, 200)
  assert.equal(res.json.requiresCostCenter, false)
})

test('movements block detail, type and cost-center changes', async () => {
  const t = await createTestApp({ modules: both })
  const { c } = await tree(t)
  addMovement(t, c.id)
  for (const body of [{ isDetail: false }, { type: 'gastos' }, { requiresCostCenter: true }]) {
    const res = await patch(t, `/accounts/${c.id}`, body)
    assert.equal(res.status, 409, JSON.stringify(body))
    assert.equal(res.json.code, 'has_movements')
  }
  // Unrelated fields are still editable.
  assert.equal((await patch(t, `/accounts/${c.id}`, { name: 'Renombrada' })).status, 200)
})

test('voided entries do not count as movements', async () => {
  const t = await createTestApp({ modules: both })
  const { c } = await tree(t)
  addMovement(t, c.id, { active: false })
  assert.equal((await patch(t, `/accounts/${c.id}`, { type: 'activo', isDetail: false })).status, 200)
})

test('moving an account recomputes the level of its whole subtree', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { b } = await tree(t)
  const d = await mk(t, '12', { parentCode: '1' })
  await mk(t, '121', { parentCode: '12' })
  // Move 11 (with child 111) under 121 → levels 4 and 5.
  const x = await mk(t, '1211', { parentCode: '121' })
  const res = await patch(t, `/accounts/${b.id}`, { parentCode: '1211' })
  assert.equal(res.status, 200)
  assert.equal(res.json.level, 5)
  assert.equal(res.json.parentId, x.id)
  assert.equal((await get(t, '/accounts/by-code/111')).json.level, 6)
  // Back to root: levels 1 and 2.
  const root = await patch(t, `/accounts/${b.id}`, { parentId: null })
  assert.equal(root.json.level, 1)
  assert.equal(root.json.parentId, null)
  assert.equal((await get(t, '/accounts/by-code/111')).json.level, 2)
  assert.equal((await get(t, `/accounts/${d.id}`)).json.level, 2)
})

test('parent changes keep the tree consistent', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { a, b, c, p } = await tree(t)
  const cycleSelf = await patch(t, `/accounts/${a.id}`, { parentId: a.id })
  assert.equal(cycleSelf.json.code, 'parent_cycle')
  const cycle = await patch(t, `/accounts/${a.id}`, { parentCode: '11' })
  assert.equal(cycle.json.code, 'parent_cycle')
  assert.equal((await patch(t, `/accounts/${b.id}`, { parentId: p.id })).json.code, 'parent_type_mismatch')
  const d = await mk(t, '4', { isDetail: true })
  assert.equal((await patch(t, `/accounts/${b.id}`, { parentId: d.id })).json.code, 'parent_is_detail')
  assert.equal((await patch(t, `/accounts/${b.id}`, { parentId: c.id })).json.code, 'parent_cycle')
  assert.equal((await patch(t, `/accounts/${b.id}`, { parentCode: 'zzz' })).json.code, 'parent_not_found')
})

test('changing type cascades to descendants and must match the parent', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { a, b } = await tree(t)
  // A child cannot change type away from its parent.
  assert.equal((await patch(t, `/accounts/${b.id}`, { type: 'pasivo' })).json.code, 'parent_type_mismatch')
  const res = await patch(t, `/accounts/${a.id}`, { type: 'pasivo' })
  assert.equal(res.status, 200)
  assert.equal(res.json.type, 'pasivo')
  assert.equal((await get(t, '/accounts/by-code/11')).json.type, 'pasivo')
  assert.equal((await get(t, '/accounts/by-code/111')).json.type, 'pasivo')
})

test('type cascade is refused when a descendant has movements', async () => {
  const t = await createTestApp({ modules: both })
  const { a, c } = await tree(t)
  addMovement(t, c.id)
  const res = await patch(t, `/accounts/${a.id}`, { type: 'pasivo' })
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'has_movements')
  assert.equal((await get(t, '/accounts/by-code/111')).json.type, 'activo')
})

test('moving to a new parent can change type in the same request', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const { b, p } = await tree(t)
  const res = await patch(t, `/accounts/${b.id}`, { parentId: p.id, type: 'pasivo' })
  assert.equal(res.status, 200)
  assert.equal(res.json.level, 2)
  assert.equal((await get(t, '/accounts/by-code/111')).json.type, 'pasivo')
})
