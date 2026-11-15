import { and, eq, sql } from 'drizzle-orm'
import { formatSequence } from '@accounting/shared'
import { RuleError, newId, nowIso, type SequencesService, type ServiceContext } from '@accounting/shared/server'
import { coreSequences as q } from '../db/schema.js'

// Implementation of the `sequences` contract over core_sequences.
export function sequencesService(ctx: ServiceContext): SequencesService {
  const where = (scope: string, key: string) => and(eq(q.empresaId, ctx.empresaId), eq(q.scope, scope), eq(q.key, key))
  const find = (scope: string, key: string) => ctx.db.select().from(q).where(where(scope, key)).get()

  return {
    next(scope, key) {
      const row = find(scope, key)
      if (!row) throw new RuleError(`No hay correlativo definido para ${scope} ${key}.`, 409, 'sequence_not_defined')
      if (row.rangeTo !== null && row.nextValue > row.rangeTo) {
        throw new RuleError(`Se agotó el rango autorizado (${scope} ${key}, hasta ${row.rangeTo}).`, 409, 'sequence_exhausted')
      }
      if (row.validTo && nowIso().slice(0, 10) > row.validTo) {
        throw new RuleError(`La autorización del correlativo ${scope} ${key} venció el ${row.validTo}.`, 409, 'sequence_expired')
      }
      // Single writer + the caller's transaction: the increment rolls back with it.
      const updated = ctx.db.update(q)
        .set({ nextValue: sql`${q.nextValue} + 1`, updatedAt: nowIso() })
        .where(and(eq(q.id, row.id), eq(q.nextValue, row.nextValue)))
        .returning({ value: q.nextValue }).get()
      if (!updated) throw new RuleError('El correlativo cambió; intente de nuevo.', 409, 'sequence_conflict')
      return { value: row.nextValue, formatted: formatSequence(row.nextValue, row.width, row.prefix) }
    },

    peek(scope, key) {
      const row = find(scope, key)
      return row ? { value: row.nextValue, formatted: formatSequence(row.nextValue, row.width, row.prefix) } : null
    },

    define(def) {
      if (!Number.isInteger(def.nextValue) || def.nextValue < 1) {
        throw new RuleError('El siguiente número debe ser un entero mayor que cero.', 400, 'sequence_invalid')
      }
      if (def.rangeFrom != null && def.nextValue < def.rangeFrom) {
        throw new RuleError('El siguiente número queda antes del rango autorizado.', 400, 'sequence_invalid')
      }
      const row = find(def.scope, def.key)
      // A number already handed out is never handed out again.
      if (row && def.nextValue < row.nextValue) {
        throw new RuleError(`El correlativo ya va en ${row.nextValue}; no puede retroceder.`, 409, 'sequence_backwards')
      }
      const values = {
        nextValue: def.nextValue, width: def.width, prefix: def.prefix ?? '', rangeFrom: def.rangeFrom ?? null,
        rangeTo: def.rangeTo ?? null, validFrom: def.validFrom ?? null, validTo: def.validTo ?? null,
        authorizationRef: def.authorizationRef ?? null, updatedAt: nowIso(),
      }
      if (row) ctx.db.update(q).set(values).where(eq(q.id, row.id)).run()
      else ctx.db.insert(q).values({ id: newId(), empresaId: ctx.empresaId, scope: def.scope, key: def.key, ...values }).run()
      ctx.audit({
        module: 'core', action: 'definir-correlativo', entity: 'sequence', entityId: `${def.scope}:${def.key}`, detail: def,
      }, ctx.db)
    },
  }
}
