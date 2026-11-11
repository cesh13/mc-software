import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, entry, entryBody, entryType, get, newApp, post, put } from './fixtures.js'

async function setup() {
  const t = await newApp()
  account(t, { code: '1101' })
  account(t, { code: '2101', type: 'pasivo' })
  const lines = [{ a: accId(t, '1101'), d: '1.00' }, { a: accId(t, '2101'), c: '1.00' }]
  return { t, lines }
}

test('numbering is per type and per month, zero-padded to the type width', async () => {
  const { t, lines } = await setup()
  const pd = await entryType(t, 'PD', 6)
  const cp = await entryType(t, 'CP', 7)
  assert.equal((await entry(t, pd, '2026-01', lines)).number, '000001')
  assert.equal((await entry(t, pd, '2026-01', lines)).number, '000002')
  assert.equal((await entry(t, cp, '2026-01', lines)).number, '0000001')
  assert.equal((await entry(t, pd, '2026-02', lines)).number, '000001')
  const preview = await get(t, `/entries/next-number?period=2026-01&entryTypeId=${pd}`)
  assert.equal(preview.json.number, '000003')
  assert.equal((await get(t, `/entries/next-number?period=2026-05&entryTypeId=${cp}`)).json.number, '0000001')
})

test('voided numbers are never reused', async () => {
  const { t, lines } = await setup()
  const pd = await entryType(t)
  await entry(t, pd, '2026-01', lines)
  const second = await entry(t, pd, '2026-01', lines)
  assert.equal((await post(t, `/entries/${second.id}/void`)).status, 200)
  assert.equal((await entry(t, pd, '2026-01', lines)).number, '000003')
  // Requesting the voided number reassigns the next one.
  const asked = await entry(t, pd, '2026-01', lines, { number: '2' })
  assert.equal(asked.number, '000004')
  assert.equal(asked.numberReassigned, true)
})

test('client numbers: used when free, reassigned on collision', async () => {
  const { t, lines } = await setup()
  const pd = await entryType(t)
  const chosen = await entry(t, pd, '2026-01', lines, { number: '50' })
  assert.equal(chosen.number, '000050')
  assert.equal(chosen.numberReassigned, false)
  assert.equal((await entry(t, pd, '2026-01', lines)).number, '000051')
  // Two users got the same preview; the second save takes the next one.
  const preview = (await get(t, `/entries/next-number?period=2026-01&entryTypeId=${pd}`)).json.number
  const first = await entry(t, pd, '2026-01', lines, { number: preview })
  const second = await entry(t, pd, '2026-01', lines, { number: preview })
  assert.equal(first.number, '000052')
  assert.equal(second.number, '000053')
  assert.equal(second.numberReassigned, true)
  const unique = t.sqlite.prepare('select count(distinct number) as n, count(*) as c from gl_journal_entries').get() as { n: number; c: number }
  assert.equal(unique.n, unique.c)
})

test('updates keep the number; changing it checks it is free; moving reassigns', async () => {
  const { t, lines } = await setup()
  const pd = await entryType(t)
  const one = await entry(t, pd, '2026-01', lines)
  await entry(t, pd, '2026-01', lines)
  const same = await put(t, `/entries/${one.id}`, entryBody(pd, '2026-01', lines, { concept: 'Editada' }))
  assert.equal(same.status, 200)
  assert.equal(same.json.number, '000001')
  const taken = await put(t, `/entries/${one.id}`, entryBody(pd, '2026-01', lines, { number: '000002' }))
  assert.equal(taken.json.code, 'number_taken')
  const free = await put(t, `/entries/${one.id}`, entryBody(pd, '2026-01', lines, { number: '7' }))
  assert.equal(free.json.number, '000007')
  const moved = await put(t, `/entries/${one.id}`, entryBody(pd, '2026-03', lines, { date: '2026-03-01' }))
  assert.equal(moved.json.period, '2026-03')
  assert.equal(moved.json.number, '000007')
  await entry(t, pd, '2026-04', lines)
  const moved2 = await put(t, `/entries/${one.id}`, entryBody(pd, '2026-04', lines, { date: '2026-04-01', number: '1' }))
  assert.equal(moved2.json.number, '000002')
  assert.equal(moved2.json.numberReassigned, true)
})
