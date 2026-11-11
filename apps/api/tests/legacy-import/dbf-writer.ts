import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Tiny DBF writer for tests (dBase III / FoxPro layout, no memo).

export type FieldSpec = { name: string; type: 'C' | 'N' | 'D' | 'L'; length: number; decimals?: number }

// A cell: text for C, exact ASCII for N, 'YYYYMMDD' for D, boolean for L, null = blank.
export type Cell = string | boolean | Buffer | null
export type Row = { values: Cell[]; deleted?: boolean }

// cp850 bytes for the few accented letters the tests use.
export const CP850: Record<string, number> = { á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5 }

export function cp850(text: string): Buffer {
  return Buffer.from([...text].map((c) => CP850[c] ?? c.charCodeAt(0)))
}

function encodeCell(spec: FieldSpec, cell: Cell): Buffer {
  const out = Buffer.alloc(spec.length, 0x20)
  if (cell === null) return out
  if (spec.type === 'L') out[0] = (cell as boolean) ? 0x54 : 0x46
  else if (Buffer.isBuffer(cell)) cell.copy(out, 0, 0, spec.length)
  else if (spec.type === 'N') Buffer.from(String(cell), 'latin1').copy(out, spec.length - Math.min(spec.length, String(cell).length))
  else Buffer.from(String(cell), 'latin1').copy(out, 0, 0, spec.length)
  return out
}

// `languageDriver`: 0x03 = cp1252, 0x00 = unmarked.
export function writeDbf(file: string, fields: FieldSpec[], rows: Row[], languageDriver = 0x03): void {
  const recordLength = 1 + fields.reduce((n, f) => n + f.length, 0)
  const headerLength = 32 + 32 * fields.length + 1
  const header = Buffer.alloc(headerLength)
  header[0] = 0x03
  header.writeUInt32LE(rows.length, 4)
  header.writeUInt16LE(headerLength, 8)
  header.writeUInt16LE(recordLength, 10)
  header[29] = languageDriver
  fields.forEach((f, i) => {
    const d = 32 + 32 * i
    header.write(f.name.toUpperCase(), d, 'ascii')
    header[d + 11] = f.type.charCodeAt(0)
    header[d + 16] = f.length
    header[d + 17] = f.decimals ?? 0
  })
  header[headerLength - 1] = 0x0d
  const body = rows.map((r) =>
    Buffer.concat([Buffer.from([r.deleted ? 0x2a : 0x20]), ...fields.map((f, i) => encodeCell(f, r.values[i] ?? null))]),
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, Buffer.concat([header, ...body, Buffer.from([0x1a])]))
}
