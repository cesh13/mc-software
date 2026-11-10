import { eq } from 'drizzle-orm'
import type { Account } from '@accounting/shared'
import { nowIso, RuleError, type Db } from '@accounting/shared/server'
import { coaAccounts } from '../schema.js'
import { accountNotFound, getAccount } from './accounts.js'
import type { Audit } from './account-commands.js'
import { assertParentValid } from './account-rules.js'
import { loadRows } from './tree.js'
import { accountHasMovements } from './usage.js'

function setActive(db: Db, audit: Audit, id: string, code: string, active: boolean): void {
  db.transaction((tx) => {
    tx.update(coaAccounts)
      .set({ isActive: active, updatedAt: nowIso() })
      .where(eq(coaAccounts.id, id))
      .run()
    audit(
      {
        module: 'chart-of-accounts',
        action: active ? 'reactivar' : 'desactivar',
        entity: 'cuenta',
        entityId: id,
        detail: { code },
      },
      tx as unknown as Db,
    )
  })
}

// Legacy "eliminar": the account is hidden, never deleted.
export function deactivateAccount(db: Db, empresaId: string, audit: Audit, id: string): Account {
  const rows = loadRows(db, empresaId)
  const acct = rows.find((r) => r.id === id)
  if (!acct) accountNotFound()
  if (!acct.isActive) {
    throw new RuleError('La cuenta ya está inactiva.', 409, 'already_inactive')
  }
  if (accountHasMovements(db, id)) {
    throw new RuleError('No se puede eliminar una cuenta con movimientos.', 409, 'has_movements')
  }
  if (rows.some((r) => r.parentId === id && r.isActive)) {
    throw new RuleError('No se puede eliminar una cuenta con sub-cuentas.', 409, 'has_children')
  }
  setActive(db, audit, id, acct.code, false)
  return getAccount(db, empresaId, id)
}

export function reactivateAccount(db: Db, empresaId: string, audit: Audit, id: string): Account {
  const rows = loadRows(db, empresaId)
  const acct = rows.find((r) => r.id === id)
  if (!acct) accountNotFound()
  if (acct.isActive) throw new RuleError('La cuenta ya está activa.', 409, 'already_active')
  const parent = acct.parentId ? rows.find((r) => r.id === acct.parentId) : undefined
  if (acct.parentId && !parent) {
    throw new RuleError('La cuenta padre no existe.', 400, 'parent_not_found')
  }
  if (parent) assertParentValid(parent, acct.type)
  setActive(db, audit, id, acct.code, true)
  return getAccount(db, empresaId, id)
}
