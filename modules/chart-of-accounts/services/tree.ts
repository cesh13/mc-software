import { and, eq } from 'drizzle-orm'
import type { Account } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { coaAccounts, coaBudgetGroups } from '../schema.js'

export type AccountRow = typeof coaAccounts.$inferSelect

// Whole chart of one empresa. Charts have at most a few thousand accounts,
// so tree checks run in memory on this snapshot.
export function loadRows(db: Db, empresaId: string): AccountRow[] {
  return db
    .select()
    .from(coaAccounts)
    .where(eq(coaAccounts.empresaId, empresaId))
    .orderBy(coaAccounts.code)
    .all()
}

export function findRow(db: Db, empresaId: string, id: string): AccountRow | undefined {
  return db
    .select()
    .from(coaAccounts)
    .where(and(eq(coaAccounts.empresaId, empresaId), eq(coaAccounts.id, id)))
    .get()
}

export function childrenIndex(rows: AccountRow[]): Map<string, AccountRow[]> {
  const map = new Map<string, AccountRow[]>()
  for (const r of rows) {
    if (!r.parentId) continue
    const list = map.get(r.parentId)
    if (list) list.push(r)
    else map.set(r.parentId, [r])
  }
  return map
}

// The account and all its descendants (active or not), depth first.
export function subtree(root: AccountRow, children: Map<string, AccountRow[]>): AccountRow[] {
  const out: AccountRow[] = []
  const seen = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const row = stack.pop()!
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
    for (const child of children.get(row.id) ?? []) stack.push(child)
  }
  return out
}

// True when candidateId is rootId itself or has rootId among its ancestors.
export function isSelfOrDescendant(
  rows: Map<string, AccountRow>,
  rootId: string,
  candidateId: string,
): boolean {
  const seen = new Set<string>()
  let cur: AccountRow | undefined = rows.get(candidateId)
  while (cur && !seen.has(cur.id)) {
    if (cur.id === rootId) return true
    seen.add(cur.id)
    cur = cur.parentId ? rows.get(cur.parentId) : undefined
  }
  return false
}

export function budgetGroupCodes(db: Db, empresaId: string): Map<string, string> {
  const rows = db
    .select({ id: coaBudgetGroups.id, code: coaBudgetGroups.code })
    .from(coaBudgetGroups)
    .where(eq(coaBudgetGroups.empresaId, empresaId))
    .all()
  return new Map(rows.map((r) => [r.id, r.code]))
}

export function toAccounts(db: Db, empresaId: string, rows: AccountRow[], selected = rows): Account[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const withChildren = new Set<string>()
  for (const r of rows) if (r.isActive && r.parentId) withChildren.add(r.parentId)
  const groups = budgetGroupCodes(db, empresaId)
  return selected.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    parentId: r.parentId,
    parentCode: r.parentId ? (byId.get(r.parentId)?.code ?? null) : null,
    level: r.level,
    isDetail: r.isDetail,
    requiresCostCenter: r.requiresCostCenter,
    budgetGroupId: r.budgetGroupId,
    budgetGroupCode: r.budgetGroupId ? (groups.get(r.budgetGroupId) ?? null) : null,
    isActive: r.isActive,
    hasChildren: withChildren.has(r.id),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

// New level for `root` and for every descendant, measured from `rootLevel`.
export function levelsFrom(
  root: AccountRow,
  rootLevel: number,
  children: Map<string, AccountRow[]>,
): { id: string; level: number }[] {
  const out: { id: string; level: number }[] = []
  const seen = new Set<string>()
  const queue = [{ row: root, level: rootLevel }]
  while (queue.length) {
    const { row, level } = queue.shift()!
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push({ id: row.id, level })
    for (const child of children.get(row.id) ?? []) queue.push({ row: child, level: level + 1 })
  }
  return out
}
