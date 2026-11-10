import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { coreEmpresasRef } from './refs.js'

// Legacy `tipocta` 1..7, in the same order.
export const ACCOUNT_TYPES = [
  'activo',
  'pasivo',
  'capital',
  'gastos',
  'ingresos',
  'orden',
  'contra',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

// Debit-natured types: balance = previous + debits − credits.
// The rest are credit-natured: balance = previous − debits + credits.
export const DEBIT_NATURE_TYPES: readonly AccountType[] = ['activo', 'gastos', 'orden']

// Budget groupings (legacy AGRUPA / `codigoa`). An attribute of the account,
// so it lives here and not in general-ledger.
export const coaBudgetGroups = sqliteTable(
  'coa_budget_groups',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('coa_budget_groups_empresa_code_uq').on(t.empresaId, t.code)],
)

// One chart of accounts per empresa. Accounts are deactivated, never deleted.
export const coaAccounts = sqliteTable(
  'coa_accounts',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    // null = root account (legacy `anterior = "0"`).
    parentId: text('parent_id').references((): AnySQLiteColumn => coaAccounts.id),
    // 1 for roots, parent level + 1 otherwise. Stored for report indentation.
    level: integer('level').notNull(),
    // Only detail accounts receive journal lines.
    isDetail: integer('is_detail', { mode: 'boolean' }).notNull().default(false),
    // When true every journal line on this account needs a cost center.
    requiresCostCenter: integer('requires_cost_center', { mode: 'boolean' })
      .notNull()
      .default(false),
    budgetGroupId: text('budget_group_id').references(() => coaBudgetGroups.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('coa_accounts_empresa_code_uq').on(t.empresaId, t.code),
    index('coa_accounts_parent_idx').on(t.parentId),
  ],
)

export default { coaBudgetGroups, coaAccounts }
