import { Hono } from 'hono'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import path from 'path'
import { existsSync, readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import type { ModuleManifest } from '@accounting/shared'
import { nowIso, type Db } from '@accounting/shared/server'
import { modules } from '../db/schema.js'
import { moduleContext, type PlatformDeps } from '../middleware/module-context.js'

export function getModulesDir(): string {
  // Tray app sets this when spawning the API. Dev fallback: two levels up from cwd.
  return process.env.ACCOUNTING_MODULES_DIR ?? path.join(process.cwd(), '..', '..', 'modules')
}

function manifestFile(dir: string): string | null {
  for (const name of ['manifest.js', 'manifest.ts']) {
    const file = path.join(dir, name)
    if (existsSync(file)) return file
  }
  return null
}

async function discoverManifests(modulesDir: string): Promise<ModuleManifest[]> {
  const found: ModuleManifest[] = []
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    const file = manifestFile(path.join(modulesDir, entry.name))
    if (!file) continue
    const { manifest } = (await import(pathToFileURL(file).href)) as { manifest: ModuleManifest }
    found.push(manifest)
  }
  return found
}

// Registers every module found on disk. Always-on modules are enabled.
function syncModulesTable(db: Db, manifests: ModuleManifest[]): void {
  for (const m of manifests) {
    const row = db.select().from(modules).where(eq(modules.id, m.id)).get()
    if (!row) {
      db.insert(modules)
        .values({
          id: m.id,
          name: m.name,
          version: m.version,
          isEnabled: m.alwaysOn,
          isAlwaysOn: m.alwaysOn,
          enabledAt: m.alwaysOn ? nowIso() : null,
          installedAt: nowIso(),
        })
        .run()
    } else if (row.version !== m.version || row.name !== m.name) {
      db.update(modules).set({ name: m.name, version: m.version }).where(eq(modules.id, m.id)).run()
    }
  }
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

export function migrateModule(db: Db, modulesDir: string, moduleId: string): void {
  const migrationsDir = path.join(modulesDir, moduleId, 'migrations')
  if (!existsSync(path.join(migrationsDir, 'meta', '_journal.json'))) return
  // Each module tracks its own migrations. With the shared default table,
  // drizzle skips any migration older than the newest one already applied,
  // so a module migration generated before a platform one would never run.
  migrate(db, {
    migrationsFolder: migrationsDir,
    migrationsTable: `__drizzle_migrations_${moduleId.replace(/-/g, '_')}`,
  })
}

export async function loadModules(
  app: Hono,
  deps: PlatformDeps,
  opts: { modulesDir?: string; only?: string[] } = {},
): Promise<string[]> {
  const db = deps.db()
  const modulesDir = opts.modulesDir ?? getModulesDir()

  const manifests = await discoverManifests(modulesDir)
  syncModulesTable(db, manifests)

  const enabledIds = new Set(
    db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.isEnabled, true))
      .all()
      .map((r) => r.id),
  )
  const wanted = manifests.filter(
    (m) => enabledIds.has(m.id) && (!opts.only || opts.only.includes(m.id)),
  )

  const loaded: string[] = []
  for (const manifest of topoSort(wanted)) {
    migrateModule(db, modulesDir, manifest.id)
    const router = (await manifest.router()) as Hono
    app.use(`/api/${manifest.id}/*`, moduleContext(deps))
    app.route(`/api/${manifest.id}`, router)
    loaded.push(manifest.id)
  }
  return loaded
}
