import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Finding, ImporterInfo, ImporterResult } from '@accounting/shared'
import { importContac } from '../contac/import.js'
import { ImportRefusedError } from '../contac/empresa.js'
import { checkContacParity } from '../contac/parity.js'
import type { SqlHandle } from '../contac/types.js'
import { importParties } from '../parties/import.js'
import { contacFindings, partiesFindings } from './findings.js'

export type RunOptions = { root: string; siglas?: string; replace?: boolean; userId?: string; now?: string }

// What one importer needs to run from the migration screen. New modules add
// an entry here; the screen lists whatever is registered.
export type LegacyImporter = ImporterInfo & {
  // `siglas`: empresa the importer worked on, handed to the importers that follow.
  run(db: SqlHandle, opts: RunOptions, previous: Map<string, ImporterResult>): { counts: Record<string, number>; findings: Finding[]; siglas?: string }
}

function childDir(root: string, name: string): string {
  const hit = existsSync(root)
    ? readdirSync(root, { withFileTypes: true }).find((e) => e.isDirectory() && e.name.toLowerCase() === name.toLowerCase())
    : undefined
  if (!hit) throw new Error(`No se encontró la carpeta ${name} en ${root}.`)
  return path.join(root, hit.name)
}

const refused = (err: unknown, key: string): Finding | null =>
  err instanceof ImportRefusedError
    ? {
        key, severity: 'bloquea', title: 'La empresa ya tiene datos importados', count: 1, samples: [err.message],
        recommendation: 'Para repetir la importación marque "Reemplazar la importación anterior".',
      }
    : null

export const IMPORTERS: LegacyImporter[] = [
  {
    id: 'contac', label: 'Contabilidad', dependsOn: [], modules: ['CONTAC'],
    run(db, opts) {
      const sourceDir = childDir(opts.root, 'CONTAC')
      try {
        const report = importContac(db, { sourceDir, siglas: opts.siglas, replace: opts.replace, userId: opts.userId, now: opts.now })
        const parity = checkContacParity(db, sourceDir, report.empresa.id)
        return {
          counts: { ...report.counts, empresa_creada: report.empresa.created ? 1 : 0 },
          findings: contacFindings(report, parity), siglas: report.empresa.siglas,
        }
      } catch (err) {
        const f = refused(err, 'contac:ya_importado')
        if (f) return { counts: {}, findings: [f] }
        throw err
      }
    },
  },
  {
    id: 'parties', label: 'Clientes y proveedores', dependsOn: ['contac'], modules: ['CONTAC', 'cxc64', 'INV64', 'IVA64'],
    run(db, opts) {
      const report = importParties(db, { sourceRoot: opts.root, siglas: opts.siglas, replace: opts.replace, userId: opts.userId, now: opts.now })
      return {
        counts: { filas_leidas: report.rowsRead, ya_importadas: report.rowsAlreadyImported, ...report.counts, uniones: report.mergesSummary.total },
        findings: partiesFindings(report),
      }
    },
  },
]

export function importerInfo(): ImporterInfo[] {
  return IMPORTERS.map(({ id, label, dependsOn, modules }) => ({ id, label, dependsOn, modules }))
}

// Runs the chosen importers in dependency order. One failing importer stops the
// ones that depend on it; the others still run.
export function runImporters(db: SqlHandle, ids: string[], opts: RunOptions): ImporterResult[] {
  const chosen = IMPORTERS.filter((i) => ids.includes(i.id))
  const unknown = ids.filter((id) => !IMPORTERS.some((i) => i.id === id))
  if (unknown.length) throw new Error(`Importador desconocido: ${unknown.join(', ')}.`)
  const done = new Map<string, ImporterResult>()
  let siglas = opts.siglas
  for (const imp of chosen) {
    const t0 = Date.now()
    const blocked = imp.dependsOn.filter((d) => ids.includes(d) && !done.get(d)?.ok)
    if (blocked.length) {
      const names = blocked.map((d) => IMPORTERS.find((i) => i.id === d)?.label ?? d).join(', ')
      const why = blocked.some((d) => done.get(d)?.error) ? 'falló' : 'tiene hallazgos que bloquean'
      done.set(imp.id, { importer: imp.id, ok: false, error: `No se corrió: ${names} ${why}.`, counts: {}, findings: [], durationMs: 0 })
      continue
    }
    try {
      const { siglas: used, ...r } = imp.run(db, { ...opts, siglas }, done)
      siglas ??= used
      const ok = !r.findings.some((f) => f.severity === 'bloquea')
      done.set(imp.id, { importer: imp.id, ok, error: null, ...r, durationMs: Date.now() - t0 })
    } catch (err) {
      done.set(imp.id, { importer: imp.id, ok: false, error: (err as Error).message, counts: {}, findings: [], durationMs: Date.now() - t0 })
    }
  }
  return [...done.values()]
}
