import { and, eq } from 'drizzle-orm'
import type { ModuleManifest } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { coreEmpresaModules, modules } from '../db/schema.js'

// Loaded modules and the services they provide, built by loadModules.
export type ModuleCatalog = {
  manifests: ModuleManifest[]
  providerOf: (service: string) => string | undefined
}

// Modules active for an empresa: always-on ones, plus installed (globally
// enabled) ones switched on for that empresa.
export function activeModuleIds(db: Db, empresaId: string, catalog: ModuleCatalog): Set<string> {
  const ids = new Set(catalog.manifests.filter((m) => m.alwaysOn).map((m) => m.id))
  const installed = new Set(
    db.select({ id: modules.id }).from(modules).where(eq(modules.isEnabled, true)).all().map((r) => r.id),
  )
  const rows = db
    .select({ id: coreEmpresaModules.moduleId })
    .from(coreEmpresaModules)
    .where(and(eq(coreEmpresaModules.empresaId, empresaId), eq(coreEmpresaModules.isEnabled, true)))
    .all()
  for (const r of rows) if (installed.has(r.id)) ids.add(r.id)
  return ids
}

// Required services of `m` whose provider is not active (core providers count as active).
export function missingRequirements(m: ModuleManifest, active: ReadonlySet<string>, catalog: ModuleCatalog): string[] {
  return (m.consumes?.required ?? []).filter((s) => {
    const p = catalog.providerOf(s)
    return !p || (p !== 'core' && !active.has(p))
  })
}

// Active modules that require a service provided by `moduleId`.
export function dependents(moduleId: string, active: ReadonlySet<string>, catalog: ModuleCatalog): string[] {
  return catalog.manifests
    .filter((m) => m.id !== moduleId && active.has(m.id))
    .filter((m) => (m.consumes?.required ?? []).some((s) => catalog.providerOf(s) === moduleId))
    .map((m) => m.id)
}
