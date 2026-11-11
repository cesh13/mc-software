import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, costCenter, entry, entryType, get, newApp, post, standardChart, type App } from './fixtures.js'

type Row = { code: string; previousBalance: string; debits: string; credits: string; balance: string; level: number }

// Two months of activity over the standard chart (see fixtures).
async function scenario() {
  const t = await newApp()
  standardChart(t)
  const pd = await entryType(t)
  const a = (code: string) => accId(t, code)
  const pair = (dr: string, cr: string, n: string) => [{ a: a(dr), d: n }, { a: a(cr), c: n }]
  await entry(t, pd, '2026-01', pair('1101', '3101', '1000.00'), { date: '2026-01-02' })
  await entry(t, pd, '2026-01', pair('4101', '1101', '200.00'), { date: '2026-01-05' })
  await entry(t, pd, '2026-01', pair('1102', '5101', '500.00'), { date: '2026-01-06' })
  await entry(t, pd, '2026-01', pair('6101', '7101', '50.00'), { date: '2026-01-07' })
  await entry(t, pd, '2026-01', pair('1101', '2101', '300.00'), { date: '2026-01-08' })
  // Neither a draft nor a voided entry counts.
  await entry(t, pd, '2026-01', pair('1101', '2101', '999.00'), { status: 'borrador' })
  const voided = await entry(t, pd, '2026-01', pair('1101', '2101', '777.00'))
  await post(t, `/entries/${voided.id}/void`)
  await entry(t, pd, '2026-02', pair('2101', '1101', '100.00'), { date: '2026-02-03' })
  await entry(t, pd, '2026-02', pair('4102', '1102', '30.00'), { date: '2026-02-04' })
  await entry(t, pd, '2026-02', pair('5101', '1101', '20.00'), { date: '2026-02-05' })
  return { t, pd, a }
}

function byCode(rows: Row[]) {
  return Object.fromEntries(rows.map((r) => [r.code, [r.previousBalance, r.debits, r.credits, r.balance]]))
}

async function tb(t: App, query: string) {
  const res = await get(t, `/reports/trial-balance?${query}`)
  assert.equal(res.status, 200, JSON.stringify(res.json))
  return res.json as { rows: Row[]; totals: { debits: string; credits: string; balanced: boolean } }
}

test('trial balance: carry-over, nature of the 7 types, roll-up and totals', async () => {
  const { t } = await scenario()
  const jan = await tb(t, 'period=2026-01')
  assert.deepEqual(jan.totals, { debits: '2050.00', credits: '2050.00', balanced: true })
  assert.deepEqual(byCode(jan.rows)['1101'], ['0.00', '1300.00', '200.00', '1100.00'])

  const feb = await tb(t, 'period=2026-02')
  const r = byCode(feb.rows)
  assert.deepEqual(r['1101'], ['1100.00', '0.00', '120.00', '980.00']) // activo: debit nature
  assert.deepEqual(r['1102'], ['500.00', '0.00', '30.00', '470.00'])
  assert.deepEqual(r['11'], ['1600.00', '0.00', '150.00', '1450.00']) // roll-up level 2
  assert.deepEqual(r['1'], ['1600.00', '0.00', '150.00', '1450.00']) // roll-up level 1
  assert.deepEqual(r['2101'], ['300.00', '100.00', '0.00', '200.00']) // pasivo: credit nature
  assert.deepEqual(r['3101'], ['1000.00', '0.00', '0.00', '1000.00']) // capital
  assert.deepEqual(r['4101'], ['200.00', '0.00', '0.00', '200.00']) // gastos: debit nature
  assert.deepEqual(r['41'], ['200.00', '30.00', '0.00', '230.00'])
  assert.deepEqual(r['5101'], ['500.00', '20.00', '0.00', '480.00']) // ingresos: credit nature
  assert.deepEqual(r['6101'], ['50.00', '0.00', '0.00', '50.00']) // orden: debit nature
  assert.deepEqual(r['7101'], ['50.00', '0.00', '0.00', '50.00']) // contra: credit nature
  assert.deepEqual(r['3102'], ['0.00', '0.00', '0.00', '0.00'])
  assert.deepEqual(feb.totals, { debits: '150.00', credits: '150.00', balanced: true })

  const moved = await tb(t, 'period=2026-02&onlyWithMovement=true')
  assert.ok(!moved.rows.some((x) => x.code === '3102'))
  assert.ok(moved.rows.some((x) => x.code === '3101'))
  const level2 = await tb(t, 'period=2026-02&level=2')
  assert.ok(level2.rows.every((x) => x.level <= 2))
  assert.deepEqual(level2.totals, feb.totals)
  assert.equal((await get(t, '/reports/trial-balance?period=2026-2')).status, 400)
})

