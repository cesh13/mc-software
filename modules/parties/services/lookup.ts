import { and, asc, desc, eq } from 'drizzle-orm'
import { normalizeNrc, type PartiesLookup, type PartyInfo } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { ptyParties } from '../schema.js'
import { searchCondition } from './parties-read.js'

const SEARCH_LIMIT = 50

const columns = {
  id: ptyParties.id,
  code: ptyParties.code,
  name: ptyParties.name,
  kind: ptyParties.kind,
  nit: ptyParties.nit,
  nrc: ptyParties.nrc,
  dui: ptyParties.dui,
  isCustomer: ptyParties.isCustomer,
  isSupplier: ptyParties.isSupplier,
  isForeign: ptyParties.isForeign,
  isActive: ptyParties.isActive,
}

// The `parties` lookup of contratos §7: read-only, no audit, bound to one
// empresa, accepts a db or a transaction. Provided as the `parties` service
// (see manifest.ts).
export function createPartiesLookup(ctx: { empresaId: string }): PartiesLookup<Db> {
  const own = eq(ptyParties.empresaId, ctx.empresaId)
  return {
    get(db, id): PartyInfo | null {
      return db.select(columns).from(ptyParties).where(and(own, eq(ptyParties.id, id))).get() ?? null
    },
    // Active party first: an inactive one may share the NRC.
    byNrc(db, nrc): PartyInfo | null {
      const key = normalizeNrc(nrc)
      if (!key) return null
      return (
        db
          .select(columns)
          .from(ptyParties)
          .where(and(own, eq(ptyParties.nrc, key)))
          .orderBy(desc(ptyParties.isActive), asc(ptyParties.code))
          .get() ?? null
      )
    },
    // Active parties only, for pickers in other modules.
    search(db, q): PartyInfo[] {
      return db
        .select(columns)
        .from(ptyParties)
        .where(and(own, eq(ptyParties.isActive, true), searchCondition(q)))
        .orderBy(asc(ptyParties.name), asc(ptyParties.code))
        .limit(SEARCH_LIMIT)
        .all()
    },
  }
}
