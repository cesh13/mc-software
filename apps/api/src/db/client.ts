import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
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
  const dbPath = path.join(getDataDir(), 'accounting.db')

  const sqlite = new Database(dbPath)

  // Encrypt with SQLCipher AES-256
  sqlite.pragma(`key="${key}"`)
  sqlite.pragma('cipher=sqlcipher')

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
