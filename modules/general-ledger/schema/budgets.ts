import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { coreEmpresasRef, coaAccountsRef } from '../refs.js'
import { glCostCenters, glFiscalYears } from './setup.js'

// Monthly budget per account (legacy PRESUP, columns pmes1..pmes12).
export const glBudgets = sqliteTable(
  'gl_budgets',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => glFiscalYears.id),
    accountId: text('account_id')
      .notNull()
      .references(() => coaAccountsRef.id),
    costCenterId: text('cost_center_id').references(() => glCostCenters.id),
    // 1..12 = position within the fiscal year, not the calendar month.
    month: integer('month').notNull(),
    amount: text('amount').notNull().default('0.00'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('gl_budgets_uq').on(t.fiscalYearId, t.accountId, t.costCenterId, t.month),
  ],
)
