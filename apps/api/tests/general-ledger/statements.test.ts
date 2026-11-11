import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, addUser, costCenter, entry, entryType, get, newApp, post, standardChart } from './fixtures.js'

async function year2026() {
  const t = await newApp()
  standardChart(t)
  account(t, { code: '4103', type: 'gastos', parent: '41', cc: true })
  const pd = await entryType(t)
  const cierre = await entryType(t, 'CI')
  const adm = await costCenter(t, 'ADM')
  const ven = await costCenter(t, 'VEN')
  const a = (code: string) => accId(t, code)
  const pair = (dr: string, cr: string, n: string) => [{ a: a(dr), d: n }, { a: a(cr), c: n }]
  await entry(t, pd, '2026-01', pair('1101', '3101', '1000.00'))
  await entry(t, pd, '2026-03', pair('1101', '5101', '800.00'))
  await entry(t, pd, '2026-03', pair('1101', '5102', '50.00'))
  await entry(t, pd, '2026-04', pair('4101', '1101', '300.00'))
  await entry(t, pd, '2026-04', [{ a: a('4103'), d: '70.00', cc: adm }, { a: a('4103'), d: '30.00', cc: ven }, { a: a('1101'), c: '100.00' }])
  await entry(t, pd, '2026-05', pair('6101', '7101', '25.00'))
  const close = { period: '2026-12', entryTypeId: cierre, resultAccountId: a('3102') }
  return { t, pd, a, close, pair }
}

test('balance sheet: activo = pasivo + capital + resultado, before and after the annual close', async () => {
  const { t, pd, close, pair } = await year2026()
  const before = await get(t, '/reports/balance-sheet?period=2026-12')
  assert.equal(before.status, 200)
  assert.equal(before.json.activo.total, '1450.00')
  assert.equal(before.json.pasivo.total, '0.00')
  assert.equal(before.json.capital.total, '1000.00')
  assert.equal(before.json.currentYearResult, '450.00')
  assert.equal(before.json.priorYearsResult, '0.00')
  assert.equal(before.json.difference, '0.00')
  assert.equal(before.json.orden.total, '25.00')
  assert.equal(before.json.contra.total, '25.00')
  assert.equal(before.json.fiscalYear.startPeriod, '2026-01')
  assert.ok(before.json.activo.rows.some((r: { code: string; balance: string }) => r.code === '1' && r.balance === '1450.00'))

  // The next year sees the unclosed result as a prior-years result.
  const next = await get(t, '/reports/balance-sheet?period=2027-01')
  assert.equal(next.json.priorYearsResult, '450.00')
  assert.equal(next.json.currentYearResult, '0.00')
  assert.equal(next.json.difference, '0.00')

  assert.equal((await post(t, '/annual-close/apply', close)).status, 201)
  const after = await get(t, '/reports/balance-sheet?period=2026-12')
  assert.equal(after.json.capital.total, '1450.00')
  assert.equal(after.json.currentYearResult, '0.00')
  assert.equal(after.json.difference, '0.00')

  await entry(t, pd, '2027-02', pair('1101', '5101', '10.00'))
  const y2027 = await get(t, '/reports/balance-sheet?period=2027-03')
  assert.equal(y2027.json.priorYearsResult, '0.00')
  assert.equal(y2027.json.currentYearResult, '10.00')
  assert.equal(y2027.json.difference, '0.00')
})

test('income statement: range of periods, excluding the closing entry', async () => {
  const { t, close } = await year2026()
  const q = '/reports/income-statement?from=2026-01&to=2026-12'
  const before = await get(t, q)
  assert.equal(before.json.ingresos.total, '850.00')
  assert.equal(before.json.gastos.total, '400.00')
  assert.equal(before.json.netResult, '450.00')
  const r = Object.fromEntries(before.json.gastos.rows.map((x: { code: string; balance: string }) => [x.code, x.balance]))
  assert.deepEqual([r['4'], r['41'], r['4101'], r['4103']], ['400.00', '400.00', '300.00', '100.00'])
  await post(t, '/annual-close/apply', close)
  assert.deepEqual((await get(t, q)).json, before.json)
  const april = await get(t, '/reports/income-statement?from=2026-04&to=2026-04')
  assert.equal(april.json.netResult, '-400.00')
  assert.equal((await get(t, '/reports/income-statement?from=2026-05&to=2026-04')).json.code, 'invalid_range')
})

