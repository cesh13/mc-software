import { and, desc, eq, gte, lt, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import type { AuditRow } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { user } from '../db/schema-auth.js'
import { coreAuditLog as a } from '../db/schema.js'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD.')
const opt = z.string().trim().min(1).optional()

export const auditFilters = z.object({
  empresaId: opt,
  userId: opt,
  module: opt,
  entity: opt,
  entityId: opt,
  from: date.optional(),
  to: date.optional(),
  q: opt,
})

export const auditPaging = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export type AuditFilters = z.infer<typeof auditFilters>

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

// `scope`: the single empresa to read, or null for every empresa (owners only).
export function auditWhere(f: AuditFilters, scope: string | null): SQL | undefined {
  const w: (SQL | undefined)[] = [
    scope ? eq(a.empresaId, scope) : undefined,
    f.userId ? eq(a.userId, f.userId) : undefined,
    f.module ? eq(a.module, f.module) : undefined,
    f.entity ? eq(a.entity, f.entity) : undefined,
    f.entityId ? eq(a.entityId, f.entityId) : undefined,
    f.from ? gte(a.at, f.from) : undefined,
    // `to` includes the whole day.
    f.to ? lt(a.at, nextDay(f.to)) : undefined,
  ]
  if (f.q) {
    const pat = `%${likeEscape(f.q)}%`
    w.push(or(
      sql`${a.action} like ${pat} escape '\\'`,
      sql`${a.entity} like ${pat} escape '\\'`,
      sql`${a.detail} like ${pat} escape '\\'`,
    ))
  }
  return and(...w)
}

export function queryAudit(db: Db, where: SQL | undefined, limit: number, offset: number): { rows: AuditRow[]; total: number } {
  const rows = db
    .select({
      id: a.id, empresaId: a.empresaId, userId: a.userId, userName: user.name, at: a.at,
      module: a.module, action: a.action, entity: a.entity, entityId: a.entityId, detail: a.detail,
    })
    .from(a)
    .leftJoin(user, eq(user.id, a.userId))
    .where(where)
    .orderBy(desc(a.at), desc(a.id))
    .limit(limit)
    .offset(offset)
    .all()
  const total = db.select({ n: sql<number>`count(*)` }).from(a).where(where).get()?.n ?? 0
  return { rows, total }
}

const csvCell = (v: string | null) => {
  const s = v ?? ''
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function auditCsv(rows: AuditRow[]): string {
  const head = ['Fecha', 'Usuario', 'Empresa', 'Módulo', 'Acción', 'Entidad', 'Id entidad', 'Detalle']
  const lines = rows.map((r) =>
    [r.at, r.userName ?? r.userId, r.empresaId, r.module, r.action, r.entity, r.entityId, r.detail].map(csvCell).join(','),
  )
  return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n'
}
