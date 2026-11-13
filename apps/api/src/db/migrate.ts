import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from './client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function runPlatformMigrations() {
  const db = getDb()
  // The bundle ships migrations next to it and points here via the env var.
  const migrationsFolder =
    process.env.ACCOUNTING_PLATFORM_MIGRATIONS_DIR ?? path.join(__dirname, 'migrations')
  migrate(db, { migrationsFolder })
}
