import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Finding, InspectionResult, ModuleInspection, TableCheck } from '@accounting/shared'
import { MODULES, type ModuleSpec } from './modules.js'
import { readEmpresas, scanDbf } from './scan.js'

const ARCHIVE = /\.(rar|zip|7z)$/i

// Case-insensitive child lookup ('DBF' vs 'dbf', 'moviban.DBF').
function child(dir: string, name: string, kind: 'dir' | 'file'): string | null {
  if (!existsSync(dir)) return null
  const want = name.toLowerCase()
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.toLowerCase() === want && (kind === 'dir' ? e.isDirectory() : e.isFile())) return path.join(dir, e.name)
  }
  return null
}

function moduleDataDir(root: string, spec: ModuleSpec): string | null {
  for (const folder of spec.folders) {
    const base = child(root, folder, 'dir')
    if (!base) continue
    for (const sub of spec.dataDirs) {
      const dir = sub ? child(base, sub, 'dir') : base
      if (dir && readdirSync(dir).some((f) => f.toLowerCase().endsWith('.dbf'))) return dir
    }
  }
  return null
}

function inspectModule(root: string, spec: ModuleSpec): ModuleInspection {
  const dir = moduleDataDir(root, spec)
  const tables: TableCheck[] = spec.tables.map(({ name, required = false }) => {
    const file = dir ? child(dir, `${name}.dbf`, 'file') : null
    const empty: TableCheck = {
      table: name, required, found: false, file: null, records: 0, live: 0, deleted: 0,
      lastUpdate: null, encoding: null, dateRange: null,
    }
    if (!file) return empty
    try {
      const probe = spec.probe?.table === name ? spec.probe : undefined
      const s = scanDbf(file, probe)
      return { ...empty, found: true, file: path.relative(root, file), ...s }
    } catch {
      return { ...empty, found: true, file: path.relative(root, file), encoding: 'ilegible' }
    }
  })
  const probed = tables.find((t) => t.table === spec.probe?.table)
  return {
    id: spec.id, label: spec.label, folder: dir ? path.relative(root, dir) : null, tables,
    dateRange: probed?.dateRange ?? null, importer: spec.importer,
  }
}

function archives(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory() && depth < 3) walk(p, depth + 1)
      else if (e.isFile() && ARCHIVE.test(e.name)) out.push(path.relative(root, p))
    }
  }
  walk(root, 0)
  return out
}

const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7))

function copyFindings(modules: ModuleInspection[], arch: string[], empresas: InspectionResult['empresas']): Finding[] {
  const out: Finding[] = []
  const present = modules.filter((m) => m.folder)
  const missingReq = present.flatMap((m) => m.tables.filter((t) => t.required && !t.found).map((t) => `${m.id}/${t.table}`))
  if (missingReq.length) out.push({
    key: 'copia:tabla_obligatoria_faltante', severity: 'bloquea', title: 'Faltan tablas obligatorias', count: missingReq.length,
    samples: missingReq, recommendation: 'Pedir de nuevo la copia de esos módulos, completa.',
  })
  const ranges = present.filter((m) => m.dateRange).map((m) => ({ id: m.id, to: m.dateRange!.to }))
  if (ranges.length > 1) {
    const latest = ranges.reduce((a, b) => (a.to > b.to ? a : b))
    const behind = ranges.filter((r) => monthsBetween(r.to, latest.to) >= 3)
    if (behind.length) out.push({
      key: 'copia:fechas_distintas', severity: 'decidir', title: 'Los módulos terminan en fechas distintas',
      count: behind.length, samples: behind.map((r) => `${r.id} hasta ${r.to.slice(0, 7)} (el más reciente: ${latest.id} ${latest.to.slice(0, 7)})`),
      recommendation: 'Pedir una copia completa de un solo cliente y de una misma fecha; sin ella no hay paridad entre módulos.',
      questionRef: 'PREGUNTAS §2',
    })
  }
  const absent = modules.filter((m) => !m.folder).map((m) => m.id)
  if (absent.length) out.push({
    key: 'copia:modulo_ausente', severity: 'info', title: 'Módulos sin carpeta en la copia', count: absent.length, samples: absent,
    recommendation: 'Confirmar si el cliente usa esos módulos.',
  })
  if (arch.length) out.push({
    key: 'copia:archivo_comprimido', severity: 'info', title: 'Archivos comprimidos sin abrir', count: arch.length, samples: arch,
    recommendation: 'Abrirlos fuera del sistema y revisar si traen datos de otro cliente o de otra fecha.',
  })
  if (empresas.length <= 1) out.push({
    key: 'copia:una_empresa', severity: 'info', title: 'La copia trae una sola empresa', count: empresas.length,
    samples: empresas.map((e) => e.siglas),
    recommendation: 'Pedir la copia de al menos un cliente con varias empresas para probar ese caso.',
    questionRef: 'PREGUNTAS §2',
  })
  return out
}

// Read-only check of a legacy MCERP folder (docs/sistema/migracion.md, paso 1).
export function inspectLegacyRoot(root: string, now = new Date().toISOString()): InspectionResult {
  if (!path.isAbsolute(root)) throw new Error('Indique una ruta completa (por ejemplo D:\\MCERP).')
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`No existe la carpeta ${root}.`)
  const modules = MODULES.map((m) => inspectModule(root, m))
  const contac = child(root, 'CONTAC', 'dir')
  const empFile = contac
    ? ['fuente', 'dbf', ''].map((d) => (d ? child(contac, d, 'dir') : contac)).map((d) => d && child(d, 'empresas.dbf', 'file')).find(Boolean)
    : null
  let empresas: InspectionResult['empresas'] = []
  try {
    empresas = empFile ? readEmpresas(empFile) : []
  } catch {
    empresas = []
  }
  const arch = archives(root)
  return { root, inspectedAt: now, modules, archives: arch, empresas, findings: copyFindings(modules, arch, empresas) }
}
