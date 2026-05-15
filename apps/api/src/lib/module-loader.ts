import { Hono } from 'hono'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import path from 'path'
import { existsSync } from 'fs'
import type { ModuleManifest } from '@accounting/shared'
import { getDb } from '../db/client.js'
import { modules } from '../db/schema.js'

function getModulesDir(): string {
  // Tray app sets this when spawning the API. Dev fallback: two levels up from cwd.
  return (
    process.env.ACCOUNTING_MODULES_DIR ??
    path.join(process.cwd(), '..', '..', 'modules')
  )
}

function topoSort(manifests: ModuleManifest[]): ModuleManifest[] {
  const byId = new Map(manifests.map((m) => [m.id, m]))
  const sorted: ModuleManifest[] = []
  const visited = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    const m = byId.get(id)
    if (!m) return
    visited.add(id)
    for (const dep of m.dependsOn) visit(dep)
    sorted.push(m)
  }

  for (const m of manifests) visit(m.id)
  return sorted
}

export async function loadModules(app: Hono): Promise<void> {
  const db = getDb()
  const modulesDir = getModulesDir()

  const enabled = await db
    .select()
    .from(modules)
    .where(eq(modules.isEnabled, true))

  if (enabled.length === 0) return

  // Import all manifests first so we can sort by dependsOn
  const manifests = await Promise.all(
    enabled.map(async (mod) => {
      const manifestPath = path.join(modulesDir, mod.id, 'manifest.js')
      const { manifest } = (await import(manifestPath)) as { manifest: ModuleManifest }
      return manifest
    }),
  )

  const sorted = topoSort(manifests)

  for (const manifest of sorted) {
    const migrationsDir = path.join(modulesDir, manifest.id, 'migrations')
    if (existsSync(migrationsDir)) {
      migrate(db, { migrationsFolder: migrationsDir })
    }

    const router = (await manifest.router()) as Hono
    app.route(`/api/${manifest.id}`, router)
  }
}
