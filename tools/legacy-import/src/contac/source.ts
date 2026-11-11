import { existsSync } from 'node:fs'
import path from 'node:path'
import { Decimal } from 'decimal.js'
import { findFile, openDbf, type DbfTable } from '../dbf/index.js'
import { warn, type ImportReport } from './types.js'

export type Row = Record<string, string | number | boolean | null>

export type LegacyTables = Record<string, Row[]>

const REQUIRED = ['catalogo', 'partidas', 'detapart']
const OPTIONAL = ['agrupa', 'tipopar', 'ccosto', 'periodo', 'presup']

export function dataDir(sourceDir: string): string {
  const dbf = path.join(sourceDir, 'dbf')
  return existsSync(dbf) ? dbf : sourceDir
}

// EMPRESAS lives in `fuente/` in the observed install, `dbf/` elsewhere.
export function openTable(sourceDir: string, name: string, extraDirs: string[] = []): DbfTable | null {
  const dirs = [dataDir(sourceDir), ...extraDirs.map((d) => path.join(sourceDir, d)), sourceDir]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    const file = findFile(dir, `${name}.dbf`)
    if (file) return openDbf(file)
  }
  return null
}

function load(report: ImportReport, name: string, table: DbfTable): Row[] {
  const rows: Row[] = []
  for (const r of table.records()) rows.push(r.values)
  report.source[name.toUpperCase()] = {
    records: table.recordCount,
    live: rows.length,
    deleted: table.recordCount - rows.length,
    encoding: table.encoding,
    encodingReason: table.encodingReason,
  }
  return rows
}

// Reads every CONTAC table the importer needs. Deleted records are dropped and counted.
export function loadSource(sourceDir: string, report: ImportReport): LegacyTables {
  const out: LegacyTables = {}
  for (const name of [...REQUIRED, ...OPTIONAL, 'empresas']) {
    const table = openTable(sourceDir, name, name === 'empresas' ? ['fuente'] : [])
    if (!table) {
      if (REQUIRED.includes(name)) {
        throw new Error(`No se encontró la tabla ${name.toUpperCase()}.DBF en ${sourceDir}.`)
      }
      warn(report, 'tabla_faltante', `No se encontró ${name.toUpperCase()}.DBF; se importa sin ella.`)
      out[name] = []
      continue
    }
    out[name] = load(report, name, table)
  }
  return out
}

// ── field helpers ──────────────────────────────────────────────────────────

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// DBF numeric text → '1234.50'. Never goes through a JS number.
export function money(report: ImportReport, raw: unknown, where: string): string {
  if (raw === null || raw === undefined || raw === '') return '0.00'
  try {
    return new Decimal(String(raw)).toFixed(2, Decimal.ROUND_HALF_UP)
  } catch {
    warn(report, 'monto_invalido', `Monto no numérico en ${where}; se usó 0.00.`)
    return '0.00'
  }
}

export const int = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}