test('annual close: preview, apply, already closed, void and redo', async () => {
  const { t, close } = await year2026()
  const preview = await post(t, '/annual-close/preview', close)
  assert.equal(preview.status, 200)
  assert.equal(preview.json.concept, 'CIERRE CONTABLE EJERCICIO/2026')
  assert.equal(preview.json.date, '2026-12-31')
  assert.equal(preview.json.period, '2026-12')
  assert.equal(preview.json.result, '450.00')
  assert.equal(preview.json.alreadyClosed, false)
  const lines = preview.json.lines.map((l: { accountCode: string; costCenterCode: string | null; debit: string; credit: string }) =>
    [l.accountCode, l.costCenterCode, l.debit, l.credit])
  assert.deepEqual(lines, [
    ['4101', null, '0.00', '300.00'],
    ['4103', 'ADM', '0.00', '70.00'],
    ['4103', 'VEN', '0.00', '30.00'],
    ['5101', null, '800.00', '0.00'],
    ['5102', null, '50.00', '0.00'],
    ['3102', null, '0.00', '450.00'],
  ])
  assert.deepEqual(preview.json.totals, { debit: '850.00', credit: '850.00', difference: '0.00' })

  const applied = await post(t, '/annual-close/apply', close)
  assert.equal(applied.status, 201)
  assert.equal(applied.json.source, 'cierre')
  assert.equal(applied.json.status, 'aplicada')
  assert.equal(applied.json.totals.difference, '0.00')
  assert.equal(applied.json.editable, false)
  const tb = await get(t, '/reports/trial-balance?period=2026-12')
  const row = (code: string) => tb.json.rows.find((x: { code: string }) => x.code === code).balance
  assert.deepEqual([row('4'), row('5'), row('3102'), row('3')], ['0.00', '0.00', '450.00', '1450.00'])
  assert.equal(tb.json.totals.balanced, true)

  const again = await post(t, '/annual-close/apply', close)
  assert.equal(again.status, 409)
  assert.equal(again.json.code, 'already_closed')
  assert.equal((await post(t, '/annual-close/preview', close)).json.alreadyClosed, true)
  const audit = t.sqlite.prepare("select count(*) as n from core_audit_log where action = 'cierre_anual'").get() as { n: number }
  assert.equal(audit.n, 1)

  await post(t, `/entries/${applied.json.id}/void`)
  const redo = await post(t, '/annual-close/apply', { ...close, period: '2026-06', date: '2026-12-30' })
  assert.equal(redo.status, 201)
  assert.equal(redo.json.date, '2026-12-30')
})

test('annual close: loss goes to debit; result account and period rules', async () => {
  const t = await newApp()
  standardChart(t)
  const ci = await entryType(t, 'CI')
  const a = (code: string) => accId(t, code)
  await entry(t, ci, '2026-02', [{ a: a('4101'), d: '90.00' }, { a: a('5101'), c: '40.00' }, { a: a('1101'), c: '50.00' }])
  const base = { period: '2026-01', entryTypeId: ci }
  const loss = await post(t, '/annual-close/preview', { ...base, resultAccountId: a('3101') })
  assert.equal(loss.json.result, '-50.00')
  const last = loss.json.lines.at(-1)
  assert.deepEqual([last.accountCode, last.debit, last.credit], ['3101', '50.00', '0.00'])

  assert.equal((await post(t, '/annual-close/preview', { ...base, resultAccountId: a('31') })).json.code, 'result_account_not_detail')
  assert.equal((await post(t, '/annual-close/preview', { ...base, resultAccountId: a('4101') })).json.code, 'result_account_invalid_type')
  assert.equal((await post(t, '/annual-close/preview', { ...base, resultAccountId: a('3101'), date: '2026-11-30' })).json.code, 'wrong_month')
  assert.equal((await post(t, '/annual-close/preview', { entryTypeId: ci, resultAccountId: a('3101') })).json.code, 'validation')
  await post(t, '/periods/2026-12/close')
  assert.equal((await post(t, '/annual-close/apply', { ...base, resultAccountId: a('3101') })).json.code, 'period_closed')
  addUser(t, 'dc')
  assert.equal((await post(t, '/annual-close/preview', { ...base, resultAccountId: a('3101') }, { role: 'digitador_consulta', userId: 'dc' })).status, 403)
})

test('annual close follows a configured fiscal year', async () => {
  const t = await newApp()
  standardChart(t)
  const ci = await entryType(t, 'CI')
  const fy = await post(t, '/fiscal-years', { startPeriod: '2025-07' })
  await entry(t, ci, '2025-09', [{ a: accId(t, '1101'), d: '5.00' }, { a: accId(t, '5101'), c: '5.00' }])
  const p = await post(t, '/annual-close/preview', { fiscalYearId: fy.json.id, entryTypeId: ci, resultAccountId: accId(t, '3102') })
  assert.equal(p.json.period, '2026-06')
  assert.equal(p.json.date, '2026-06-30')
  assert.equal(p.json.result, '5.00')
  const bs = await get(t, '/reports/balance-sheet?period=2026-02')
  assert.equal(bs.json.fiscalYear.id, fy.json.id)
  assert.equal(bs.json.currentYearResult, '5.00')
})
