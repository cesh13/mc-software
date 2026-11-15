import { existsSync } from 'node:fs'
import { normalizeDui, normalizeNit, normalizeNrc } from '@accounting/shared'
import { findFile } from '../dbf/index.js'
import { openTable, str, type Row } from '../contac/source.js'
import type { LegacyParty, PartiesImportReport } from './types.js'

export const NO_NAME ='(sin nombre en el sistema anterior)'
// Ministerio de Hacienda country code of El Salvador (CCCLI01.cod_pais).
const SV = '9300'

type Mapped = Omit<LegacyParty, 'ref' | 'priority'>
type Def = { module: string; table: string; key: string; map: (r: Row, ctx: MapCtx) => Mapped }
type MapCtx = { report: PartiesImportReport; where: string }

export function pwarn(report: PartiesImportReport, category: string, message: string): void {
  const bucket = (report.warnings[category] ??= { count: 0, messages: [] })
  bucket.count++
  if (bucket.messages.length < 20) bucket.messages.push(message)
}

const opt = (v: unknown): string | null => str(v) || null

// Loose check as in the API (digits, dashes; spaces tolerated in legacy data).
function taxId(ctx: MapCtx, label: string, raw: unknown, normalize: (v: string) => string | null): string | null {
  const text = str(raw)
  if (!text) return null
  if (!/^[0-9\s-]+$/.test(text)) {
    pwarn(ctx.report, `${label.toLowerCase()}_invalido`, `${label} con letras u otros signos en ${ctx.where}; se dejó vacío.`)
    return null
  }
  return normalize(text)
}

function base(ctx: MapCtx, r: Row, o: { name: unknown; nrc: unknown; nit: unknown; dui?: unknown }): Mapped {
  const name = str(o.name)
  if (!name) pwarn(ctx.report, 'sin_nombre', `Fila sin nombre en ${ctx.where}.`)
  return {
    code: null, isCustomer: false, isSupplier: false, isActive: true, master: false,
    name: name || NO_NAME, tradeName: null,
    nrc: taxId(ctx, 'NRC', o.nrc, normalizeNrc),
    nit: taxId(ctx, 'NIT', o.nit, normalizeNit),
    dui: taxId(ctx, 'DUI', o.dui, normalizeDui),
    passport: null, foreignId: null, isForeign: false,
    economicActivityCode: opt(r['act_eco']), email: opt(r['email']), phone: null, address: null,
    departmentCode: opt(r['fdep']), municipalityCode: opt(r['fmun']),
  }
}

const provedor = (r: Row, ctx: MapCtx): Mapped => ({
  ...base(ctx, r, { name: r['nombre'], nrc: r['registro'], nit: r['nit'], dui: str(r['dui']) || r['cedula'] }),
  code: opt(r['provedor']), isSupplier: true, master: true,
  phone: opt(r['telefono']), address: opt(r['direccion']),
  passport: opt(r['pasaporte']), foreignId: opt(r['otrodoc']),
})

// Name = razón social FRES, else FNCLI: the same rule IVA64 uses when it copies
// customers into its CLIENTES (iva64/business-rules.md, "sincroniza clientes").
const cccli01 = (r: Row, ctx: MapCtx): Mapped => {
  const name = str(r['fres']) || str(r['fncli']) || str(r['nsociedad']) || str(r['ncomercial'])
  const trade = [str(r['ncomercial']), str(r['fncli'])].find((n) => n && n !== name) ?? ''
  const pais = str(r['cod_pais'])
  return {
    ...base(ctx, r, { name, nrc: r['fregiva'], nit: r['fnit'], dui: r['cedula'] }),
    code: opt(r['fcta']), isCustomer: true, isActive: r['inactivo'] !== true, master: true,
    tradeName: trade && trade !== name ? trade : null,
    phone: opt(r['ftel']), address: opt(r['fdcli']),
    passport: opt(r['pasaporte']), foreignId: opt(r['otrodoc']),
    isForeign: pais !== '' && pais !== SV,
  }
}

// IVA books' masters (CONTRIBU = suppliers, CLIENTES = customers); key = NRC text.
const ivaMaster = (role: 'isCustomer' | 'isSupplier') => (r: Row, ctx: MapCtx): Mapped => ({
  ...base(ctx, r, { name: r['fnom'], nrc: r['fregi'], nit: r['fnit'], dui: r['dui'] }),
  [role]: true,
  phone: opt(r['ftel']), address: opt(r['fdirec']),
})

// Priority order = array order (most trusted first).
export const SOURCES: Def[] = [
  { module: 'cxc64', table: 'CCCLI01', key: 'fcta', map: cccli01 },
  { module: 'CONTAC', table: 'PROVEDOR', key: 'provedor', map: provedor },
  { module: 'IVA64', table: 'CONTRIBU', key: 'fregi', map: ivaMaster('isSupplier') },
  { module: 'IVA64', table: 'CLIENTES', key: 'fregi', map: ivaMaster('isCustomer') },
  { module: 'INV64', table: 'PROVEDOR', key: 'provedor', map: provedor },
  { module: 'INV64', table: 'CONTRIBU', key: 'fregi', map: ivaMaster('isSupplier') },
  { module: 'INV64', table: 'CLIENTES', key: 'fregi', map: ivaMaster('isCustomer') },
]

// Reads every source table under the MCERP root. Deleted DBF records are dropped.
// A missing table is reported and skipped; a missing root is an error.
export function loadParties(root: string, report: PartiesImportReport): LegacyParty[] {
  if (!existsSync(root)) throw new Error(`No existe la carpeta ${root}.`)
  const out: LegacyParty[] = []
  SOURCES.forEach((def, priority) => {
    const name = `${def.module.toUpperCase()}.${def.table}`
    const dir = findFile(root, def.module)
    const table = dir ? openTable(dir, def.table) : null
    if (!table) {
      report.missingSources.push(name)
      pwarn(report, 'tabla_faltante', `No se encontró ${def.module}/dbf/${def.table}.DBF; se importa sin ella.`)
      return
    }
    const seen = new Set<string>()
    let live = 0
    for (const rec of table.records()) {
      live++
      let key = str(rec.values[def.key])
      // Blank or repeated keys get the record number so every row stays traceable.
      if (!key || seen.has(key)) {
        pwarn(report, 'llave_repetida_o_vacia', `${name}: registro ${rec.recno} sin llave única; se usó #${rec.recno}.`)
        key = `${key}#${rec.recno}`
      }
      seen.add(key)
      const mapped = def.map(rec.values, { report, where: `${name} ${key}` })
      out.push({ ...mapped, ref: { table: name, key }, priority })
    }
    report.source[name] = {
      file: table.path, records: table.recordCount, live, deleted: table.recordCount - live,
      encoding: table.encoding, encodingReason: table.encodingReason,
    }
  })
  report.rowsRead = out.length
  return out
}
