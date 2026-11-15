import Database from 'better-sqlite3-multiple-ciphers'
import { eq } from 'drizzle-orm'
import { inspectLegacyRoot, runImporters, type SqlHandle } from '@accounting/legacy-import'
import type { InspectionResult } from '@accounting/shared'
import { nowIso, type Db } from '@accounting/shared/server'
import { coreMigrationRuns as runs } from '../db/schema.js'

type RawDb = { serialize(): Buffer }

// In-memory copy of the real database: serialize() returns the decrypted pages
// (WAL included); the copy lives only in this process and is dropped after use.
export function memoryCopy(db: Db): Database.Database {
  const raw = (db as unknown as { $client: RawDb }).$client
  const buf = raw.serialize()
  // A WAL-mode header (bytes 18-19 = 2) cannot be opened from memory.
  buf[18] = 1
  buf[19] = 1
  const copy = new Database(buf)
  copy.pragma('foreign_keys=ON')
  return copy
}

export type TrialRequest = { id: string; root: string; importers: string[]; siglas?: string; replace?: boolean; userId: string }

// Runs a trial import on a copy and stores the outcome in core_migration_runs.
// Never writes to the real database except the run row itself.
export function executeTrial(db: Db, req: TrialRequest): void {
  let inspection: InspectionResult | null = null
  try {
    inspection = inspectLegacyRoot(req.root)
    const copy = memoryCopy(db)
    try {
      const results = runImporters(copy as unknown as SqlHandle, req.importers, {
        root: req.root, siglas: req.siglas, replace: req.replace, userId: req.userId,
      })
      // The run-level message is the first importer that really failed, else the first one blocked.
      const failed = results.find((r) => r.error && !r.error.startsWith('No se corrió')) ?? results.find((r) => r.error)
      db.update(runs).set({
        status: failed ? 'failed' : 'ok', finishedAt: nowIso(), error: failed ? `${failed.importer}: ${failed.error}` : null,
        inspection: JSON.stringify(inspection), results: JSON.stringify(results),
      }).where(eq(runs.id, req.id)).run()
    } finally {
      copy.close()
    }
  } catch (err) {
    db.update(runs).set({
      status: 'failed', finishedAt: nowIso(), error: (err as Error).message,
      inspection: inspection ? JSON.stringify(inspection) : null, results: '[]',
    }).where(eq(runs.id, req.id)).run()
  }
}
