import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { BudgetGroup, budgetGroupInput, budgetGroupUpdate } from '@accounting/shared'
import { newId, nowIso, RuleError, type Db } from '@accounting/shared/server'
import { coaAccounts, coaBudgetGroups } from '../schema.js'
import type { Audit } from './account-commands.js'

const MODULE = 'chart-of-accounts'

export function listBudgetGroups(db: Db, empresaId: string, includeInactive: boolean): BudgetGroup[] {
  const rows = db
    .select()
    .from(coaBudgetGroups)
    .where(eq(coaBudgetGroups.empresaId, empresaId))
    .orderBy(coaBudgetGroups.code)
    .all()
  return includeInactive ? rows : rows.filter((r) => r.isActive)
}

function find(db: Db, empresaId: string, id: string): BudgetGroup {
  const row = db
    .select()
    .from(coaBudgetGroups)
    .where(and(eq(coaBudgetGroups.empresaId, empresaId), eq(coaBudgetGroups.id, id)))
    .get()
  if (!row) throw new RuleError('El grupo de presupuesto no existe.', 404, 'budget_group_not_found')
  return row
}

function assertCodeFree(db: Db, empresaId: string, code: string, exceptId?: string): void {
  const dup = listBudgetGroups(db, empresaId, true).find((g) => g.code === code && g.id !== exceptId)
  if (dup) throw new RuleError(`Ya existe el grupo ${code}.`, 409, 'code_duplicate')
}

export function createBudgetGroup(
  db: Db,
  empresaId: string,
  audit: Audit,
  input: z.output<typeof budgetGroupInput>,
): BudgetGroup {
  assertCodeFree(db, empresaId, input.code)
  const id = newId()
  const now = nowIso()
  db.transaction((tx) => {
    tx.insert(coaBudgetGroups)
      .values({ id, empresaId, code: input.code, name: input.name, isActive: true, createdAt: now, updatedAt: now })
      .run()
    audit(
      { module: MODULE, action: 'crear', entity: 'grupo_presupuesto', entityId: id, detail: input },
      tx as unknown as Db,
    )
  })
  return find(db, empresaId, id)
}

export function updateBudgetGroup(
  db: Db,
  empresaId: string,
  audit: Audit,
  id: string,
  input: z.output<typeof budgetGroupUpdate>,
): BudgetGroup {
  const current = find(db, empresaId, id)
  if (input.code !== undefined) assertCodeFree(db, empresaId, input.code, id)
  const next = { code: input.code ?? current.code, name: input.name ?? current.name }
  if (next.code === current.code && next.name === current.name) return current
  db.transaction((tx) => {
    tx.update(coaBudgetGroups).set({ ...next, updatedAt: nowIso() }).where(eq(coaBudgetGroups.id, id)).run()
    audit(
      {
        module: MODULE,
        action: 'modificar',
        entity: 'grupo_presupuesto',
        entityId: id,
        detail: { before: { code: current.code, name: current.name }, after: next },
      },
      tx as unknown as Db,
    )
  })
  return find(db, empresaId, id)
}

export function setBudgetGroupActive(
  db: Db,
  empresaId: string,
  audit: Audit,
  id: string,
  active: boolean,
): BudgetGroup {
  const current = find(db, empresaId, id)
  if (current.isActive === active) {
    throw active
      ? new RuleError('El grupo ya está activo.', 409, 'already_active')
      : new RuleError('El grupo ya está inactivo.', 409, 'already_inactive')
  }
  if (!active) {
    const used = db
      .select({ id: coaAccounts.id })
      .from(coaAccounts)
      .where(and(eq(coaAccounts.empresaId, empresaId), eq(coaAccounts.budgetGroupId, id)))
      .get()
    if (used) {
      throw new RuleError('No se puede eliminar un grupo que tiene cuentas.', 409, 'budget_group_in_use')
    }
  }
  db.transaction((tx) => {
    tx.update(coaBudgetGroups).set({ isActive: active, updatedAt: nowIso() }).where(eq(coaBudgetGroups.id, id)).run()
    audit(
      {
        module: MODULE,
        action: active ? 'reactivar' : 'desactivar',
        entity: 'grupo_presupuesto',
        entityId: id,
        detail: { code: current.code },
      },
      tx as unknown as Db,
    )
  })
  return find(db, empresaId, id)
}
