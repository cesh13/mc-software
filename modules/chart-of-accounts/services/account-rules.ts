import { and, eq } from 'drizzle-orm'
import { RuleError, type Db } from '@accounting/shared/server'
import { coaBudgetGroups } from '../schema.js'
import type { AccountRow } from './tree.js'

// Resolves the parent a request points at.
//   undefined → the request says nothing about the parent
//   null      → no parent (root account)
export function resolveParent(
  rows: AccountRow[],
  parentId?: string | null,
  parentCode?: string | null,
): AccountRow | null | undefined {
  if (parentId === undefined && parentCode === undefined) return undefined
  if (!parentId && !parentCode) return null
  const byId = parentId ? rows.find((r) => r.id === parentId) : undefined
  const byCode = parentCode ? rows.find((r) => r.code === parentCode) : undefined
  if (parentId && parentCode && byId && byCode && byId.id !== byCode.id) {
    throw new RuleError('parentId y parentCode apuntan a cuentas distintas.', 400, 'parent_conflict')
  }
  const parent = parentId ? byId : byCode
  if (!parent) throw new RuleError('La cuenta padre no existe.', 400, 'parent_not_found')
  if (parentId && parentCode && !byCode) {
    throw new RuleError('La cuenta padre no existe.', 400, 'parent_not_found')
  }
  return parent
}

// The parent must be active, not a detail account, and of the same type.
export function assertParentValid(parent: AccountRow, type: string): void {
  if (!parent.isActive) {
    throw new RuleError('La cuenta padre está inactiva.', 400, 'parent_inactive')
  }
  if (parent.isDetail) {
    throw new RuleError('La cuenta padre es de detalle.', 400, 'parent_is_detail')
  }
  if (parent.type !== type) {
    throw new RuleError('La cuenta padre debe ser del mismo tipo.', 400, 'parent_type_mismatch')
  }
}

export function assertCostCenterFlag(isDetail: boolean, requiresCostCenter: boolean): void {
  if (requiresCostCenter && !isDetail) {
    throw new RuleError(
      'Solo una cuenta de detalle puede exigir centro de costo.',
      400,
      'cost_center_not_detail',
    )
  }
}

export function assertBudgetGroup(db: Db, empresaId: string, groupId: string): void {
  const group = db
    .select({ isActive: coaBudgetGroups.isActive })
    .from(coaBudgetGroups)
    .where(and(eq(coaBudgetGroups.empresaId, empresaId), eq(coaBudgetGroups.id, groupId)))
    .get()
  if (!group) {
    throw new RuleError('El grupo de presupuesto no existe.', 400, 'budget_group_not_found')
  }
  if (!group.isActive) {
    throw new RuleError('El grupo de presupuesto está inactivo.', 400, 'budget_group_inactive')
  }
}
