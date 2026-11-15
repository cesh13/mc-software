// Migration screen contracts (docs/sistema/migracion.md). Browser-safe.
import { z } from 'zod'

export const FINDING_SEVERITIES = ['bloquea', 'decidir', 'info'] as const
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

// A standard finding produced by an inspection or an importer.
export type Finding = {
  // Stable key: '<importer or "copia">:<code>' — decisions are stored by it.
  key: string
  severity: FindingSeverity
  title: string            // Spanish, one line
  count: number
  samples: string[]        // keys only (codes, periods, NRC), never full rows
  recommendation: string   // Spanish: what we propose to do
  questionRef?: string     // e.g. 'P15', 'M3', 'CONTAC 1'
}

export type TableCheck = {
  table: string            // upper-case legacy name, e.g. 'PARTIDAS'
  required: boolean
  found: boolean
  file: string | null      // path relative to the root
  records: number          // physical, deleted included
  live: number
  deleted: number
  lastUpdate: string | null   // AAAA-MM-DD from the DBF header
  encoding: string | null
  dateRange: { from: string; to: string } | null   // of its movement dates, when probed
}

export type ModuleInspection = {
  id: string               // 'CONTAC', 'BANCOC', 'cxc64'…
  label: string            // Spanish
  folder: string | null    // relative to the root
  tables: TableCheck[]
  dateRange: { from: string; to: string } | null
  importer: string | null  // registered importer that reads this module, if any
}

export type InspectionResult = {
  root: string
  inspectedAt: string
  modules: ModuleInspection[]
  archives: string[]       // .rar/.zip/.7z found under the root (relative)
  empresas: { siglas: string; name: string }[]
  findings: Finding[]
}

export type ImporterInfo = { id: string; label: string; dependsOn: string[]; modules: string[] }

export const MIGRATION_RUN_STATUSES = ['running', 'ok', 'failed'] as const
export type MigrationRunStatus = (typeof MIGRATION_RUN_STATUSES)[number]

export type ImporterResult = {
  importer: string
  ok: boolean
  error: string | null
  counts: Record<string, number>
  findings: Finding[]
  durationMs: number
}

export type MigrationRun = {
  id: string
  root: string
  importers: string[]
  options: { siglas?: string }
  status: MigrationRunStatus
  startedBy: string
  startedByName: string | null
  startedAt: string
  finishedAt: string | null
  error: string | null
  inspection: InspectionResult | null
  results: ImporterResult[]
}

export type MigrationRunSummary = Omit<MigrationRun, 'inspection' | 'results'> & {
  findings: Record<FindingSeverity, number>
}

export const FINDING_DECISIONS = ['aceptar', 'corregir', 'pendiente'] as const
export type FindingDecisionValue = (typeof FINDING_DECISIONS)[number]
export const FINDING_DECISION_LABELS: Record<FindingDecisionValue, string> = {
  aceptar: 'Aceptar tal cual',
  corregir: 'Corregir en el sistema anterior',
  pendiente: 'Pendiente con el negocio',
}

export type FindingDecision = {
  key: string
  decision: FindingDecisionValue
  note: string
  decidedBy: string
  decidedByName: string | null
  decidedAt: string
}

export const inspectInput = z.object({ root: z.string().trim().min(3, 'Indique la carpeta.') })
export const runInput = z.object({
  root: z.string().trim().min(3, 'Indique la carpeta.'),
  importers: z.array(z.string().min(1)).min(1, 'Elija al menos un importador.'),
  siglas: z.string().trim().min(1).optional(),
})
export const decisionInput = z.object({
  key: z.string().min(1),
  decision: z.enum(FINDING_DECISIONS),
  note: z.string().trim().max(500).default(''),
})
export type InspectInput = z.input<typeof inspectInput>
export type RunInput = z.input<typeof runInput>
export type DecisionInput = z.input<typeof decisionInput>
