import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUser } from '../general-ledger/fixtures.js'
import { get, item, mkDoc, patch, post, setup } from './helpers.js'

test('catalogs: unique codes, accounts must be detail and active, type rules', async () => {
  const { t, acc } = await setup()
  assert.equal((await post(t, '/warehouses', { code: '1', name: 'Otra' })).json.code, 'code_duplicate')
  assert.equal((await post(t, '/groups', { code: 'g2', name: 'X', inventoryAccountId: 'nope' })).json.code, 'account_invalid')
  const g2 = await post(t, '/groups', { code: 'g2', name: 'Repuestos', inventoryAccountId: acc.inventory })
  assert.equal(g2.json.code, 'G2')
  assert.equal((await post(t, '/movement-types', { code: 'XX', name: 'x', direction: 'out', kind: 'compra' })).json.code, 'type_invalid')
  assert.equal((await post(t, '/movement-types', { code: 'XY', name: 'x', direction: 'in', kind: 'transferencia' })).json.code, 'type_invalid')
  const list = await get(t, '/movement-types')
  assert.deepEqual(list.json.map((r: any) => r.code), ['EC', 'II', 'SA', 'SV', 'TR'])
})

test('items: lots and service flags lock after the first movement; search by code or name', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'abc-1', group)
  await item(t, 'S1', group, { isService: true, name: 'Servicio de instalación' })
  await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '1', unitCost: '1' }])
  assert.equal((await patch(t, `/items/${x}`, { tracksLots: true })).json.code, 'item_locked')
  assert.equal((await patch(t, `/items/${x}`, { name: 'Nuevo nombre' })).json.name, 'Nuevo nombre')
  assert.deepEqual((await get(t, '/items?q=instal')).json.map((r: any) => r.code), ['S1'])
  assert.equal((await get(t, '/items?q=ABC')).json[0].code, 'ABC-1')
  const svc = (await get(t, '/items?q=S1')).json[0].id
  const res = await post(t, '/documents', { typeId: types.purchase, date: '2026-11-10', warehouseId: wh.a, lines: [{ itemId: svc, quantity: '1', unitCost: '1' }] })
  assert.equal(res.json.code, 'item_service')
})

test('costs are hidden without inv.cost.view; valuation needs it', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  const d = await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '2', unitCost: '1.50' }])
  addUser(t, 's1')
  const asSup = { role: 'supervisor', userId: 's1' }
  const seen = await get(t, `/documents/${d.id}`, asSup)
  assert.equal(seen.json.lines[0].unitCost, '')
  assert.equal(seen.json.lines[0].quantity, '2.00000')
  assert.equal((await get(t, '/reports/valuation?at=2026-11-30', asSup)).status, 403)
  const v = (await get(t, '/reports/valuation?at=2026-11-30')).json
  assert.equal(v.total, '3.00')
  assert.deepEqual(v.byAccount.map((r: any) => [r.accountCode, r.value]), [['1104', '3.00']])
  assert.equal((await get(t, '/reports/valuation?at=2026-11-09')).json.total, '0.00')
})

test('digitador captures but cannot void, configure or import', async () => {
  const { t, wh, group, types } = await setup()
  addUser(t, 'd1')
  const as = { role: 'digitador', userId: 'd1' }
  const x = await item(t, 'P1', group)
  const d = await post(t, '/documents', { typeId: types.purchase, date: '2026-11-10', warehouseId: wh.a, lines: [{ itemId: x, quantity: '1', unitCost: '1' }] }, as)
  assert.equal(d.status, 201)
  assert.equal((await post(t, `/documents/${d.json.id}/void`, { reason: 'x' }, as)).status, 403)
  assert.equal((await post(t, '/warehouses', { code: '9', name: 'x' }, as)).status, 403)
  assert.equal((await post(t, '/imports/items', { rows: [{ code: 'A', name: 'A' }] }, as)).status, 403)
})

test('void in a closed month reverses today and keeps the month untouched', async () => {
  const { t, wh, group, types } = await setup()
  const x = await item(t, 'P1', group)
  const d = await mkDoc(t, types.purchase, wh.a, [{ itemId: x, quantity: '2', unitCost: '1' }], { date: '2025-01-15' })
  await post(t, '/periods/2025-01/close')
  const res = await post(t, `/documents/${d.id}/void`, { reason: 'Proveedor equivocado' })
  assert.equal(res.status, 200)
  const rev = t.sqlite.prepare('select date from inv_movements where reversal_of is not null').get() as { date: string }
  assert.notEqual(rev.date.slice(0, 7), '2025-01')
  const jan = (await get(t, `/reports/stock?at=2025-01-31`)).json
  assert.equal(jan[0].quantity, '2.00000')
})
