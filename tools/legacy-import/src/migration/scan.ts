import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { decodeText, guessEncoding, isMarkedCp1252, type Encoding } from '../dbf/codepage.js'
import { parseHeader, type DbfField } from '../dbf/header.js'

// Header + streaming scan of a DBF: counts live/deleted records and, for one
// date field, the earliest and latest value. Never loads the whole file (some
// legacy tables are hundreds of MB) and never writes.

export type DbfScan = {
  records: number
  live: number
  deleted: number
  lastUpdate: string | null
  encoding: Encoding | 'sin_marcar'
  dateRange: { from: string; to: string } | null
}

const CHUNK_RECORDS = 4096
const pad = (n: number) => String(n).padStart(2, '0')

function headerDate(b: Buffer): string | null {
  const y = 1900 + b[1]!
  const m = b[2]!
  const d = b[3]!
  return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y < 1980 ? y + 100 : y}-${pad(m)}-${pad(d)}` : null
}

// Which field gives the movement date: the named one, else the first date field
// whose name looks like a date ("fec…", "f…"), else the first date field.
export function pickDateField(fields: DbfField[], wanted?: string): DbfField | undefined {
  if (wanted) return fields.find((f) => f.name === wanted.toLowerCase())
  const dates = fields.filter((f) => f.type === 'D')
  return dates.find((f) => f.name.includes('fec')) ?? dates.find((f) => f.name.startsWith('f')) ?? dates[0]
}

function dateOf(f: DbfField, raw: Buffer, salfec: boolean): string | null {
  const t = raw.toString('latin1').trim()
  if (salfec) return /^\d{6}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-01` : null
  if (f.type !== 'D' || !/^\d{8}$/.test(t)) return null
  const iso = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  return iso >= '1980-01-01' && iso <= '2100-12-31' ? iso : null
}

export function scanDbf(file: string, probe?: { field?: string; salfec?: boolean }): DbfScan {
  const fd = openSync(file, 'r')
  try {
    const size = fstatSync(fd).size
    const head = Buffer.alloc(Math.min(size, 65536))
    readSync(fd, head, 0, head.length, 0)
    const header = parseHeader(head)
    const { headerLength, recordLength } = header
    const records = recordLength > 0 ? Math.min(header.recordCount, Math.floor((size - headerLength) / recordLength)) : 0
    const field = probe ? pickDateField(header.fields, probe.field) : undefined
    const textFields = header.fields.filter((f) => f.type === 'C').slice(0, 8)
    const marked = isMarkedCp1252(header.languageDriver)
    const samples: Buffer[] = []
    let deleted = 0
    let from: string | null = null
    let to: string | null = null
    const buf = Buffer.alloc(recordLength * CHUNK_RECORDS)
    for (let start = 0; start < records; start += CHUNK_RECORDS) {
      const n = Math.min(CHUNK_RECORDS, records - start)
      readSync(fd, buf, 0, n * recordLength, headerLength + start * recordLength)
      for (let i = 0; i < n; i++) {
        const r = buf.subarray(i * recordLength, (i + 1) * recordLength)
        if (r[0] === 0x2a) { deleted++; continue }
        if (field) {
          const d = dateOf(field, r.subarray(field.offset, field.offset + field.length), probe?.salfec === true)
          if (d && (!from || d < from)) from = d
          if (d && (!to || d > to)) to = d
        }
        if (!marked && samples.length < 2000) for (const f of textFields) samples.push(r.subarray(f.offset, f.offset + f.length))
      }
    }
    const encoding = marked ? 'cp1252' : samples.length ? guessEncoding(samples.map((s) => Buffer.from(s))) : 'sin_marcar'
    return {
      records, live: records - deleted, deleted, lastUpdate: headerDate(head), encoding,
      dateRange: from && to ? { from, to } : null,
    }
  } finally {
    closeSync(fd)
  }
}

// EMPRESAS (siglas + name), small: read with the same streaming loop.
export function readEmpresas(file: string): { siglas: string; name: string }[] {
  const fd = openSync(file, 'r')
  try {
    const size = fstatSync(fd).size
    const data = Buffer.alloc(size)
    readSync(fd, data, 0, size, 0)
    const h = parseHeader(data)
    const sig = h.fields.find((f) => f.name === 'siglas')
    const name = h.fields.find((f) => f.name === 'empresa')
    if (!sig) return []
    const out: { siglas: string; name: string }[] = []
    for (let i = 0; i < h.recordCount; i++) {
      const r = data.subarray(h.headerLength + i * h.recordLength, h.headerLength + (i + 1) * h.recordLength)
      if (r.length < h.recordLength || r[0] === 0x2a) continue
      const text = (f: DbfField) => decodeText(r.subarray(f.offset, f.offset + f.length), 'cp1252').trim()
      out.push({ siglas: text(sig), name: name ? text(name) : '' })
    }
    return out
  } finally {
    closeSync(fd)
  }
}
