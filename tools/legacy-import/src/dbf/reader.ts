import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { decodeText, guessEncoding, isMarkedCp1252, type Encoding } from './codepage.js'
import { parseHeader, type DbfField, type DbfHeader } from './header.js'

// C → string · N/F → exact ASCII text (string) · D → 'AAAA-MM-DD' · L → boolean
// I → number · Y → decimal string (4 places) · T → ISO date-time · M → null (memo not supported)
export type DbfValue = string | number | boolean | null

export type DbfRecord = {
  recno: number // 1-based position in the file, deleted records included
  deleted: boolean
  values: Record<string, DbfValue> // keys are lower-cased field names
}

export type DbfTable = {
  path: string
  fields: DbfField[]
  header: DbfHeader
  encoding: Encoding
  encodingReason: 'marked' | 'guessed'
  // Total physical records, deleted ones included.
  recordCount: number
  records(opts?: { includeDeleted?: boolean }): Generator<DbfRecord>
}

// Case-insensitive lookup: 'CATALOGO.DBF' may be stored as 'catalogo.dbf'.
export function findFile(dir: string, name: string): string | null {
  const wanted = name.toLowerCase()
  const hit = readdirSync(dir).find((f) => f.toLowerCase() === wanted)
  return hit ? path.join(dir, hit) : null
}

const isoDate = (y: string, m: string, d: string): string | null => {
  const iso = `${y}-${m}-${d}`
  const dt = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null
}

function trimNumeric(raw: Buffer): string | null {
  const text = raw.toString('latin1').replace(/\0/g, ' ').trim()
  return text === '' ? null : text
}

function readDate(raw: Buffer): string | null {
  const t = raw.toString('latin1')
  return /^\d{8}$/.test(t) ? isoDate(t.slice(0, 4), t.slice(4, 6), t.slice(6, 8)) : null
}

// Julian day number (VFP datetime) → ISO date.
function readDateTime(raw: Buffer): string | null {
  const day = raw.readInt32LE(0)
  const ms = raw.readInt32LE(4)
  if (day === 0) return null
  const dt = new Date((day - 2440588) * 86400000 + ms)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 19)
}

function readDecimal4(raw: Buffer): string {
  const neg = raw.readBigInt64LE(0) < 0n
  const abs = (neg ? -raw.readBigInt64LE(0) : raw.readBigInt64LE(0)).toString().padStart(5, '0')
  return `${neg ? '-' : ''}${abs.slice(0, -4)}.${abs.slice(-4)}`
}

function readValue(f: DbfField, raw: Buffer, encoding: Encoding): DbfValue {
  switch (f.type) {
    case 'C':
      return decodeText(raw, encoding).replace(/[\0\s]+$/, '')
    case 'N':
    case 'F':
      return trimNumeric(raw)
    case 'D':
      return readDate(raw)
    case 'L': {
      const c = String.fromCharCode(raw[0] ?? 0x20).toUpperCase()
      return 'TY'.includes(c) ? true : 'FN'.includes(c) ? false : null
    }
    case 'I':
      return raw.readInt32LE(0)
    case 'Y':
      return readDecimal4(raw)
    case 'B':
      return raw.readDoubleLE(0)
    case 'T':
      return readDateTime(raw)
    default:
      return null // M, G, W and anything else: memo files are not read
  }
}

export function openDbf(file: string, forced?: Encoding): DbfTable {
  const data = readFileSync(file)
  const header = parseHeader(data)
  const { fields, headerLength, recordLength } = header
  // A truncated file may declare more records than it holds.
  const recordCount = Math.min(header.recordCount, Math.floor((data.length - headerLength) / recordLength))
  const slice = (i: number) => data.subarray(headerLength + i * recordLength, headerLength + (i + 1) * recordLength)

  let encoding: Encoding = 'cp1252'
  let encodingReason: DbfTable['encodingReason'] = 'marked'
  if (forced) {
    encoding = forced
  } else if (!isMarkedCp1252(header.languageDriver)) {
    const textFields = fields.filter((f) => f.type === 'C')
    const samples: Buffer[] = []
    for (let i = 0; i < recordCount; i++) {
      const r = slice(i)
      for (const f of textFields) samples.push(r.subarray(f.offset, f.offset + f.length))
    }
    encoding = guessEncoding(samples)
    encodingReason = 'guessed'
  }

  function* records(opts: { includeDeleted?: boolean } = {}): Generator<DbfRecord> {
    for (let i = 0; i < recordCount; i++) {
      const r = slice(i)
      const deleted = r[0] === 0x2a
      if (deleted && !opts.includeDeleted) continue
      const values: Record<string, DbfValue> = {}
      for (const f of fields) values[f.name] = readValue(f, r.subarray(f.offset, f.offset + f.length), encoding)
      yield { recno: i + 1, deleted, values }
    }
  }

  return { path: file, fields, header, encoding, encodingReason, recordCount, records }
}
