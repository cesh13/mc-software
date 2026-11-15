import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consumerManifest, providerManifest } from '../src/testing/fake-modules.js'
import { createTestApp } from '../src/testing/test-app.js'

const setup = () => createTestApp({ modules: ['chart-of-accounts'], extraManifests: [providerManifest, consumerManifest] })
const toggle = (t: Awaited<ReturnType<typeof setup>>, id: string, enabled: boolean) =>
  t.request(`/api/empresa-modules/empresa-test/${id}`, { method: 'PUT', body: { enabled } })

test('a module not active for the empresa answers module_disabled', async () => {
  const t = await setup()
  const res = await t.request('/api/test-provider/ping')
  assert.equal(res.status, 403)
  assert.equal(res.json.code, 'module_disabled')
  assert.equal((await t.request('/api/chart-of-accounts/accounts')).status, 200)
})

test('a required service must be active before the consumer; optional ones resolve to null', async () => {
  const t = await setup()
  const blocked = await toggle(t, 'test-consumer', true)
  assert.equal(blocked.status, 409)
  assert.equal(blocked.json.code, 'module_requires')
  assert.equal((await toggle(t, 'test-provider', true)).status, 200)
  const ok = await toggle(t, 'test-consumer', true)
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.json.find((m: { id: string }) => m.id === 'test-consumer').missing, [])

  const ping = await t.request('/api/test-consumer/ping')
  assert.equal(ping.status, 200)
  assert.deepEqual(ping.json, { echo: 'empresa-test:hola', absent: null })

  const off = await toggle(t, 'test-provider', false)
  assert.equal(off.status, 409)
  assert.equal(off.json.code, 'module_required_by')
})

test('activation rules: always-on, unknown module, permission, audit', async () => {
  const t = await setup()
  assert.equal((await toggle(t, 'chart-of-accounts', false)).status, 409)
  assert.equal((await toggle(t, 'nope', true)).status, 404)
  t.sqlite.prepare("insert into user (id, name, email, role, created_at, updated_at) values ('s1','S','s@x.com','supervisor','x','x')").run()
  t.sqlite.prepare("insert into core_user_empresas values ('s1', 'empresa-test', 'x')").run()
  const bySupervisor = await t.request('/api/empresa-modules/empresa-test/test-provider', {
    method: 'PUT', body: { enabled: true }, role: 'supervisor', userId: 's1',
  })
  assert.equal(bySupervisor.status, 403)
  assert.equal((await t.request('/api/empresa-modules/empresa-test', { role: 'supervisor', userId: 's1' })).status, 200)
  await toggle(t, 'test-provider', true)
  const n = t.sqlite.prepare("select count(*) as n from core_audit_log where action = 'activar-modulo'").get() as { n: number }
  assert.equal(n.n, 1)
})
