import { and, asc, count, eq, like, or, sql, type SQL } from 'drizzle-orm'
import type { z } from 'zod'
import type { Party, PartyLegacyRef, PartyList, partyListQuery } from '@accounting/shared'
import { RuleError, type Db } from '@accounting/shared/server'
import { ptyParties } from '../schema.js'

type Row = typeof ptyParties.$inferSelect

function parseRefs(raw: string | null): PartyLegacyRef[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    return Array.isArray(v) ? (v as PartyLegacyRef[]) : []
  } catch {
    return []
  }
}

export function toParty(r: Row): Party {
  const { empresaId: _e, legacyRefs, ...rest } = r
  return { ...rest, legacyRefs: parseRefs(legacyRefs) }
}

export function partyNotFound(): never {
  throw new RuleError('El cliente o proveedor no existe.', 404, 'party_not_found')
}

export function findPartyRow(db: Db, empresaId: string, id: string): Row | undefined {
  return db
    .select()
    .from(ptyParties)
    .where(and(eq(ptyParties.empresaId, empresaId), eq(ptyParties.id, id)))
    .get()
}

export function getParty(db: Db, empresaId: string, id: string): Party {
  const row = findPartyRow(db, empresaId, id)
  if (!row) partyNotFound()
  return toParty(row)
}

// Text search over code, name, trade name, NRC and NIT. Tax ids also match
// ignoring dashes, so '1234567' finds '123456-7'.
export function searchCondition(q: string): SQL | undefined {
  const text = q.trim()
  if (!text) return undefined
  const pattern = `%${text.replace(/[%_]/g, '')}%`
  const parts: (SQL | undefined)[] = [
    like(ptyParties.code, pattern),
    like(ptyParties.name, pattern),
    like(ptyParties.tradeName, pattern),
    like(ptyParties.nrc, pattern),
    like(ptyParties.nit, pattern),
  ]
  const digits = text.replace(/\D/g, '')
  if (digits && /^[0-9\s-]+$/.test(text)) {
    const dp = `%${digits}%`
    parts.push(sql`replace(${ptyParties.nrc}, '-', '') like ${dp}`)
    parts.push(sql`replace(${ptyParties.nit}, '-', '') like ${dp}`)
    parts.push(sql`replace(${ptyParties.dui}, '-', '') like ${dp}`)
  }
  return or(...parts)
}

export function listParties(db: Db, empresaId: string, query: z.output<typeof partyListQuery>): PartyList {
  const conds: (SQL | undefined)[] = [eq(ptyParties.empresaId, empresaId)]
  if (query.q) conds.push(searchCondition(query.q))
  if (query.role === 'customer') conds.push(eq(ptyParties.isCustomer, true))
  if (query.role === 'supplier') conds.push(eq(ptyParties.isSupplier, true))
  if (query.status !== 'all') conds.push(eq(ptyParties.isActive, query.status === 'active'))
  const where = and(...conds)
  const total = db.select({ n: count() }).from(ptyParties).where(where).get()?.n ?? 0
  const rows = db
    .select()
    .from(ptyParties)
    .where(where)
    .orderBy(asc(ptyParties.name), asc(ptyParties.code))
    .limit(query.limit)
    .offset(query.offset)
    .all()
  return { items: rows.map(toParty), total }
}
