import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp } from '../../src/testing/test-app.js'
import { addEmpresa, get, mk, rawAccount } from './helpers.js'

type Finding = { code: string; issue: string; parentCode: string | null }

test('a clean chart has no findings', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  await mk(t, '1')
  await mk(t, '11', { parentCode: '1', isDetail: true })
  const res = await get(t, '/integrity')
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, { checkedAccounts: 2, findings: [] })
})

test('reports dirty imported data', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  // Parent exists in another empresa only → missing for this one.
  addEmpresa(t, 'e2', 'DOS')
  rawAccount(t, { id: 'foreign', code: 'F', empresaId: 'e2' })
  rawAccount(t, { id: 'orphan', code: 'ORF', parentId: 'foreign', level: 2 })

  rawAccount(t, { id: 'root', code: '1' })
  rawAccount(t, { id: 'det', code: '2', isDetail: true })
  rawAccount(t, { id: 'dead', code: '3', isActive: false })
  rawAccount(t, { id: 'c-detail', code: '2.1', parentId: 'det', level: 2 })
  rawAccount(t, { id: 'c-dead', code: '3.1', parentId: 'dead', level: 2 })
  rawAccount(t, { id: 'c-type', code: '1.1', parentId: 'root', level: 2, type: 'pasivo' })
  rawAccount(t, { id: 'c-level', code: '1.2', parentId: 'root', level: 5 })
  rawAccount(t, { id: 'root-lvl', code: '9', level: 3 })
  // Inactive accounts are not reported.
  rawAccount(t, { id: 'c-off', code: '1.3', parentId: 'root', level: 9, isActive: false })

  const res = await get(t, '/integrity')
  assert.equal(res.status, 200)
  const found = (res.json.findings as Finding[]).map((f) => `${f.code}:${f.issue}`).sort()
  assert.deepEqual(found, [
    '1.1:type_mismatch',
    '1.2:level_mismatch',
    '2.1:parent_is_detail',
    '3.1:parent_inactive',
    '9:level_mismatch',
    'ORF:parent_missing',
  ])
  assert.equal(res.json.checkedAccounts, 8)
  const detail = (res.json.findings as Finding[]).find((f) => f.code === '2.1')!
  assert.equal(detail.parentCode, '2')
})

test('multiple problems on one account are all listed', async () => {
  const t = await createTestApp({ modules: ['chart-of-accounts'] })
  rawAccount(t, { id: 'p', code: 'P', isDetail: true })
  rawAccount(t, { id: 'c', code: 'C', parentId: 'p', level: 7, type: 'gastos' })
  const issues = ((await get(t, '/integrity')).json.findings as Finding[]).map((f) => f.issue).sort()
  assert.deepEqual(issues, ['level_mismatch', 'parent_is_detail', 'type_mismatch'])
})
