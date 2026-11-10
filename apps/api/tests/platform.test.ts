import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../src/testing/test-app.js'

test('loads the always-on modules and runs their migrations', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts', 'general-ledger'] })
  assert.deepEqual(t.loaded, ['chart-of-accounts', 'general-ledger'])
  const tables = t.sqlite
    .prepare("select name from sqlite_master where type='table' and name like 'gl_%'")
    .all()
  assert.ok(tables.length >= 7)
})

test('module routes require a user and an allowed empresa', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  const url = '/api/chart-of-accounts/does-not-exist'

  const anonymous = await t.app.request(url)
  assert.equal(anonymous.status, 401)

  const noEmpresa = await t.request(url, { empresaId: null })
  assert.equal(noEmpresa.status, 400)
  assert.equal(noEmpresa.json.code, 'empresa_required')

  const unknown = await t.request(url, { empresaId: 'nope' })
  assert.equal(unknown.status, 404)

  const notGranted = await t.request(url, { role: 'digitador' })
  assert.equal(notGranted.status, 403)
  assert.equal(notGranted.json.code, 'empresa_forbidden')

  const owner = await t.request(url)
  assert.equal(owner.status, 404) // passed the platform checks; route not found
})

test('empresas: supervisors create, others only list what they were granted', async () => {
  const t = await createTestApp({ modules: [] })

  const denied = await t.request('/api/empresas', {
    role: 'digitador',
    body: { name: 'Otra', siglas: 'ot' },
  })
  assert.equal(denied.status, 403)

  const created = await t.request('/api/empresas', { body: { name: 'Otra', siglas: 'ot' } })
  assert.equal(created.status, 201)
  assert.equal(created.json.siglas, 'OT')
  assert.equal(created.json.moneda, 'USD')

  const dup = await t.request('/api/empresas', { body: { name: 'Otra 2', siglas: 'OT' } })
  assert.equal(dup.status, 409)

  const ownerList = await t.request('/api/empresas')
  assert.equal(ownerList.json.length, 2)

  const digitadorList = await t.request('/api/empresas', { role: 'digitador' })
  assert.deepEqual(digitadorList.json, [])

  const audit = t.sqlite.prepare("select count(*) as n from core_audit_log where entity = 'empresa'").get() as { n: number }
  assert.equal(audit.n, 1)
})
