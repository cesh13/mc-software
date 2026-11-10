import { eq, inArray } from 'drizzle-orm'
import type { z } from 'zod'
import type { Account, accountInput, accountUpdate } from '@accounting/shared'
import { newId, nowIso, RuleError, type Db, type ModuleEnv } from '@accounting/shared/server'
import { coaAccounts } from '../schema.js'
import { getAccount, accountNotFound } from './accounts.js'
import {
  assertBudgetGroup,
  assertCostCenterFlag,
  assertParentValid,
  resolveParent,
} from './account-rules.js'
import { childrenIndex, isSelfOrDescendant, levelsFrom, loadRows, subtree } from './tree.js'
import { accountHasMovements, accountsWithMovements } from './usage.js'

export type Audit = ModuleEnv['Variables']['audit']
const MODULE = 'chart-of-accounts'

export function createAccount(
  db: Db,
  empresaId: string,
  audit: Audit,
  input: z.output<typeof accountInput>,
): Account {
  const rows = loadRows(db, empresaId)
  if (rows.some((r) => r.code === input.code)) {
    throw new RuleError(`Ya existe la cuenta ${input.code}.`, 409, 'code_duplicate')
  }
  const parent = resolveParent(rows, input.parentId, input.parentCode) ?? null
  if (parent) assertParentValid(parent, input.type)
  assertCostCenterFlag(input.isDetail, input.requiresCostCenter)
  if (input.budgetGroupId) assertBudgetGroup(db, empresaId, input.budgetGroupId)

  const id = newId()
  const now = nowIso()
  db.transaction((tx) => {
    tx.insert(coaAccounts)
      .values({
        id,
        empresaId,
        code: input.code,
        name: input.name,
        type: input.type,
        parentId: parent?.id ?? null,
        level: parent ? parent.level + 1 : 1,
        isDetail: input.isDetail,
        requiresCostCenter: input.requiresCostCenter,
        budgetGroupId: input.budgetGroupId ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    audit(
      {
        module: MODULE,
        action: 'crear',
        entity: 'cuenta',
        entityId: id,
        detail: { code: input.code, name: input.name, type: input.type, parent: parent?.code ?? null },
      },
      tx as unknown as Db,
    )
  })
  return getAccount(db, empresaId, id)
}

export function updateAccount(
  db: Db,
  empresaId: string,
  audit: Audit,
  id: string,
  input: z.output<typeof accountUpdate>,
): Account {
  const rows = loadRows(db, empresaId)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const acct = byId.get(id)
  if (!acct) accountNotFound()
  if (input.code !== undefined && input.code !== acct.code) {
    throw new RuleError('El código de una cuenta no se puede cambiar.', 400, 'code_immutable')
  }
  const children = childrenIndex(rows)
  const activeChildren = (children.get(id) ?? []).filter((r) => r.isActive)

  const type = input.type ?? acct.type
  const isDetail = input.isDetail ?? acct.isDetail
  let requiresCostCenter = input.requiresCostCenter ?? acct.requiresCostCenter
  // Leaving detail drops the cost-center flag unless the request says otherwise.
  if (acct.isDetail && !isDetail && input.requiresCostCenter === undefined) {
    requiresCostCenter = false
  }
  const typeChanged = type !== acct.type
  const detailChanged = isDetail !== acct.isDetail
  const costCenterChanged = requiresCostCenter !== acct.requiresCostCenter

  const spec = resolveParent(rows, input.parentId, input.parentCode)
  const parentChanged = spec !== undefined && (spec?.id ?? null) !== acct.parentId
  const parent = spec !== undefined ? spec : acct.parentId ? (byId.get(acct.parentId) ?? null) : null

  if (detailChanged && isDetail && activeChildren.length > 0) {
    throw new RuleError(
      'No se puede convertir en cuenta de detalle: tiene sub-cuentas.',
      409,
      'has_children',
    )
  }
  const sub = subtree(acct, children)
  if ((detailChanged && !isDetail) || typeChanged || costCenterChanged) {
    if (accountHasMovements(db, id)) {
      throw new RuleError(
        'No se puede cambiar el tipo, el detalle ni el centro de costo de una cuenta con movimientos.',
        409,
        'has_movements',
      )
    }
  }
  if (typeChanged && accountsWithMovements(db, sub.map((r) => r.id)).size > 0) {
    throw new RuleError(
      'No se puede cambiar el tipo: hay sub-cuentas con movimientos.',
      409,
      'has_movements',
    )
  }
  if (parentChanged && parent && isSelfOrDescendant(byId, id, parent.id)) {
    throw new RuleError(
      'La cuenta padre no puede ser la misma cuenta ni una de sus sub-cuentas.',
      400,
      'parent_cycle',
    )
  }
  if ((parentChanged || typeChanged) && parent) assertParentValid(parent, type)
  if (input.isDetail !== undefined || input.requiresCostCenter !== undefined) {
    assertCostCenterFlag(isDetail, requiresCostCenter)
  }
  const budgetGroupId = input.budgetGroupId === undefined ? acct.budgetGroupId : input.budgetGroupId
  if (budgetGroupId && budgetGroupId !== acct.budgetGroupId) {
    assertBudgetGroup(db, empresaId, budgetGroupId)
  }

  const level = parentChanged ? (parent ? parent.level + 1 : 1) : acct.level
  const next = {
    name: input.name ?? acct.name,
    type,
    isDetail,
    requiresCostCenter,
    budgetGroupId,
    level,
    parentId: parent?.id ?? null,
  }
  const changes: Record<string, [unknown, unknown]> = {}
  for (const [key, value] of Object.entries(next)) {
    const old = acct[key as keyof typeof next]
    if (old !== value) changes[key] = [old, value]
  }
  if (Object.keys(changes).length === 0) return getAccount(db, empresaId, id)

  const now = nowIso()
  const levels = level !== acct.level ? levelsFrom(acct, level, children).filter((l) => l.id !== id) : []
  const descendantIds = sub.filter((r) => r.id !== id).map((r) => r.id)
  db.transaction((tx) => {
    tx.update(coaAccounts).set({ ...next, updatedAt: now }).where(eq(coaAccounts.id, id)).run()
    if (typeChanged && descendantIds.length) {
      tx.update(coaAccounts)
        .set({ type, updatedAt: now })
        .where(inArray(coaAccounts.id, descendantIds))
        .run()
    }
    for (const l of levels) {
      tx.update(coaAccounts).set({ level: l.level, updatedAt: now }).where(eq(coaAccounts.id, l.id)).run()
    }
    audit(
      {
        module: MODULE,
        action: 'modificar',
        entity: 'cuenta',
        entityId: id,
        detail: { code: acct.code, changes, descendantsReleveled: levels.length, typeCascade: typeChanged },
      },
      tx as unknown as Db,
    )
  })
  return getAccount(db, empresaId, id)
}
