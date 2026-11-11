import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, accId, addUser, auditActions, entry, entryBody, entryType, get, newApp, post, put, type App } from './fixtures.js'

async function setup() {
  const t = await newApp()
  account(t, { code: '1101' })
  account(t, { code: '2101', type: 'pasivo' })
  const pd = await entryType(t)
  const bal = (n = '1.00') => [{ a: accId(t, '1101'), d: n }, { a: accId(t, '2101'), c: n }]
  return { t, pd, bal }
}

// Entry as another module or the importer would leave it.
function rawEntry(t: App, typeId: string, o: { id: string; source: string; status?: string; unbalanced?: boolean; debit?: string }) {
  const now = new Date().toISOString()
  t.sqlite
    .prepare(`insert into gl_journal_entries (id, empresa_id, period, entry_type_id, number, date, concept, status,
      imported_unbalanced, source, created_by, created_at, updated_at) values (?, ?, '2026-01', ?, ?, '2026-01-10', 'Externa', ?, ?, ?, 'u', ?, ?)`)
    .run(o.id, t.empresaId, typeId, `9${o.id.length}${Math.floor(Math.random() * 1e5)}`, o.status ?? 'aplicada',
      o.unbalanced ? 1 : 0, o.source, now, now)
  const ins = t.sqlite.prepare('insert into gl_journal_lines (id, entry_id, line_no, account_id, detail, debit, credit) values (?, ?, ?, ?, ?, ?, ?)')
  ins.run(`${o.id}-1`, o.id, 1, accId(t, '1101'), 'x', o.debit ?? '5.00', '0.00')
  ins.run(`${o.id}-2`, o.id, 2, accId(t, '2101'), 'x', '0.00', '5.00')
}

test('borrador → apply requires balance; unapply needs supervise', async () => {
  const { t, pd, bal } = await setup()
  const unbalanced = await entry(t, pd, '2026-01', [{ a: accId(t, '1101'), d: '3.00' }], { status: 'borrador' })
  const refused = await post(t, `/entries/${unbalanced.id}/apply`)
  assert.equal(refused.json.code, 'unbalanced')
  assert.equal(refused.json.difference, '3.00')

  const draft = await entry(t, pd, '2026-01', bal(), { status: 'borrador' })
  const applied = await post(t, `/entries/${draft.id}/apply`)
  assert.equal(applied.status, 200)
  assert.equal(applied.json.status, 'aplicada')
  assert.equal((await post(t, `/entries/${draft.id}/apply`)).json.code, 'entry_already_applied')

  addUser(t, 'dc')
  const dc = { role: 'digitador_consulta', userId: 'dc' }
  assert.equal((await post(t, `/entries/${draft.id}/unapply`, {}, dc)).status, 403)
  const back = await post(t, `/entries/${draft.id}/unapply`)
  assert.equal(back.json.status, 'borrador')
  assert.equal((await post(t, `/entries/${draft.id}/unapply`)).json.code, 'entry_not_applied')
  assert.deepEqual(auditActions(t, draft.id), ['crear', 'aplicar', 'desaplicar'])
})

test('editing: replaces header and lines, audited with the previous version', async () => {
  const { t, pd, bal } = await setup()
  const e = await entry(t, pd, '2026-01', bal())
  const res = await put(t, `/entries/${e.id}`, entryBody(pd, '2026-01', [...bal('2.00'), ...bal('3.00')], { concept: 'Nueva' }))
  assert.equal(res.status, 200)
  assert.equal(res.json.concept, 'Nueva')
  assert.equal(res.json.lines.length, 4)
  assert.deepEqual(res.json.totals, { debit: '5.00', credit: '5.00', difference: '0.00' })
  const unbalanced = await put(t, `/entries/${e.id}`, entryBody(pd, '2026-01', [{ a: accId(t, '1101'), d: '1.00' }]))
  assert.equal(unbalanced.json.code, 'unbalanced')
  const row = t.sqlite.prepare("select detail from core_audit_log where entity_id = ? and action = 'modificar'").get(e.id) as { detail: string }
  assert.equal(JSON.parse(row.detail).before.lines.length, 2)
  assert.equal((await put(t, '/entries/nope', entryBody(pd, '2026-01', bal()))).status, 404)
})

test('closed period blocks edit, apply, void and moving into it', async () => {
  const { t, pd, bal } = await setup()
  const applied = await entry(t, pd, '2026-01', bal())
  const other = await entry(t, pd, '2026-02', bal())
  await post(t, '/periods/2026-01/close')
  assert.equal((await put(t, `/entries/${applied.id}`, entryBody(pd, '2026-01', bal()))).json.code, 'period_closed')
  assert.equal((await post(t, `/entries/${applied.id}/void`)).json.code, 'period_closed')
  assert.equal((await post(t, `/entries/${applied.id}/unapply`)).json.code, 'period_closed')
  const move = await put(t, `/entries/${other.id}`, entryBody(pd, '2026-01', bal()))
  assert.equal(move.json.code, 'period_closed')
  const detail = await get(t, `/entries/${applied.id}`)
  assert.equal(detail.json.periodStatus, 'closed')
  assert.equal(detail.json.editable, false)
  await post(t, '/periods/2026-01/reopen')
  assert.equal((await get(t, `/entries/${applied.id}`)).json.editable, true)
})

