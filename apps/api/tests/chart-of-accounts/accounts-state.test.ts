import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { act, addMovement, get, mk } from './helpers.js'

test('deactivate hides the account; reactivate brings it back', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const a = await mk(t, '1', { isDetail: true })
  const res = await act(t, `/accounts/${a.id}/deactivate`)
  assert.equal(res.status, 200)
  assert.equal(res.json.isActive, false)
  assert.equal((await get(t, '/accounts')).json.length, 0)
  assert.equal((await get(t, '/accounts?includeInactive=1')).json.length, 1)
  assert.equal((await act(t, `/accounts/${a.id}/deactivate`)).json.code, 'already_inactive')

  const back = await act(t, `/accounts/${a.id}/reactivate`)
  assert.equal(back.json.isActive, true)
  assert.equal((await act(t, `/accounts/${a.id}/reactivate`)).json.code, 'already_active')
  assert.equal((await act(t, '/accounts/nope/deactivate')).status, 404)
})

test('cannot deactivate an account with active sub-accounts', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const a = await mk(t, '1')
  const b = await mk(t, '11', { parentCode: '1', isDetail: true })
  const res = await act(t, `/accounts/${a.id}/deactivate`)
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'has_children')
  assert.match(res.json.error, /sub-cuentas/)
  await act(t, `/accounts/${b.id}/deactivate`)
  assert.equal((await act(t, `/accounts/${a.id}/deactivate`)).status, 200)
})

test('cannot deactivate an account with movements (general-ledger installed)', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts', 'general-ledger'] })
  const a = await mk(t, '1', { isDetail: true })
  const b = await mk(t, '2', { isDetail: true })
  addMovement(t, a.id)
  const res = await act(t, `/accounts/${a.id}/deactivate`)
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'has_movements')
  assert.match(res.json.error, /movimientos/)
  // Account without lines and account whose only entry is voided can go.
  assert.equal((await act(t, `/accounts/${b.id}/deactivate`)).status, 200)
  await act(t, `/accounts/${b.id}/reactivate`)
  addMovement(t, b.id, { active: false })
  assert.equal((await act(t, `/accounts/${b.id}/deactivate`)).status, 200)
})

test('works without general-ledger installed (no movements possible)', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const hasGl = t.sqlite
    .prepare("select count(*) as n from sqlite_master where name = 'gl_journal_lines'")
    .get() as { n: number }
  assert.equal(hasGl.n, 0)
  const a = await mk(t, '1', { isDetail: true })
  assert.equal((await act(t, `/accounts/${a.id}/deactivate`)).status, 200)
})

test('reactivate requires an active, non-detail parent', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const a = await mk(t, '1')
  const b = await mk(t, '11', { parentCode: '1', isDetail: true })
  await act(t, `/accounts/${b.id}/deactivate`)
  t.sqlite.prepare('update coa_accounts set is_active = 0 where id = ?').run(a.id)
  const res = await act(t, `/accounts/${b.id}/reactivate`)
  assert.equal(res.status, 400)
  assert.equal(res.json.code, 'parent_inactive')
})
