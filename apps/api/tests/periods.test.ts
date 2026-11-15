import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PeriodsService, ServiceContext } from '@accounting/shared/server'
import { createTestApp } from '../src/testing/test-app.js'

async function setup() {
  const t = await createTestApp({ modules: [] })
  const ctx: ServiceContext = { db: t.db, empresaId: t.empresaId, userId: 'u1', role: 'owner', audit: () => {} }
  const periods = t.directory.forActive(new Set()).require<PeriodsService>('periods', ctx)
  return { t, periods }
}

const code = (fn: () => unknown) => {
  try { fn() } catch (e) { return (e as { code?: string }).code }
  return 'no_error'
}

test('periods contract: status per area, dates or months, assertOpen across areas', async () => {
  const { periods } = await setup()
  assert.equal(periods.status('2026-03-15', 'gl'), 'open')
  periods.close('2026-03', 'banking')
  assert.equal(periods.status('2026-03-31', 'banking'), 'closed')
  assert.equal(periods.status('2026-03', 'gl'), 'open')
  assert.equal(code(() => periods.assertOpen('2026-03-10', ['gl'])), 'no_error')
  assert.equal(code(() => periods.assertOpen('2026-03-10', ['gl', 'banking'])), 'period_closed')
  assert.equal(code(() => periods.close('2026-03', 'banking')), 'period_already_closed')
  assert.equal(code(() => periods.status('2026-13', 'gl')), 'invalid_period')
})

test('periods contract: filed months cannot be reopened; list by area and year', async () => {
  const { periods } = await setup()
  assert.equal(code(() => periods.markFiled('2026-01', 'tax', 'F07-1')), 'period_not_closed')
  periods.close('2026-01', 'tax')
  periods.markFiled('2026-01', 'tax', 'F07-1')
  assert.equal(code(() => periods.reopen('2026-01', 'tax', 'motivo suficiente')), 'period_filed')
  periods.close('2026-02', 'tax')
  assert.equal(code(() => periods.reopen('2026-02', 'tax', '')), 'reopen_reason_required')
  const row = periods.reopen('2026-02', 'tax', 'Documento tardío del proveedor')
  assert.equal(row.status, 'open')
  assert.equal(row.reopenedBy, 'u1')
  assert.deepEqual(periods.list('tax', '2026').map((r) => [r.period, r.status]), [['2026-01', 'filed'], ['2026-02', 'open']])
  assert.deepEqual(periods.list('gl', '2026'), [])
})
