import { test } from 'node:test'
import assert from 'node:assert/strict'
import { act, app, get, mk, patch, post } from './helpers.js'

test('create normalizes tax ids and returns the party', async () => {
  const t = await app()
  const res = await post(t, '', {
    code: 'P001', name: 'Distribuidora Uno', isSupplier: true, isCustomer: true, kind: 'company',
    nrc: '0012345-6', nit: '06141501901011', dui: '012345678', email: 'compras@example.com',
    departmentCode: '06', municipalityCode: '14',
  })
  assert.equal(res.status, 201)
  assert.equal(res.json.nrc, '12345-6')
  assert.equal(res.json.nit, '0614-150190-101-1')
  assert.equal(res.json.dui, '01234567-8')
  assert.equal(res.json.isActive, true)
  assert.deepEqual(res.json.legacyRefs, [])
  assert.equal(res.json.empresaId, undefined)
  const row = t.sqlite.prepare('select nrc, is_customer, is_supplier from pty_parties where id = ?').get(res.json.id)
  assert.deepEqual(row, { nrc: '12345-6', is_customer: 1, is_supplier: 1 })
})

test('validation: tax id format, role, code', async () => {
  const t = await app()
  const bad = await post(t, '', { code: 'A', name: 'A', isCustomer: true, nrc: '12A-4' })
  assert.equal(bad.status, 400)
  assert.equal(bad.json.issues[0].message, 'El NRC solo admite dígitos y guiones.')
  const noRole = await post(t, '', { code: 'A', name: 'A' })
  assert.equal(noRole.status, 400)
  assert.equal(noRole.json.issues[0].message, 'El tercero debe ser cliente, proveedor o ambos.')
  await mk(t, 'A')
  const dup = await post(t, '', { code: 'A', name: 'Otro', isCustomer: true })
  assert.equal(dup.status, 409)
  assert.equal(dup.json.code, 'code_duplicate')
})

test('duplicate NRC or NIT among active parties is rejected', async () => {
  const t = await app()
  const a = await mk(t, 'A', { nrc: '123456-7', nit: '0614-150190-101-1' })
  const sameNrc = await post(t, '', { code: 'B', name: 'B', isSupplier: true, nrc: '1234567' })
  assert.equal(sameNrc.status, 409)
  assert.equal(sameNrc.json.code, 'nrc_duplicate')
  assert.match(sameNrc.json.error, /NRC 123456-7 ya está registrado en el tercero A/)
  const sameNit = await post(t, '', { code: 'B', name: 'B', isSupplier: true, nit: '06141501901011' })
  assert.equal(sameNit.json.code, 'nit_duplicate')

  // An inactive party frees its NRC, and cannot come back while it is taken.
  assert.equal((await act(t, `/${a.id}/deactivate`)).status, 200)
  const b = await mk(t, 'B', { nrc: '123456-7' })
  const back = await act(t, `/${a.id}/reactivate`)
  assert.equal(back.status, 409)
  assert.equal(back.json.code, 'nrc_duplicate')

  // Updating into a taken NRC fails too.
  const c = await mk(t, 'C')
  const upd = await patch(t, `/${c.id}`, { nrc: '123456-7' })
  assert.equal(upd.json.code, 'nrc_duplicate')
  assert.equal((await patch(t, `/${b.id}`, { nrc: null })).json.nrc, null)
})

test('update changes fields, keeps a role and audits the diff', async () => {
  const t = await app()
  const p = await mk(t, 'A', { phone: '2222-0000' })
  const res = await patch(t, `/${p.id}`, { name: 'Nombre nuevo', isSupplier: true, phone: '' })
  assert.equal(res.status, 200)
  assert.equal(res.json.name, 'Nombre nuevo')
  assert.equal(res.json.phone, null)
  assert.equal(res.json.isSupplier, true)
  const noRole = await patch(t, `/${p.id}`, { isCustomer: false, isSupplier: false })
  assert.equal(noRole.status, 400)
  assert.equal(noRole.json.code, 'role_required')
  const detail = t.sqlite
    .prepare("select detail from core_audit_log where entity_id = ? and action = 'modificar'")
    .get(p.id) as { detail: string }
  assert.deepEqual(JSON.parse(detail.detail).changes.name, ['Tercero A', 'Nombre nuevo'])
})

test('deactivate and reactivate, with audit and no physical delete', async () => {
  const t = await app()
  const p = await mk(t, 'A')
  const off = await act(t, `/${p.id}/deactivate`)
  assert.equal(off.json.isActive, false)
  assert.equal((await act(t, `/${p.id}/deactivate`)).json.code, 'already_inactive')
  assert.equal((await get(t, '')).json.total, 0)
  assert.equal((await get(t, '?status=inactive')).json.total, 1)
  assert.equal((await act(t, `/${p.id}/reactivate`)).json.isActive, true)
  const actions = t.sqlite
    .prepare('select action, module, entity from core_audit_log where entity_id = ? order by at')
    .all(p.id) as { action: string; module: string; entity: string }[]
  assert.deepEqual(actions.map((a) => a.action), ['crear', 'desactivar', 'reactivar'])
  assert.ok(actions.every((a) => a.module === 'parties' && a.entity === 'tercero'))
})

test('failed writes leave no audit row', async () => {
  const t = await app()
  await mk(t, 'A', { nrc: '1-1' })
  const n = () => (t.sqlite.prepare('select count(*) as n from core_audit_log').get() as { n: number }).n
  const before = n()
  await post(t, '', { code: 'B', name: 'B', isCustomer: true, nrc: '11' })
  assert.equal(n(), before)
})

test('list searches code, name, NRC and NIT and filters by role', async () => {
  const t = await app()
  await mk(t, 'C1', { name: 'Ferretería Central', nrc: '111111-1' })
  await mk(t, 'P1', { name: 'Papelera', isCustomer: false, isSupplier: true, nit: '0614-150190-101-1' })
  await mk(t, 'A1', { name: 'Ambos', isSupplier: true })
  const codes = async (q: string) => (await get(t, q)).json.items.map((p: { code: string }) => p.code)
  assert.deepEqual(await codes('?q=ferre'), ['C1'])
  assert.deepEqual(await codes('?q=1111111'), ['C1'])
  assert.deepEqual(await codes('?q=06141501'), ['P1'])
  assert.deepEqual(await codes('?q=P1'), ['P1'])
  assert.deepEqual(await codes('?role=supplier'), ['A1', 'P1'])
  assert.deepEqual(await codes('?role=customer'), ['A1', 'C1'])
  assert.deepEqual(await codes('?limit=1&offset=1'), ['C1'])
  assert.equal((await get(t, '?role=otro')).status, 400)
})