test('void: soft delete, by source; other sources are not editable here', async () => {
  const { t, pd, bal } = await setup()
  const e = await entry(t, pd, '2026-01', bal())
  const voided = await post(t, `/entries/${e.id}/void`)
  assert.equal(voided.status, 200)
  assert.equal(voided.json.isActive, false)
  assert.equal(voided.json.editable, false)
  assert.equal((await post(t, `/entries/${e.id}/void`)).json.code, 'entry_voided')
  assert.equal((await put(t, `/entries/${e.id}`, entryBody(pd, '2026-01', bal()))).json.code, 'entry_voided')
  const n = t.sqlite.prepare('select count(*) as n from gl_journal_lines where entry_id = ?').get(e.id) as { n: number }
  assert.equal(n.n, 2) // never deleted

  rawEntry(t, pd, { id: 'bank', source: 'bancos' })
  rawEntry(t, pd, { id: 'iva', source: 'iva' })
  rawEntry(t, pd, { id: 'close', source: 'cierre' })
  const bank = await post(t, '/entries/bank/void')
  assert.equal(bank.json.code, 'entry_from_other_module')
  assert.match(bank.json.error, /Elimine desde el módulo de Bancos/)
  assert.equal((await post(t, '/entries/iva/void')).json.code, 'entry_from_other_module')
  for (const id of ['bank', 'iva', 'close']) {
    assert.equal((await put(t, `/entries/${id}`, entryBody(pd, '2026-01', bal()))).json.code, 'entry_not_editable', id)
  }
  addUser(t, 'dig')
  assert.equal((await post(t, '/entries/close/void', {}, { role: 'digitador', userId: 'dig' })).json.code, 'permission_denied')
  assert.equal((await post(t, '/entries/close/void')).status, 200)
})

test('imported entries are editable; the unbalanced flag clears only when it balances', async () => {
  const { t, pd, bal } = await setup()
  rawEntry(t, pd, { id: 'imp', source: 'importado', unbalanced: true, debit: '6.00' })
  const report = await get(t, '/entries/unbalanced?period=2026-01')
  assert.equal(report.json.length, 1)
  assert.equal(report.json[0].totals.difference, '1.00')

  const still = await put(t, '/entries/imp', entryBody(pd, '2026-01', [{ a: accId(t, '1101'), d: '7.00' }, { a: accId(t, '2101'), c: '5.00' }]))
  assert.equal(still.status, 200)
  assert.equal(still.json.importedUnbalanced, true)
  const fixed = await put(t, '/entries/imp', entryBody(pd, '2026-01', bal('5.00')))
  assert.equal(fixed.json.importedUnbalanced, false)
  assert.equal(fixed.json.source, 'importado')
  assert.equal((await get(t, '/entries/unbalanced')).json.length, 0)
  // Once balanced, it follows the normal rule.
  const again = await put(t, '/entries/imp', entryBody(pd, '2026-01', [{ a: accId(t, '1101'), d: '7.00' }]))
  assert.equal(again.json.code, 'unbalanced')
})

test('copy creates a draft in the target period with the same lines', async () => {
  const { t, pd, bal } = await setup()
  const e = await entry(t, pd, '2026-01', bal('12.34'))
  const copy = await post(t, `/entries/${e.id}/copy`, { period: '2026-05', date: '2026-05-02' })
  assert.equal(copy.status, 201)
  assert.equal(copy.json.status, 'borrador')
  assert.equal(copy.json.period, '2026-05')
  assert.equal(copy.json.number, '000001')
  assert.deepEqual(copy.json.lines.map((l: { debit: string }) => l.debit), ['12.34', '0.00'])
  assert.equal((await post(t, `/entries/${e.id}/copy`, { period: '2026-05', date: '2026-06-02' })).json.code, 'wrong_month')
  assert.deepEqual(auditActions(t, copy.json.id), ['copiar'])
})

test('list, detail and Anterior / Siguiente navigation', async () => {
  const { t, pd, bal } = await setup()
  const cp = await entryType(t, 'CP')
  const p2 = await entry(t, pd, '2026-01', bal(), { concept: 'Pago luz' })
  const c1 = await entry(t, cp, '2026-01', bal())
  const p1 = await entry(t, pd, '2026-01', bal(), { number: '1', status: 'borrador' })
  const p3 = await entry(t, pd, '2026-01', bal())
  await post(t, `/entries/${p3.id}/void`)

  const list = await get(t, '/entries?period=2026-01')
  // Ordered by type code, then number; '1' was taken by p2, so p1 got 000002.
  assert.deepEqual(list.json.map((e: { id: string }) => e.id), [c1.id, p2.id, p1.id])
  assert.equal(p1.number, '000002')
  const all = await get(t, '/entries?period=2026-01&includeVoided=true')
  assert.equal(all.json.length, 4)
  assert.equal((await get(t, '/entries?period=2026-01&status=borrador')).json.length, 1)
  assert.equal((await get(t, `/entries?period=2026-01&entryTypeId=${cp}`)).json.length, 1)
  assert.deepEqual((await get(t, '/entries?period=2026-01&q=luz')).json.map((e: { id: string }) => e.id), [p2.id])
  assert.equal(list.json[0].totals.debit, '1.00')
  assert.equal(list.json[0].entryTypeCode, 'CP')

  const first = await get(t, `/entries/${c1.id}`)
  assert.equal(first.json.prevId, null)
  assert.equal(first.json.nextId, p2.id)
  assert.equal(first.json.lines[0].accountCode, '1101')
  assert.equal(first.json.lines[0].accountName, 'Cuenta 1101')
  const last = await get(t, `/entries/${p1.id}`)
  assert.equal(last.json.nextId, null)
  assert.equal(last.json.prevId, p2.id)
  assert.equal((await get(t, '/entries')).status, 400)
})
