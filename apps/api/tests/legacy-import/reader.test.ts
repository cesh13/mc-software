import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findFile, openDbf } from '@accounting/legacy-import'
import { cp850, writeDbf, type FieldSpec } from './dbf-writer.js'

const FIELDS: FieldSpec[] = [
  { name: 'texto', type: 'C', length: 20 },
  { name: 'monto', type: 'N', length: 12, decimals: 2 },
  { name: 'fecha', type: 'D', length: 8 },
  { name: 'activo', type: 'L', length: 1 },
]

function tmp(): string {
  return mkdtempSync(path.join(tmpdir(), 'dbf-test-'))
}

test('reads field types, deleted flag and exact numeric text', () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'Datos.DBF')
    writeDbf(file, FIELDS, [
      { values: ['uno', '123456789.10', '20240131', true] },
      { values: ['dos', '0.07', null, false], deleted: true },
      { values: ['tres', null, '20240230', null] }, // impossible date → null
    ])
    const t = openDbf(file)
    assert.equal(t.recordCount, 3)
    assert.deepEqual(t.fields.map((f) => f.name), ['texto', 'monto', 'fecha', 'activo'])
    const live = [...t.records()]
    assert.equal(live.length, 2)
    assert.equal(live[0]!.values['monto'], '123456789.10') // exact text, never a float
    assert.equal(live[0]!.values['fecha'], '2024-01-31')
    assert.equal(live[0]!.values['activo'], true)
    assert.equal(live[1]!.values['monto'], null)
    assert.equal(live[1]!.values['fecha'], null)
    assert.equal(live[1]!.recno, 3)
    const all = [...t.records({ includeDeleted: true })]
    assert.equal(all.length, 3)
    assert.equal(all[1]!.deleted, true)
    assert.equal(all[1]!.values['monto'], '0.07')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('decodes cp1252 when the table is marked 0x03', () => {
  const dir = tmp()
  try {
    const file = path.join(dir, 'a.dbf')
    writeDbf(file, FIELDS, [{ values: ['Año ñandú', '1', null, null] }], 0x03)
    const t = openDbf(file)
    assert.equal(t.encoding, 'cp1252')
    assert.equal(t.encodingReason, 'marked')
    assert.equal([...t.records()][0]!.values['texto'], 'Año ñandú')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('guesses cp850 for unmarked tables and cp1252 for unmarked latin text', () => {
  const dir = tmp()
  try {
    const dos = path.join(dir, 'dos.dbf')
    writeDbf(dos, FIELDS, [{ values: [cp850('camión y niño'), '1', null, null] }], 0x00)
    const t = openDbf(dos)
    assert.equal(t.encoding, 'cp850')
    assert.equal(t.encodingReason, 'guessed')
    assert.equal([...t.records()][0]!.values['texto'], 'camión y niño')

    const win = path.join(dir, 'win.dbf')
    writeDbf(win, FIELDS, [{ values: ['camión y niño', '1', null, null] }], 0x00)
    assert.equal(openDbf(win).encoding, 'cp1252')
    assert.equal([...openDbf(win).records()][0]!.values['texto'], 'camión y niño')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('finds files regardless of case', () => {
  const dir = tmp()
  try {
    writeDbf(path.join(dir, 'catalogo.dbf'), FIELDS, [])
    assert.ok(findFile(dir, 'CATALOGO.DBF'))
    assert.equal(findFile(dir, 'otro.dbf'), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
