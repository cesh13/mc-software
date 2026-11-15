import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { coreEmpresasRef } from '../refs.js'

// Periods are stored as 'AAAA-MM' everywhere (legacy `salfec` AAAAMM).

// Entry types / comprobantes (legacy TIPOPAR), e.g. code 'CP'.
export const glEntryTypes = sqliteTable(
  'gl_entry_types',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    // Entries of this type are produced by / share numbering with Bancos.
    isBank: integer('is_bank', { mode: 'boolean' }).notNull().default(false),
    // Zero-padded width of the entry number (legacy: 6, 'CP' uses 7).
    numberWidth: integer('number_width').notNull().default(6),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('gl_entry_types_empresa_code_uq').on(t.empresaId, t.code)],
)

// Cost centers (legacy CCOSTO).
export const glCostCenters = sqliteTable(
  'gl_cost_centers',
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
  (t) => [uniqueIndex('gl_cost_centers_empresa_code_uq').on(t.empresaId, t.code)],
)

// Fiscal years (legacy PERIODO). Configurable; January–December by default.
export const glFiscalYears = sqliteTable(
  'gl_fiscal_years',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    name: text('name').notNull(),
    startPeriod: text('start_period').notNull(), // 'AAAA-MM'
    endPeriod: text('end_period').notNull(), // 'AAAA-MM'
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('gl_fiscal_years_empresa_start_uq').on(t.empresaId, t.startPeriod)],
)

export const PERIOD_STATUSES = ['open', 'closed'] as const

