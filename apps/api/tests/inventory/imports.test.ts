import { test } from 'node:test'
import assert from 'node:assert/strict'
import { costState, get, post, setup, setSetting } from './helpers.js'

test('items import: dry run reports problems; the load is all or nothing; existing codes are updated', async () => {
  const { t } = await setup()
  const rows = [
    { code: 'A1', name: 'Uno', groupCode: 'g1' },
    { code: 'A2', name: 'Dos', groupCode: 'NOPE' },
    { code: 'a1', name: 'Repetido' },
  ]
  const dry = await post(t, '/imports/items', { rows, dryRun: true })
  assert.deepEqual(dry.json.problems.map((p: any) => p.row), [2, 3])
  const refused = await post(t, '/imports/items', { rows })
  assert.equal(refused.json.created, undefined)
  assert.equal((await get(t, '/items')).json.length, 0)
  const ok = await post(t, '/imports/items', { rows: [rows[0], { code: 'A2', name: 'Dos', unit: 'CAJA' }] })
  assert.deepEqual([ok.json.created, ok.json.updated], [2, 0])
  const again = await post(t, '/imports/items', { rows: [{ code: 'A2', name: 'Dos nuevo' }] })
  assert.deepEqual([again.json.created, again.json.updated], [0, 1])
  const a2 = (await get(t, '/items?q=A2')).json[0]
  assert.equal(a2.name, 'Dos nuevo')
  assert.equal(a2.unit, 'UNIDAD')
})

test('opening import: one document per warehouse, posted against the opening account', async () => {
  const { t, types } = await setup()
  await post(t, '/imports/items', { rows: [{ code: 'A1', name: 'Uno', groupCode: 'G1' }, { code: 'A2', name: 'Dos', groupCode: 'G1' }] })
  const rows = [
    { itemCode: 'A1', warehouseCode: '1', quantity: '1,000.5', unitCost: '2' },
    { itemCode: 'A2', warehouseCode: '2', quantity: '3', unitCost: '1,5' },
    { itemCode: 'A1', warehouseCode: '2', quantity: '1', unitCost: '2' },
  ]
  assert.equal((await post(t, '/imports/opening', { typeId: types.purchase, date: '2026-11-01', rows })).json.code, 'type_invalid')
  const bad = await post(t, '/imports/opening', { typeId: types.opening, date: '2026-11-01', rows: [...rows, { itemCode: 'ZZ', warehouseCode: '1', quantity: '1', unitCost: '1' }] })
  assert.deepEqual(bad.json.problems, [{ row: 4, message: 'El producto ZZ no existe.' }])
  await setSetting(t, 'postToGl', true)
  const res = await post(t, '/imports/opening', { typeId: types.opening, date: '2026-11-01', rows })
  assert.equal(res.json.created, 2)
  const a1 = (await get(t, '/items?q=A1')).json[0].id
  assert.deepEqual(costState(t, a1), { quantity: '1001.50000', value: '2003.00', avg: '2.00000' })
  const v = (await get(t, '/reports/valuation?at=2026-11-30')).json
  assert.equal(v.total, '2007.50')
  const credit = t.sqlite.prepare(`select sum(cast(l.credit as real)) as c from gl_journal_lines l join coa_accounts a on a.id = l.account_id where a.code = '3101'`).get() as { c: number }
  assert.equal(credit.c, 2007.5)
})
