import { and, eq, ne } from 'drizzle-orm'
import type { z } from 'zod'
import type { Party, partyInput, partyUpdate } from '@accounting/shared'
import { newId, nowIso, RuleError, type AuditEntry, type Db } from '@accounting/shared/server'
import { ptyParties } from '../schema.js'
import { findPartyRow, getParty, partyNotFound } from './parties-read.js'

export type Audit = (entry: AuditEntry, tx?: Db) => void

const MODULE = 'parties'
const ENTITY = 'tercero'

type Values = Omit<typeof ptyParties.$inferInsert, 'id' | 'empresaId' | 'createdAt' | 'updatedAt'>

function other(db: Db, empresaId: string, exceptId: string | undefined, col: 'code' | 'nrc' | 'nit', value: string) {
  const conds = [eq(ptyParties.empresaId, empresaId), eq(ptyParties[col], value)]
  if (col !== 'code') conds.push(eq(ptyParties.isActive, true))
  if (exceptId) conds.push(ne(ptyParties.id, exceptId))
  return db.select({ code: ptyParties.code }).from(ptyParties).where(and(...conds)).get()
}

// Code is unique among all parties; NRC and NIT among the active ones.
function assertUnique(db: Db, empresaId: string, v: Pick<Values, 'code' | 'nrc' | 'nit'>, exceptId?: string): void {
  if (other(db, empresaId, exceptId, 'code', v.code)) {
    throw new RuleError(`Ya existe un cliente o proveedor con el código ${v.code}.`, 409, 'code_duplicate')
  }
  const nrc = v.nrc ? other(db, empresaId, exceptId, 'nrc', v.nrc) : undefined
  if (nrc) {
    throw new RuleError(`El NRC ${v.nrc} ya está registrado en el tercero ${nrc.code}.`, 409, 'nrc_duplicate')
  }
  const nit = v.nit ? other(db, empresaId, exceptId, 'nit', v.nit) : undefined
  if (nit) {
    throw new RuleError(`El NIT ${v.nit} ya está registrado en el tercero ${nit.code}.`, 409, 'nit_duplicate')
  }
}

function assertRole(v: { isCustomer?: boolean | null; isSupplier?: boolean | null }): void {
  if (!v.isCustomer && !v.isSupplier) {
    throw new RuleError('El tercero debe ser cliente, proveedor o ambos.', 400, 'role_required')
  }
}

export function createParty(
  db: Db,
  empresaId: string,
  audit: Audit,
  input: z.output<typeof partyInput>,
): Party {
  const values: Values = { ...input }
  assertRole(values)
  assertUnique(db, empresaId, values)
  const id = newId()
  const now = nowIso()
  db.transaction((tx) => {
    tx.insert(ptyParties).values({ ...values, id, empresaId, isActive: true, createdAt: now, updatedAt: now }).run()
    audit({ module: MODULE, action: 'crear', entity: ENTITY, entityId: id, detail: values }, tx as unknown as Db)
  })
  return getParty(db, empresaId, id)
}

export function updateParty(
  db: Db,
  empresaId: string,
  audit: Audit,
  id: string,
  input: z.output<typeof partyUpdate>,
): Party {
  const current = findPartyRow(db, empresaId, id)
  if (!current) partyNotFound()
  const changes: Record<string, [unknown, unknown]> = {}
  const patch: Partial<Values> = {}
  for (const [key, value] of Object.entries(input) as [keyof Values, unknown][]) {
    if (value === undefined || current[key] === value) continue
    changes[key] = [current[key], value]
    ;(patch as Record<string, unknown>)[key] = value
  }
  if (Object.keys(patch).length === 0) return getParty(db, empresaId, id)
  const next = { ...current, ...patch }
  assertRole(next)
  if (next.isActive) assertUnique(db, empresaId, next, id)
  else if (patch.code !== undefined) assertUnique(db, empresaId, { code: next.code, nrc: null, nit: null }, id)
  db.transaction((tx) => {
    tx.update(ptyParties).set({ ...patch, updatedAt: nowIso() }).where(eq(ptyParties.id, id)).run()
    audit({ module: MODULE, action: 'modificar', entity: ENTITY, entityId: id, detail: { changes } }, tx as unknown as Db)
  })
  return getParty(db, empresaId, id)
}

export function setPartyActive(db: Db, empresaId: string, audit: Audit, id: string, active: boolean): Party {
  const current = findPartyRow(db, empresaId, id)
  if (!current) partyNotFound()
  if (current.isActive === active) {
    throw active
      ? new RuleError('El tercero ya está activo.', 409, 'already_active')
      : new RuleError('El tercero ya está inactivo.', 409, 'already_inactive')
  }
  // Another active party may have taken its NRC or NIT meanwhile.
  if (active) assertUnique(db, empresaId, current, id)
  db.transaction((tx) => {
    tx.update(ptyParties).set({ isActive: active, updatedAt: nowIso() }).where(eq(ptyParties.id, id)).run()
    audit(
      {
        module: MODULE,
        action: active ? 'reactivar' : 'desactivar',
        entity: ENTITY,
        entityId: id,
        detail: { code: current.code },
      },
      tx as unknown as Db,
    )
  })
  return getParty(db, empresaId, id)
}
