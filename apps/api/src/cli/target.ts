import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SqlHandle } from '@accounting/legacy-import'
import type { Db } from '@accounting/shared/server'
import { migrateModule } from '../lib/module-loader.js'

const here = path.dirname(fileURLToPath(import.meta.url))

function runMigrations(db: Db, modules: string[]): void {
  migrate(db as never, { migrationsFolder: path.join(here, '..', 'db', 'migrations') })
  const modulesDir = process.env.ACCOUNTING_MODULES_DIR ?? path.join(here, '..', '..', '..', '..', 'modules')
  for (const id of modules) migrateModule(db, modulesDir, id)
}

// Opens the database an importer writes to, with platform and module migrations applied.
// `dbFile` = plain SQLite file; without it, the encrypted platform database.
export async function openTarget(dbFile: string | undefined, modules: string[]): Promise<SqlHandle> {
  if (dbFile) {
    mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true })
    const raw = new Database(dbFile)
    raw.pragma('foreign_keys=ON')
    runMigrations(drizzle(raw) as unknown as Db, modules)
    return raw as unknown as SqlHandle
  }
  // Encrypted platform database (key from the OS keychain).
  const { openDatabase } = await import('../db/client.js')
  const db = await openDatabase()
  runMigrations(db as unknown as Db, modules)
  return (db as unknown as { $client: SqlHandle }).$client
}
