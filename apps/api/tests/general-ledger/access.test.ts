import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, addEmpresa, addUser, entry, entryBody, entryType, get, newApp, post, put } from './fixtures.js'

const REPORTS = [
  '/reports/trial-balance?period=2026-01',
  '/reports/journal?period=2026-01',
  '/reports/balance-sheet?period=2026-01',
  '/reports/income-statement?from=2026-01&to=2026-01',
  '/entries/unbalanced',
]

test('permissions by role', async () => {
  const t = await newApp()
  account(t, { code: '1101' })
  account(t, { code: '2101', type: 'pasivo' })
  const pd = await entryType(t)
  const lines = [{ a: accId(t, '1101'), d: '1.00' }, { a: accId(t, '2101'), c: '1.00' }]
  const e = await entry(t, pd, '2026-01', lines)
  addUser(t, 'con')
  addUser(t, 'dig')
  const consulta = { role: 'consulta', userId: 'con' }
  const digitador = { role: 'digitador', userId: 'dig' }

  // consulta: reads and reports, no capture.
  assert.equal((await post(t, '/entries', entryBody(pd, '2026-01', lines), consulta)).status, 403)
  assert.equal((await put(t, `/entries/${e.id}`, entryBody(pd, '2026-01', lines), consulta)).status, 403)
  assert.equal((await post(t, `/entries/${e.id}/void`, {}, consulta)).status, 403)
  assert.equal((await post(t, '/entry-types', { code: 'XX', name: 'x' }, consulta)).status, 403)
  assert.equal((await get(t, `/entries/${e.id}`, consulta)).status, 200)
  for (const url of REPORTS) assert.equal((await get(t, url, consulta)).status, 200, url)
  assert.equal((await get(t, `/reports/account-ledger?accountId=${accId(t, '1101')}&from=2026-01-01&to=2026-01-31`, consulta)).status, 200)

  // digitador: capture, but no reports, no month close, no annual close.
  assert.equal((await post(t, '/entries', entryBody(pd, '2026-01', lines), digitador)).status, 201)
  assert.equal((await get(t, '/entries?period=2026-01', digitador)).status, 200)
  for (const url of REPORTS) assert.equal((await get(t, url, digitador)).status, 403, url)
  assert.equal((await post(t, '/periods/2026-01/close', {}, digitador)).status, 403)
  assert.equal((await post(t, '/periods/2026-01/reopen', {}, digitador)).status, 403)
  const close = { period: '2026-01', entryTypeId: pd, resultAccountId: accId(t, '2101') }
  assert.equal((await post(t, '/annual-close/preview', close, digitador)).status, 403)
  assert.equal((await post(t, '/annual-close/apply', close, digitador)).status, 403)

  // supervisor: everything.
  addUser(t, 'sup')
  assert.equal((await post(t, '/periods/2026-02/close', {}, { role: 'supervisor', userId: 'sup' })).status, 200)
  const audit = t.sqlite.prepare("select user_id from core_audit_log where entity_id = '2026-02'").get() as { user_id: string }
  assert.equal(audit.user_id, 'sup')
})

test('empresa isolation: entries, accounts, types and cost centers of another empresa are invisible', async () => {
  const t = await newApp()
  addEmpresa(t, 'emp-b', 'B')
  account(t, { code: '1101' })
  account(t, { code: '2101', type: 'pasivo' })
  account(t, { code: '1101', empresaId: 'emp-b' })
  account(t, { code: '2101', type: 'pasivo', empresaId: 'emp-b' })
  const b = { empresaId: 'emp-b' }
  const pdA = await entryType(t)
  const pdB = await entryType(t, 'PD', 6, b)
  const ccB = (await post(t, '/cost-centers', { code: 'ADM', name: 'x' }, b)).json.id
  const lines = [{ a: accId(t, '1101'), d: '1.00' }, { a: accId(t, '2101'), c: '1.00' }]
  const eA = await entry(t, pdA, '2026-01', lines)

  // Another empresa cannot see or touch empresa A's entry.
  assert.equal((await get(t, `/entries/${eA.id}`, b)).status, 404)
  assert.equal((await post(t, `/entries/${eA.id}/void`, {}, b)).json.code, 'entry_not_found')
  assert.equal((await get(t, '/entries?period=2026-01', b)).json.length, 0)

  // Empresa A cannot use B's account, entry type or cost center.
  const foreignAccount = await post(t, '/entries', entryBody(pdA, '2026-01', [
    { a: accId(t, '1101', 'emp-b'), d: '1.00' }, { a: accId(t, '2101'), c: '1.00' },
  ]))
  assert.equal(foreignAccount.json.code, 'account_not_found')
  assert.equal((await post(t, '/entries', entryBody(pdB, '2026-01', lines))).json.code, 'entry_type_not_found')
  account(t, { code: '4101', type: 'gastos', cc: true })
  const foreignCc = await post(t, '/entries', entryBody(pdA, '2026-01', [
    { a: accId(t, '4101'), d: '1.00', cc: ccB }, { a: accId(t, '2101'), c: '1.00' },
  ]))
  assert.equal(foreignCc.json.code, 'cost_center_not_found')
  assert.equal((await get(t, `/reports/account-ledger?accountId=${accId(t, '1101', 'emp-b')}&from=2026-01-01&to=2026-01-31`)).status, 404)

  // Same numbering space is independent per empresa.
  const eB = await post(t, '/entries', entryBody(pdB, '2026-01', [
    { a: accId(t, '1101', 'emp-b'), d: '9.00' }, { a: accId(t, '2101', 'emp-b'), c: '9.00' },
  ]), b)
  assert.equal(eB.json.number, '000001')
  const tbA = await get(t, '/reports/trial-balance?period=2026-01')
  assert.equal(tbA.json.totals.debits, '1.00')
  assert.ok(tbA.json.rows.every((r: { accountId: string }) => !r.accountId.includes('emp-b')))

  // A user without a grant for B is refused by the platform.
  addUser(t, 'con')
  assert.equal((await get(t, '/entries?period=2026-01', { role: 'consulta', userId: 'con', empresaId: 'emp-b' })).status, 403)
})
