import { test } from 'node:test'
import assert from 'node:assert/strict'
import { costState, doc, entryLines, get, item, mkDoc, post, setup } from './helpers.js'

test('entries move the moving average; salidas are valued at it and frozen', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '10', unitCost: '2.00' }])
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '10', unitCost: '3.00' }])
  assert.deepEqual(costState(t, x), { quantity: '20.00000', value: '50.00', avg: '2.50000' })
  const out = await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '4' }])
  assert.equal(out.lines[0].unitCost, '2.50000')
  assert.equal(out.lines[0].totalCost, '10.00')
  assert.equal(out.number, '000001')
  // A later entrada does not change the salida already saved.
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '4', unitCost: '5.00' }])
  assert.equal((await get(t, `/documents/${out.id}`)).json.lines[0].totalCost, '10.00')
  assert.deepEqual(costState(t, x), { quantity: '20.00000', value: '60.00', avg: '3.00000' })
})

test('taking the whole stock takes the whole value (no cents left)', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '3', unitCost: '1.00' }])
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '3', unitCost: '1.01' }])
  await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '1' }])
  await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '5' }])
  assert.deepEqual(costState(t, x), { quantity: '0.00000', value: '0.00', avg: '1.00400' })
})

test('each document posts one entry: purchase, sale cost, adjustment; transfers do not post', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  const buy = await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '10', unitCost: '2.00' }])
  assert.deepEqual(entryLines(t, buy.entry.entryId), [
    { code: '1104', debit: '20.00', credit: '0.00' }, { code: '2101', debit: '0.00', credit: '20.00' },
  ])
  const sale = await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '3' }])
  assert.deepEqual(entryLines(t, sale.entry.entryId), [
    { code: '1104', debit: '0.00', credit: '6.00' }, { code: '5101', debit: '6.00', credit: '0.00' },
  ])
  const shrink = await mkDoc(t, types.shrink, wh.a, [{ itemId: x, quantity: '1' }])
  assert.equal(entryLines(t, shrink.entry.entryId)[1]!.code, '5102')
  const tr = await mkDoc(t, types.transfer, wh.a, [{ itemId: x, quantity: '2' }], { destWarehouseId: wh.b })
  assert.equal(tr.entry, null)
  const stock = (await get(t, '/reports/stock?at=2026-11-30')).json
  assert.deepEqual(stock.map((r: any) => [r.warehouseCode, r.quantity]), [['1', '4.00000'], ['2', '2.00000']])
  const src = t.sqlite.prepare("select count(*) as n from gl_journal_entries where source = 'inventario'").get() as { n: number }
  assert.equal(src.n, 3)
})

test('salidas without stock are blocked unless allowed with permission or by the empresa', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '2', unitCost: '1.00' }])
  const short = await doc(t, types.out, wh.b, [{ itemId: x, quantity: '1' }])
  assert.equal(short.status, 409)
  assert.equal(short.json.code, 'insufficient_stock')
  const digitador = await doc(t, types.out, wh.a, [{ itemId: x, quantity: '5' }], { allowNegative: true }, { role: 'digitador', userId: 'd1' })
  assert.notEqual(digitador.status, 201)
  assert.equal((await doc(t, types.out, wh.a, [{ itemId: x, quantity: '5' }], { allowNegative: true })).status, 201)
})

test('void reverses stock, cost and entry; voiding an entrada already consumed is blocked', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  const buy = await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '5', unitCost: '2.00' }])
  const sale = await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '4' }])
  assert.equal((await post(t, `/documents/${buy.id}/void`, { reason: 'error' })).json.code, 'insufficient_stock')
  const voided = await post(t, `/documents/${sale.id}/void`, { reason: 'Digitado dos veces' })
  assert.equal(voided.status, 200)
  assert.equal(voided.json.status, 'anulado')
  assert.deepEqual(costState(t, x), { quantity: '5.00000', value: '10.00', avg: '2.00000' })
  const e = t.sqlite.prepare('select is_active from gl_journal_entries where id = ?').get(sale.entry.entryId) as { is_active: number }
  assert.equal(e.is_active, 0)
  assert.equal((await post(t, `/documents/${sale.id}/void`, { reason: 'otra vez' })).json.code, 'already_voided')
  const k = (await get(t, `/reports/kardex?itemId=${x}&from=2026-11-01&to=2026-11-30`)).json
  assert.equal(k.rows.length, 3)
  assert.equal(k.closing.quantity, '5.00000')
})

test('lots: required when the item tracks them, stock checked per lot', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group, { tracksLots: true })
  assert.equal((await doc(t, types.purchase, wh.a, [{ itemId: x, quantity: '1', unitCost: '1' }])).json.code, 'lot_required')
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '3', unitCost: '1', lotNo: 'L1', expiresOn: '2027-01-31' }])
  assert.equal((await doc(t, types.out, wh.a, [{ itemId: x, quantity: '1', lotNo: 'L2' }])).json.code, 'insufficient_stock')
  const out = await mkDoc(t, types.out, wh.a, [{ itemId: x, quantity: '1', lotNo: 'L1' }])
  // The salida shows the lot's expiry taken from the entrada.
  assert.equal((await get(t, `/documents/${out.id}`)).json.lines[0].expiresOn, '2027-01-31')
  const stock = (await get(t, '/reports/stock?at=2026-11-30&lots=1')).json
  assert.deepEqual(stock.map((r: any) => [r.lotNo, r.expiresOn, r.quantity]), [['L1', '2027-01-31', '2.00000']])
})

test('a closed inventory month blocks documents; missing accounts block posting', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  assert.equal((await post(t, '/periods/2026-10/close')).status, 200)
  assert.equal((await doc(t, types.purchase, wh.a, [{ itemId: x, quantity: '1', unitCost: '1' }], { date: '2026-10-05' })).json.code, 'period_closed')
  const bare = await item(t, 'P2', '')
  assert.equal((await doc(t, types.purchase, wh.a, [{ itemId: bare, quantity: '1', unitCost: '1' }])).json.code, 'item_account_missing')
  assert.equal(t.sqlite.prepare("select count(*) as n from inv_documents").get() && (t.sqlite.prepare('select count(*) as n from inv_documents').get() as { n: number }).n, 0)
})
