import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, entry, entryType, get, newApp, type App } from './fixtures.js'

const AWKWARD = ['0.29', '0.57', '1.15', '1005.01']

test('sums are exact to the cent with amounts that drift as floats', async () => {
  const t = await newApp()
  account(t, { code: '1101' })
  account(t, { code: '4101', type: 'gastos' })
  const pd = await entryType(t)
  const periods = ['2026-01', '2026-02', '2026-03']
  for (const period of periods) {
    const lines = []
    for (let i = 0; i < 100; i++) for (const n of AWKWARD) lines.push({ a: accId(t, '4101'), d: n })
    lines.push({ a: accId(t, '1101'), c: '100702.00' })
    const e = await entry(t, pd, period, lines)
    assert.equal(e.status, 'aplicada')
  }
  // The float sum of the same numbers is off, which is what this test guards against.
  let float = 0
  for (let i = 0; i < 300; i++) for (const n of AWKWARD) float += Number(n)
  assert.notEqual(float.toFixed(10), '302106.0000000000')

  const tb = await get(t, '/reports/trial-balance?period=2026-03')
  const row = tb.json.rows.find((r: { code: string }) => r.code === '4101')
  assert.deepEqual([row.previousBalance, row.debits, row.balance], ['201404.00', '100702.00', '302106.00'])
  assert.deepEqual(tb.json.totals, { debits: '100702.00', credits: '100702.00', balanced: true })
  const ledger = await get(t, `/reports/account-ledger?accountId=${accId(t, '4101')}&from=2026-01-01&to=2026-03-31`)
  assert.equal(ledger.json.closingBalance, '302106.00')
  assert.equal(ledger.json.movements.length, 1200)
  const bs = await get(t, '/reports/balance-sheet?period=2026-03')
  assert.equal(bs.json.currentYearResult, '-302106.00')
  assert.equal(bs.json.difference, '0.00')
})

// ~50,000 lines over 500 detail accounts and 12 months, inserted with raw SQL.
function bulk(t: App, typeId: string) {
  const now = new Date().toISOString()
  account(t, { code: '1', detail: false })
  account(t, { code: '5', type: 'ingresos', detail: false })
  for (let g = 0; g < 10; g++) {
    account(t, { code: `1${g}`, parent: '1', detail: false })
    for (let i = 0; i < 50; i++) account(t, { code: `1${g}${String(i).padStart(3, '0')}`, parent: `1${g}` })
  }
  account(t, { code: '5101', type: 'ingresos', parent: '5' })
  const insEntry = t.sqlite.prepare(`insert into gl_journal_entries (id, empresa_id, period, entry_type_id, number, date,
    status, created_by, created_at, updated_at) values (?, ?, ?, ?, ?, ?, 'aplicada', 'u', ?, ?)`)
  const insLine = t.sqlite.prepare('insert into gl_journal_lines (id, entry_id, line_no, account_id, detail, debit, credit) values (?, ?, ?, ?, ?, ?, ?)')
  t.sqlite.exec('begin')
  let n = 0
  for (let m = 1; m <= 12; m++) {
    const period = `2026-${String(m).padStart(2, '0')}`
    for (let k = 0; k < 420; k++) {
      const id = `bulk-${m}-${k}`
      insEntry.run(id, t.empresaId, period, typeId, String(k + 1).padStart(6, '0'), `${period}-10`, now, now)
      for (let j = 0; j < 9; j++) {
        const acc = accId(t, `1${(k + j) % 10}${String((k * 7 + j) % 50).padStart(3, '0')}`)
        insLine.run(`${id}-${j}`, id, j + 1, acc, 'x', '10.33', '0.00')
        n++
      }
      insLine.run(`${id}-9`, id, 10, accId(t, '5101'), 'x', '0.00', '92.97')
      n++
    }
  }
  t.sqlite.exec('commit')
  return n
}

test('performance: reports over ~50,000 lines stay fast', async () => {
  const t = await newApp()
  const pd = await entryType(t)
  assert.ok(bulk(t, pd) >= 50000)
  const time = async (url: string) => {
    const start = performance.now()
    const res = await get(t, url)
    assert.equal(res.status, 200, url)
    return { ms: performance.now() - start, json: res.json }
  }
  const tb = await time('/reports/trial-balance?period=2026-12')
  assert.equal(tb.json.totals.balanced, true)
  assert.equal(tb.json.rows.find((r: { code: string }) => r.code === '5101').balance, '468568.80') // 92.97 × 5,040
  const bs = await time('/reports/balance-sheet?period=2026-12')
  assert.equal(bs.json.difference, '0.00')
  const ledger = await time(`/reports/account-ledger?accountId=${accId(t, '1')}&from=2026-01-01&to=2026-12-31`)
  assert.equal(ledger.json.closingBalance, '468568.80')
  const list = await time('/entries?period=2026-06')
  assert.equal(list.json.length, 420)
  for (const r of [tb, bs, ledger, list]) assert.ok(r.ms < 3000, `${r.ms}ms`)
  console.log(`trial balance ${tb.ms.toFixed(0)}ms, balance sheet ${bs.ms.toFixed(0)}ms, ledger ${ledger.ms.toFixed(0)}ms, list ${list.ms.toFixed(0)}ms`)
})
