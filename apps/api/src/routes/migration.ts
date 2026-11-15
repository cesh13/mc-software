import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'
import { importerInfo, inspectLegacyRoot } from '@accounting/legacy-import'
import {
  can, decisionInput, inspectInput, runInput,
  type FindingDecision, type FindingSeverity, type ImporterResult, type MigrationRun, type MigrationRunSummary,
} from '@accounting/shared'
import { RuleError, newId, nowIso, type CurrentUser, type Db } from '@accounting/shared/server'
import { coreMigrationDecisions as dec, coreMigrationRuns as runs, user as userTable } from '../db/schema.js'
import { writeAudit } from '../lib/audit.js'
import { executeTrial } from '../lib/migration-run.js'
import { loadOverrides } from '../lib/permissions.js'
import type { PlatformDeps } from '../middleware/module-context.js'

type Env = { Variables: { user: CurrentUser } }
type RunRow = typeof runs.$inferSelect

const names = (db: Db) => new Map(db.select({ id: userTable.id, name: userTable.name }).from(userTable).all().map((u) => [u.id, u.name]))

function summary(r: RunRow, who: Map<string, string>): MigrationRunSummary {
  const results = JSON.parse(r.results ?? '[]') as ImporterResult[]
  const inspection = r.inspection ? (JSON.parse(r.inspection) as MigrationRun['inspection']) : null
  const findings: Record<FindingSeverity, number> = { bloquea: 0, decidir: 0, info: 0 }
  for (const f of [...(inspection?.findings ?? []), ...results.flatMap((x) => x.findings)]) findings[f.severity]++
  return {
    id: r.id, root: r.root, importers: JSON.parse(r.importers), options: JSON.parse(r.options), status: r.status,
    startedBy: r.startedBy, startedByName: who.get(r.startedBy) ?? null, startedAt: r.startedAt,
    finishedAt: r.finishedAt, error: r.error, findings,
  }
}

// Migration screen API (docs/sistema/migracion.md). Requires core.migration.run.
export function createMigrationRoute(deps: PlatformDeps) {
  const route = new Hono<Env>()

  route.use('*', async (c, next) => {
    const me = await deps.resolveUser(c.req.raw.headers)
    if (!me) return c.json({ error: 'No autorizado.' }, 401)
    if (!can(me.role, 'core.migration.run', { overrides: loadOverrides(deps.db(), me.id, null) })) {
      return c.json({ error: 'No tiene permiso para esta acción.', code: 'forbidden' }, 403)
    }
    c.set('user', me)
    await next()
  })

  route.get('/importers', (c) => c.json(importerInfo()))

  route.post('/inspect', async (c) => {
    const { root } = inspectInput.parse(await c.req.json())
    try {
      return c.json(inspectLegacyRoot(root))
    } catch (err) {
      throw new RuleError((err as Error).message, 400, 'invalid_root')
    }
  })

  route.post('/runs', async (c) => {
    const me = c.get('user')
    const input = runInput.parse(await c.req.json())
    const known = new Set(importerInfo().map((i) => i.id))
    const unknown = input.importers.filter((i) => !known.has(i))
    if (unknown.length) throw new RuleError(`Importador desconocido: ${unknown.join(', ')}.`, 400, 'unknown_importer')
    const db = deps.db()
    if (db.select({ id: runs.id }).from(runs).where(eq(runs.status, 'running')).get()) {
      throw new RuleError('Ya hay una prueba en curso; espere a que termine.', 409, 'run_in_progress')
    }
    const id = newId()
    const options = { siglas: input.siglas, replace: input.replace }
    db.transaction((tx) => {
      tx.insert(runs).values({
        id, root: input.root, importers: JSON.stringify(input.importers), options: JSON.stringify(options),
        status: 'running', startedBy: me.id, startedAt: nowIso(),
      }).run()
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: 'prueba-migracion', entity: 'migration_run', entityId: id,
        detail: { root: input.root, importers: input.importers, ...options },
      })
    })
    // The trial runs after the response; the screen polls GET /runs/:id.
    setImmediate(() => executeTrial(db, { id, root: input.root, importers: input.importers, ...options, userId: me.id }))
    return c.json(summary(db.select().from(runs).where(eq(runs.id, id)).get()!, names(db)), 202)
  })

  route.get('/runs', (c) => {
    const db = deps.db()
    const who = names(db)
    return c.json(db.select().from(runs).orderBy(desc(runs.startedAt)).limit(100).all().map((r) => summary(r, who)))
  })

  route.get('/runs/:id', (c) => {
    const db = deps.db()
    const r = db.select().from(runs).where(eq(runs.id, c.req.param('id'))).get()
    if (!r) throw new RuleError('La prueba no existe.', 404, 'run_not_found')
    const { findings: _f, ...base } = summary(r, names(db))
    const run: MigrationRun = {
      ...base, inspection: r.inspection ? JSON.parse(r.inspection) : null, results: JSON.parse(r.results ?? '[]'),
    }
    return c.json(run)
  })

  route.get('/decisions', (c) => {
    const db = deps.db()
    const who = names(db)
    return c.json(db.select().from(dec).all().map((d): FindingDecision => ({ ...d, decidedByName: who.get(d.decidedBy) ?? null })))
  })

  route.put('/decisions', async (c) => {
    const me = c.get('user')
    const input = decisionInput.parse(await c.req.json())
    const db = deps.db()
    const now = nowIso()
    db.transaction((tx) => {
      tx.insert(dec).values({ ...input, decidedBy: me.id, decidedAt: now })
        .onConflictDoUpdate({ target: dec.key, set: { decision: input.decision, note: input.note, decidedBy: me.id, decidedAt: now } })
        .run()
      writeAudit(tx, { userId: me.id, empresaId: null }, {
        module: 'core', action: 'decidir-hallazgo', entity: 'migration_finding', entityId: input.key, detail: input,
      })
    })
    const saved: FindingDecision = { ...input, decidedBy: me.id, decidedByName: names(db).get(me.id) ?? null, decidedAt: now }
    return c.json(saved)
  })

  return route
}
