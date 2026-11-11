// Minimal surface of a better-sqlite3 handle; the importer never imports the driver.
export interface SqlStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqlHandle {
  prepare(sql: string): SqlStatement
  exec(sql: string): unknown
  transaction<T>(fn: () => T): () => T
}

export type ImportOptions = {
  // Folder holding `dbf/` and `fuente/` (e.g. MCERP/CONTAC).
  sourceDir: string
  // Value for `created_by` and the audit row.
  userId?: string
  // Wipe this empresa's previous import first.
  replace?: boolean
  // Which empresa owns the ledger when EMPRESAS lists several live ones.
  siglas?: string
  // Fixed clock for tests.
  now?: string
}

export type WarningBucket = { count: number; messages: string[] }

export type CatalogFinding = {
  code: string
  kind:
    | 'padre_inexistente'
    | 'padre_es_detalle'
    | 'tipo_distinto_al_padre'
    | 'nivel_incorrecto'
    | 'tipo_invalido'
    | 'codigo_duplicado'
    | 'ciclo'
  detail: string
}

export type SourceTableInfo = {
  records: number
  live: number
  deleted: number
  encoding: string
  encodingReason: string
}

export type ImportReport = {
  empresa: { id: string; siglas: string; created: boolean; replaced: boolean }
  empresas: { siglas: string; withData: boolean }[]
  counts: Record<string, number>
  source: Record<string, SourceTableInfo>
  warnings: Record<string, WarningBucket>
  unbalancedEntries: { key: string; difference: string }[]
  orphanHeaders: { key: string; lines: number }[]
  placeholders: {
    accounts: string[]
    entryTypes: string[]
    costCenters: string[]
    budgetGroups: string[]
  }
  catalogFindings: CatalogFinding[]
  periods: { closed: number; open: number; mixed: string[] }
  budgets: { rowsRead: number; rowsImported: number; rowsSkipped: number; monthsImported: number }
}

export function newReport(): ImportReport {
  return {
    empresa: { id: '', siglas: '', created: false, replaced: false },
    empresas: [],
    counts: {},
    source: {},
    warnings: {},
    unbalancedEntries: [],
    orphanHeaders: [],
    placeholders: { accounts: [], entryTypes: [], costCenters: [], budgetGroups: [] },
    catalogFindings: [],
    periods: { closed: 0, open: 0, mixed: [] },
    budgets: { rowsRead: 0, rowsImported: 0, rowsSkipped: 0, monthsImported: 0 },
  }
}

export function warn(report: ImportReport, category: string, message: string): void {
  const bucket = (report.warnings[category] ??= { count: 0, messages: [] })
  bucket.count++
  if (bucket.messages.length < 20) bucket.messages.push(message)
}

export function bump(report: ImportReport, table: string, n = 1): void {
  report.counts[table] = (report.counts[table] ?? 0) + n
}