test('account ledger: opening balance, running balance, parent accounts', async () => {
  const { t, a } = await scenario()
  const res = await get(t, `/reports/account-ledger?accountId=${a('1101')}&from=2026-01-01&to=2026-02-28`)
  assert.equal(res.status, 200)
  assert.equal(res.json.openingBalance, '0.00')
  assert.deepEqual(res.json.movements.map((m: { balance: string }) => m.balance), ['1000.00', '800.00', '1100.00', '1000.00', '980.00'])
  assert.equal(res.json.movements[0].entryTypeCode, 'PD')
  assert.equal(res.json.movements[0].number, '000001')
  assert.deepEqual(res.json.totals, { debits: '1300.00', credits: '320.00' })
  assert.equal(res.json.closingBalance, '980.00')

  const feb = await get(t, `/reports/account-ledger?accountId=${a('1101')}&from=2026-02-01&to=2026-02-28`)
  assert.equal(feb.json.openingBalance, '1100.00')
  assert.equal(feb.json.movements.length, 2)

  const parent = await get(t, `/reports/account-ledger?accountId=${a('11')}&from=2026-01-01&to=2026-02-28`)
  assert.equal(parent.json.movements.length, 7)
  assert.equal(parent.json.closingBalance, '1450.00')
  assert.deepEqual([...new Set(parent.json.movements.map((m: { accountCode: string }) => m.accountCode))].sort(), ['1101', '1102'])

  const ingresos = await get(t, `/reports/account-ledger?accountId=${a('5101')}&from=2026-01-01&to=2026-12-31`)
  assert.deepEqual(ingresos.json.movements.map((m: { balance: string }) => m.balance), ['500.00', '480.00'])
  const bad = await get(t, `/reports/account-ledger?accountId=${a('5101')}&from=2026-02-01&to=2026-01-01`)
  assert.equal(bad.json.code, 'invalid_range')
})

test('journal: applied entries of the period with lines and totals', async () => {
  const { t } = await scenario()
  const res = await get(t, '/reports/journal?period=2026-01')
  assert.equal(res.status, 200)
  assert.equal(res.json.entries.length, 5)
  assert.equal(res.json.entries[0].lines.length, 2)
  assert.deepEqual(res.json.totals, { debit: '2050.00', credit: '2050.00' })
})

test('cost center variant of the trial balance and the ledger', async () => {
  const t = await newApp()
  account(t, { code: '4', type: 'gastos', detail: false })
  account(t, { code: '4101', type: 'gastos', parent: '4', cc: true })
  account(t, { code: '1101' })
  const pd = await entryType(t)
  const adm = await costCenter(t, 'ADM')
  const ven = await costCenter(t, 'VEN')
  const a = (code: string) => accId(t, code)
  await entry(t, pd, '2026-01', [{ a: a('4101'), d: '10.00', cc: adm }, { a: a('4101'), d: '4.00', cc: ven }, { a: a('1101'), c: '14.00' }])
  await entry(t, pd, '2026-02', [{ a: a('4101'), d: '1.00', cc: adm }, { a: a('1101'), c: '1.00' }])
  const r = byCode((await tb(t, `period=2026-02&costCenterId=${adm}`)).rows)
  assert.deepEqual(r['4101'], ['10.00', '1.00', '0.00', '11.00'])
  assert.deepEqual(r['4'], ['10.00', '1.00', '0.00', '11.00'])
  assert.equal(r['1101'], undefined)
  const ledger = await get(t, `/reports/account-ledger?accountId=${a('4101')}&from=2026-01-01&to=2026-12-31&costCenterId=${ven}`)
  assert.equal(ledger.json.closingBalance, '4.00')
  assert.equal(ledger.json.movements[0].costCenterCode, 'VEN')
  assert.equal((await get(t, '/reports/trial-balance?period=2026-02&costCenterId=nope')).status, 404)
})
