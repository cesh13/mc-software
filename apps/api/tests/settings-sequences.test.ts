import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { registerSettings } from '@accounting/shared'
import type { SequencesService, ServiceContext, SettingsService } from '@accounting/shared/server'
import { createTestApp } from '../src/testing/test-app.js'

registerSettings([
  { namespace: 'tax', key: 'vatRate', label: 'Tasa de IVA', schema: z.string().regex(/^\d+(\.\d+)?$/), default: '13', dated: true },
])

async function setup() {
  const t = await createTestApp({ modules: [] })
  const ctx: ServiceContext = { db: t.db, empresaId: t.empresaId, userId: 'u1', role: 'owner', audit: () => {} }
  const reg = t.directory.forActive(new Set())
  return { t, ctx, settings: reg.require<SettingsService>('settings', ctx), sequences: reg.require<SequencesService>('sequences', ctx) }
}

const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return (e as { code?: string }).code }
  return 'no_error'
}

test('settings: default, dated versions, validation, unknown keys', async () => {
  const { settings } = await setup()
  assert.equal(settings.get('tax', 'vatRate', '2026-01-01'), '13')
  settings.set('tax', 'vatRate', '12', '2026-07-01')
  assert.equal(settings.get('tax', 'vatRate', '2026-06-30'), '13')
  assert.equal(settings.get('tax', 'vatRate', '2026-07-01'), '12')
  assert.equal(code(() => settings.set('tax', 'vatRate', '12')), 'setting_valid_from_required')
  assert.equal(code(() => settings.set('tax', 'vatRate', 'trece', '2026-08-01')), 'setting_invalid')
  assert.equal(code(() => settings.get('tax', 'nope')), 'setting_unknown')
  assert.equal(settings.get('core', 'periodCloseMode'), 'advertir')
  settings.set('core', 'periodCloseMode', 'exigir')
  assert.equal(settings.get('core', 'periodCloseMode'), 'exigir')
  assert.deepEqual(settings.history('tax', 'vatRate').map((h) => [h.validFrom, h.value]), [['2026-07-01', '12']])
})

test('settings route: anyone in the empresa reads, core.settings.manage writes', async () => {
  const { t } = await setup()
  t.sqlite.prepare("insert into user (id, name, email, role, created_at, updated_at) values ('c1','C','c@x.com','consulta','x','x')").run()
  t.sqlite.prepare("insert into core_user_empresas values ('c1', 'empresa-test', 'x')").run()
  const as = { role: 'consulta', userId: 'c1' }
  const list = await t.request('/api/empresa-settings?namespace=core', as)
  assert.equal(list.status, 200)
  assert.equal(list.json[0].value, 'advertir')
  const body = { namespace: 'core', key: 'periodCloseMode', value: 'exigir' }
  assert.equal((await t.request('/api/empresa-settings', { ...as, method: 'PUT', body })).status, 403)
  const ok = await t.request('/api/empresa-settings', { method: 'PUT', body })
  assert.equal(ok.status, 200)
  const audit = t.sqlite.prepare("select count(*) as n from core_audit_log where action = 'configurar'").get() as { n: number }
  assert.equal(audit.n, 1)
})

test('sequences: next consumes in order, rolls back with the transaction, respects range', async () => {
  const { t, ctx, sequences } = await setup()
  assert.equal(code(() => sequences.next('receipts', 'R')), 'sequence_not_defined')
  sequences.define({ scope: 'receipts', key: 'R', nextValue: 98, width: 6, prefix: 'R-', rangeTo: 100 })
  assert.deepEqual(sequences.next('receipts', 'R'), { value: 98, formatted: 'R-000098' })
  // A failing document transaction does not consume the number.
  assert.throws(() => t.db.transaction((tx) => {
    t.directory.forActive(new Set()).require<SequencesService>('sequences', { ...ctx, db: tx as never }).next('receipts', 'R')
    throw new Error('document failed')
  }))
  assert.equal(sequences.peek('receipts', 'R')?.value, 99)
  assert.equal(sequences.next('receipts', 'R').value, 99)
  assert.equal(sequences.next('receipts', 'R').value, 100)
  assert.equal(code(() => sequences.next('receipts', 'R')), 'sequence_exhausted')
  assert.equal(code(() => sequences.define({ scope: 'receipts', key: 'R', nextValue: 50, width: 6 })), 'sequence_backwards')
})
