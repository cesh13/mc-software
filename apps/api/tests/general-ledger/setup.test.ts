import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, addUser, auditActions, costCenter, entry, entryType, get, newApp, patch, post } from './fixtures.js'

test('entry types: create, unique upper-case code, update, deactivate', async () => {
  const t = await newApp()
  const res = await post(t, '/entry-types', { code: 'cp', name: 'Comprobante', numberWidth: 7 })
  assert.equal(res.status, 201)
  assert.equal(res.json.code, 'CP')
  assert.equal(res.json.numberWidth, 7)
  assert.equal(res.json.isBank, false)
  const dflt = await post(t, '/entry-types', { code: 'PD', name: 'Diario' })
  assert.equal(dflt.json.numberWidth, 6)

  assert.equal((await post(t, '/entry-types', { code: 'CP', name: 'Otro' })).json.code, 'entry_type_code_taken')
  assert.equal((await post(t, '/entry-types', { code: 'C', name: 'x' })).status, 400)
  assert.equal((await post(t, '/entry-types', { code: 'CPX', name: 'x' })).status, 400)

  const upd = await patch(t, `/entry-types/${res.json.id}`, { name: 'Cheques', isBank: true })
  assert.equal(upd.status, 200)
  assert.equal(upd.json.name, 'Cheques')
  assert.equal(upd.json.isBank, true)
  assert.equal((await patch(t, `/entry-types/${res.json.id}`, { code: 'PD' })).json.code, 'entry_type_code_taken')

  const off = await post(t, `/entry-types/${res.json.id}/deactivate`)
  assert.equal(off.json.isActive, false)
  assert.equal((await get(t, '/entry-types')).json.length, 1)
  assert.equal((await get(t, '/entry-types?includeInactive=true')).json.length, 2)
  assert.deepEqual(auditActions(t, res.json.id), ['crear', 'modificar', 'desactivar'])

  // An inactive type cannot receive new entries.
  account(t, { code: '1101' })
  const e = await post(t, '/entries', {
    period: '2026-01', entryTypeId: res.json.id, date: '2026-01-02', concept: 'x',
    lines: [{ accountId: accId(t, '1101'), debit: '1.00' }],
  })
  assert.equal(e.json.code, 'entry_type_inactive')
  assert.equal((await patch(t, '/entry-types/nope', { name: 'x' })).status, 404)
})

test('cost centers: code up to 3 chars, deactivation refused while used', async () => {
  const t = await newApp()
  assert.equal((await post(t, '/cost-centers', { code: 'ABCD', name: 'x' })).status, 400)
  const cc = await post(t, '/cost-centers', { code: 'adm', name: 'Administración' })
  assert.equal(cc.status, 201)
  assert.equal(cc.json.code, 'ADM')
  assert.equal((await post(t, '/cost-centers', { code: 'ADM', name: 'x' })).json.code, 'cost_center_code_taken')
  const free = await costCenter(t, 'VEN')

  account(t, { code: '4101', type: 'gastos', cc: true })
  account(t, { code: '1101' })
  const pd = await entryType(t)
  await entry(t, pd, '2026-01', [
    { a: accId(t, '4101'), d: '5.00', cc: cc.json.id },
    { a: accId(t, '1101'), c: '5.00' },
  ])
  const refused = await post(t, `/cost-centers/${cc.json.id}/deactivate`)
  assert.equal(refused.status, 409)
  assert.equal(refused.json.code, 'cost_center_in_use')
  assert.equal((await patch(t, `/cost-centers/${cc.json.id}`, { isActive: false })).json.code, 'cost_center_in_use')

  const ok = await post(t, `/cost-centers/${free}/deactivate`)
  assert.equal(ok.json.isActive, false)
  assert.equal((await get(t, '/cost-centers')).json.length, 1)
  const renamed = await patch(t, `/cost-centers/${cc.json.id}`, { name: 'Admon' })
  assert.equal(renamed.json.name, 'Admon')
})

test('fiscal years: 12 months by default, no overlap, calendar fallback', async () => {
  const t = await newApp()
  const fy = await post(t, '/fiscal-years', { startPeriod: '2025-07' })
  assert.equal(fy.status, 201)
  assert.equal(fy.json.endPeriod, '2026-06')
  assert.equal(fy.json.name, 'Ejercicio 2025')
  const overlap = await post(t, '/fiscal-years', { startPeriod: '2026-01', endPeriod: '2026-12' })
  assert.equal(overlap.json.code, 'fiscal_year_overlap')
  const bad = await post(t, '/fiscal-years', { startPeriod: '2027-05', endPeriod: '2027-01' })
  assert.equal(bad.json.code, 'fiscal_year_invalid_range')

  const inside = await get(t, '/fiscal-years/for-period?period=2026-03')
  assert.equal(inside.json.id, fy.json.id)
  const calendar = await get(t, '/fiscal-years/for-period?period=2027-03')
  assert.deepEqual(calendar.json, { id: null, name: 'Ejercicio 2027', startPeriod: '2027-01', endPeriod: '2027-12' })
  assert.equal((await get(t, '/fiscal-years')).json.length, 1)

  addUser(t, 'dig')
  assert.equal((await post(t, '/fiscal-years', { startPeriod: '2030-01' }, { role: 'digitador', userId: 'dig' })).status, 403)
})

test('periods: 12 months with counts; close refuses drafts; close/reopen audited', async () => {
  const t = await newApp()
  account(t, { code: '1101' })
  account(t, { code: '2101', type: 'pasivo' })
  const pd = await entryType(t)
  const lines = [{ a: accId(t, '1101'), d: '1.00' }, { a: accId(t, '2101'), c: '1.00' }]
  await entry(t, pd, '2026-03', lines)
  const draft = await entry(t, pd, '2026-03', lines, { status: 'borrador' })
  await entry(t, pd, '2026-03', lines, { status: 'borrador' })

  const list = await get(t, '/periods?year=2026')
  assert.equal(list.json.length, 12)
  const march = list.json[2]
  assert.equal(march.period, '2026-03')
  assert.equal(march.status, 'open')
  assert.deepEqual(march.entries, { aplicada: 1, borrador: 2, voided: 0 })

  const refused = await post(t, '/periods/2026-03/close')
  assert.equal(refused.status, 409)
  assert.equal(refused.json.code, 'period_has_drafts')
  assert.equal(refused.json.count, 2)
  assert.match(refused.json.error, /2 partida/)

  addUser(t, 'dig')
  assert.equal((await post(t, '/periods/2026-04/close', {}, { role: 'digitador', userId: 'dig' })).status, 403)

  const closed = await post(t, '/periods/2026-04/close')
  assert.equal(closed.status, 200)
  assert.equal(closed.json.status, 'closed')
  assert.equal(closed.json.closedBy, 'user-test')
  assert.equal((await post(t, '/periods/2026-04/close')).json.code, 'period_already_closed')
  assert.equal((await get(t, '/periods?year=2026')).json[3].status, 'closed')
  const reopened = await post(t, '/periods/2026-04/reopen')
  assert.equal(reopened.json.status, 'open')
  assert.equal((await post(t, '/periods/2026-04/reopen')).json.code, 'period_not_closed')
  assert.deepEqual(auditActions(t, '2026-04'), ['cerrar_mes', 'abrir_mes'])
  assert.equal((await post(t, '/periods/2026-13/close')).json.code, 'invalid_period')
  assert.ok(draft.id)
})
