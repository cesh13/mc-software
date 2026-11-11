import { randomUUID } from 'node:crypto'
import type { LegacyTables } from './source.js'
import type { ImportReport, SqlHandle } from './types.js'

export type Ctx = {
  db: SqlHandle
  report: ImportReport
  src: LegacyTables
  empresaId: string
  userId: string
  now: string
  accounts: Map<string, string> // code → id
  entryTypes: Map<string, string>
  costCenters: Map<string, string>
  budgetGroups: Map<string, string>
}

export const newId = (): string => randomUUID()

const ACCOUNT_PLACEHOLDER = '(cuenta no encontrada en el catálogo anterior)'
export const ENTRY_TYPE_PLACEHOLDER = '(tipo de partida no encontrado en el sistema anterior)'
const COST_CENTER_PLACEHOLDER = '(centro de costo no encontrado en el sistema anterior)'
const GROUP_PLACEHOLDER = '(agrupación no encontrada en el sistema anterior)'

const TYPES = ['activo', 'pasivo', 'capital', 'gastos', 'ingresos', 'orden', 'contra'] as const
export type AccountTypeName = (typeof TYPES)[number]
export const accountTypeOf = (n: number | null): AccountTypeName | null =>
  n && n >= 1 && n <= 7 ? TYPES[n - 1]! : null

function count(ctx: Ctx, table: string): void {
  ctx.report.counts[table] = (ctx.report.counts[table] ?? 0) + 1
}

// Placeholder accounts guess the type from the first digit of the code.
export function ensureAccount(ctx: Ctx, code: string): string {
  const known = ctx.accounts.get(code)
  if (known) return known
  const id = newId()
  const type = accountTypeOf(Number(code[0])) ?? 'activo'
  ctx.db
    .prepare(
      `INSERT INTO coa_accounts (id, empresa_id, code, name, type, parent_id, level, is_detail,
        requires_cost_center, budget_group_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 1, 1, 0, NULL, 1, ?, ?)`,
    )
    .run(id, ctx.empresaId, code, ACCOUNT_PLACEHOLDER, type, ctx.now, ctx.now)
  ctx.accounts.set(code, id)
  ctx.report.placeholders.accounts.push(code)
  count(ctx, 'coa_accounts')
  return id
}

export function ensureEntryType(ctx: Ctx, code: string, width = 6): string {
  const known = ctx.entryTypes.get(code)
  if (known) return known
  const id = newId()
  const stored = code === '' ? '??' : code
  ctx.db
    .prepare(
      `INSERT INTO gl_entry_types (id, empresa_id, code, name, is_bank, number_width, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)`,
    )
    .run(id, ctx.empresaId, stored, ENTRY_TYPE_PLACEHOLDER, width, ctx.now, ctx.now)
  ctx.entryTypes.set(code, id)
  ctx.report.placeholders.entryTypes.push(stored)
  count(ctx, 'gl_entry_types')
  return id
}

export function ensureCostCenter(ctx: Ctx, code: string): string {
  const known = ctx.costCenters.get(code)
  if (known) return known
  const id = newId()
  ctx.db
    .prepare(
      `INSERT INTO gl_cost_centers (id, empresa_id, code, name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(id, ctx.empresaId, code, COST_CENTER_PLACEHOLDER, ctx.now, ctx.now)
  ctx.costCenters.set(code, id)
  ctx.report.placeholders.costCenters.push(code)
  count(ctx, 'gl_cost_centers')
  return id
}

export function ensureBudgetGroup(ctx: Ctx, code: string): string {
  const known = ctx.budgetGroups.get(code)
  if (known) return known
  const id = newId()
  ctx.db
    .prepare(
      `INSERT INTO coa_budget_groups (id, empresa_id, code, name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(id, ctx.empresaId, code, GROUP_PLACEHOLDER, ctx.now, ctx.now)
  ctx.budgetGroups.set(code, id)
  ctx.report.placeholders.budgetGroups.push(code)
  count(ctx, 'coa_budget_groups')
  return id
}
