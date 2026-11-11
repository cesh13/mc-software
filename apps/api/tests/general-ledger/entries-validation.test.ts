import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, costCenter, entryBody, entryType, get, newApp, post, type App } from './fixtures.js'

async function setup() {
  const t = await newApp()
  account(t, { code: '1', detail: false })
  account(t, { code: '1101', parent: '1' })
  account(t, { code: '1102', parent: '1', active: false })
  account(t, { code: '4101', type: 'gastos', cc: true })
  account(t, { code: '2101', type: 'pasivo' })
  const pd = await entryType(t)
  const cc = await costCenter(t, 'ADM')
  return { t, pd, cc, a: (code: string) => accId(t, code) }
}

function save(t: App, body: unknown) {
  return post(t, '/entries', body)
}

test('date must fall inside the period', async () => {
  const { t, pd, a } = await setup()
  const lines = [{ a: a('1101'), d: '1.00' }, { a: a('2101'), c: '1.00' }]
  const year = await save(t, entryBody(pd, '2026-03', lines, { date: '2025-03-10' }))
  assert.equal(year.json.code, 'wrong_year')
  assert.match(year.json.error, /Año incorrecto/)
  const month = await save(t, entryBody(pd, '2026-03', lines, { date: '2026-04-01' }))
  assert.equal(month.json.code, 'wrong_month')
  assert.match(month.json.error, /Mes incorrecto/)
  assert.equal((await save(t, entryBody(pd, '2026-03', lines, { date: '2026-02-30' }))).json.code, 'validation')
  assert.equal((await save(t, entryBody(pd, '2026-03', lines, { date: '2026-03-31' }))).status, 201)
})

test('line account: must exist, be active and be a detail account', async () => {
  const { t, pd, a } = await setup()
  const tail = { a: a('2101'), c: '1.00' }
  const missing = await save(t, entryBody(pd, '2026-01', [{ a: 'nope', d: '1.00' }, tail]))
  assert.equal(missing.status, 404)
  assert.equal(missing.json.code, 'account_not_found')
  const parent = await save(t, entryBody(pd, '2026-01', [{ a: a('1'), d: '1.00' }, tail]))
  assert.equal(parent.json.code, 'account_not_detail')
  assert.match(parent.json.error, /Cuenta 1 no es de detalle/)
  const inactive = await save(t, entryBody(pd, '2026-01', [{ a: a('1102'), d: '1.00' }, tail]))
  assert.equal(inactive.json.code, 'account_inactive')
  // The line number is reported.
  const second = await save(t, entryBody(pd, '2026-01', [tail, { a: a('1'), d: '1.00' }]))
  assert.match(second.json.error, /^Línea 2:/)
})

test('cost center: mandatory when the account requires it, empty otherwise', async () => {
  const { t, pd, cc, a } = await setup()
  const required = await save(t, entryBody(pd, '2026-01', [{ a: a('4101'), d: '1.00' }, { a: a('1101'), c: '1.00' }]))
  assert.equal(required.json.code, 'cost_center_required')
  const unknown = await save(t, entryBody(pd, '2026-01', [{ a: a('4101'), d: '1.00', cc: 'nope' }, { a: a('1101'), c: '1.00' }]))
  assert.equal(unknown.json.code, 'cost_center_not_found')
  const notAllowed = await save(t, entryBody(pd, '2026-01', [{ a: a('4101'), d: '1.00', cc }, { a: a('1101'), c: '1.00', cc }]))
  assert.equal(notAllowed.json.code, 'cost_center_not_allowed')
  const ok = await save(t, entryBody(pd, '2026-01', [{ a: a('4101'), d: '1.00', cc }, { a: a('1101'), c: '1.00' }]))
  assert.equal(ok.status, 201)
  assert.equal(ok.json.lines[0].costCenterCode, 'ADM')
  assert.equal(ok.json.lines[1].costCenterId, null)
})

test('detail defaults to the concept (or previous line) and is required', async () => {
  const { t, pd, a } = await setup()
  const lines = [{ a: a('1101'), d: '1.00', detail: 'Propio' }, { a: a('2101'), c: '1.00' }]
  const withConcept = await save(t, entryBody(pd, '2026-01', [{ a: a('1101'), d: '1.00' }, { a: a('2101'), c: '1.00' }]))
  assert.equal(withConcept.json.lines[0].detail, 'Partida de prueba')
  const prev = await save(t, entryBody(pd, '2026-01', lines, { concept: '' }))
  assert.equal(prev.status, 201)
  assert.deepEqual(prev.json.lines.map((l: { detail: string }) => l.detail), ['Propio', 'Propio'])
  const none = await save(t, entryBody(pd, '2026-01', [{ a: a('1101'), d: '1.00' }, { a: a('2101'), c: '1.00' }], { concept: '' }))
  assert.equal(none.json.code, 'detail_required')
})

test('amounts: debit or credit, never both; zero lines need allowZeroLines; 2 decimals', async () => {
  const { t, pd, a } = await setup()
  const both = await save(t, entryBody(pd, '2026-01', [{ a: a('1101'), d: '1.00', c: '1.00' }]))
  assert.equal(both.json.code, 'debit_and_credit')
  const zero = [{ a: a('1101'), d: '1.00' }, { a: a('2101'), c: '1.00' }, { a: a('1101') }]
  assert.equal((await save(t, entryBody(pd, '2026-01', zero))).json.code, 'zero_line')
  const allowed = await save(t, entryBody(pd, '2026-01', zero, { allowZeroLines: true }))
  assert.equal(allowed.status, 201)
  assert.equal(allowed.json.lines.length, 3)
  for (const bad of ['-1.00', '1.001', 'abc', '1,00']) {
    const res = await save(t, entryBody(pd, '2026-01', [{ a: a('1101'), d: bad }, { a: a('2101'), c: '1.00' }]))
    assert.equal(res.json.code, 'validation', bad)
  }
  const normalized = await save(t, entryBody(pd, '2026-01', [{ a: a('1101'), d: '1.5' }, { a: a('2101'), c: '1.50' }]))
  assert.equal(normalized.json.lines[0].debit, '1.50')
  assert.equal((await save(t, entryBody(pd, '2026-01', []))).json.code, 'no_lines')
})

test('aplicada must balance; borrador may not', async () => {
  const { t, pd, a } = await setup()
  const lines = [{ a: a('1101'), d: '100.00' }, { a: a('2101'), c: '90.00' }]
  const rejected = await save(t, entryBody(pd, '2026-01', lines))
  assert.equal(rejected.status, 409)
  assert.equal(rejected.json.code, 'unbalanced')
  assert.equal(rejected.json.difference, '10.00')
  assert.match(rejected.json.error, /NO CUADRA por 10.00/)
  const draft = await save(t, entryBody(pd, '2026-01', lines, { status: 'borrador' }))
  assert.equal(draft.status, 201)
  assert.equal(draft.json.status, 'borrador')
  assert.deepEqual(draft.json.totals, { debit: '100.00', credit: '90.00', difference: '10.00' })
  // Nothing was saved by the rejected attempt.
  assert.equal((await get(t, '/entries?period=2026-01')).json.length, 1)
})

test('closed period blocks new entries', async () => {
  const { t, pd, a } = await setup()
  await post(t, '/periods/2026-02/close')
  const res = await save(t, entryBody(pd, '2026-02', [{ a: a('1101'), d: '1.00' }, { a: a('2101'), c: '1.00' }]))
  assert.equal(res.status, 409)
  assert.equal(res.json.code, 'period_closed')
})
