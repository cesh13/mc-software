import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'fs'
import path from 'path'
import { getCipherKey } from './cipher.js'
import * as schema from './schema.js'

let _db: ReturnType<typeof drizzle> | null = null

function getDataDir(): string {
  // Tray app sets this when spawning the API process.
  // Falls back to cwd for dev (tsx watch src/index.ts).
  return process.env.ACCOUNTING_DATA_DIR ?? process.cwd()
}

export async function openDatabase() {
  if (_db) return _db

  const key = await getCipherKey()
  const dataDir = getDataDir()
  mkdirSync(dataDir, { recursive: true })
  const dbPath = path.join(dataDir, 'accounting.db')

  const sqlite = new Database(dbPath)

  // SQLCipher: cipher config must come before key.
  // better-sqlite3-multiple-ciphers defaults to sqlcipher4 — this is explicit.
  sqlite.pragma("cipher = 'sqlcipher'")
  sqlite.pragma(`key = "${key}"`)

  // Performance + safety settings
  sqlite.pragma('journal_mode=WAL')
  sqlite.pragma('foreign_keys=ON')
  sqlite.pragma('busy_timeout=5000')

  _db = drizzle(sqlite, { schema })
  return _db
}

export function getDb() {
  if (!_db) throw new Error('Database not open — call openDatabase() first')
  return _db
}
