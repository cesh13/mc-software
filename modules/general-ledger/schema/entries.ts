import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { coreEmpresasRef, coaAccountsRef } from '../refs.js'
import { glEntryTypes, glCostCenters } from './setup.js'

// borrador: may be unbalanced, never counts in balances or reports.
// aplicada: debits = credits, counts in balances.
export const ENTRY_STATUSES = ['borrador', 'aplicada'] as const
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

// Who produced the entry. 'cierre' = annual closing entry, which the income
// statement excludes. 'importado' = brought in from the legacy system.
export const ENTRY_SOURCES = ['manual', 'bancos', 'iva', 'cierre', 'importado'] as const
export type EntrySource = (typeof ENTRY_SOURCES)[number]

// Journal entry header (legacy PARTIDAS).
export const glJournalEntries = sqliteTable(
  'gl_journal_entries',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    period: text('period').notNull(), // 'AAAA-MM'; `date` must fall inside it
    entryTypeId: text('entry_type_id')
      .notNull()
      .references(() => glEntryTypes.id),
    // Zero-padded, numbered per entry type and per month. A voided entry
    // keeps its number, so the unique index below also covers inactive rows.
    number: text('number').notNull(),
    date: text('date').notNull(), // 'AAAA-MM-DD'
    concept: text('concept').notNull().default(''),
    status: text('status', { enum: ENTRY_STATUSES }).notNull().default('borrador'),
    // Legacy entry imported with debits ≠ credits. The only way an
    // 'aplicada' entry may be unbalanced.
    importedUnbalanced: integer('imported_unbalanced', { mode: 'boolean' })
      .notNull()
      .default(false),
    source: text('source', { enum: ENTRY_SOURCES }).notNull().default('manual'),
    // Id of the originating document in the source module, if any.
    sourceRef: text('source_ref'),
    // false = anulada (voided). Never physically deleted.
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('gl_journal_entries_number_uq').on(
      t.empresaId,
      t.period,
      t.entryTypeId,
      t.number,
    ),
    index('gl_journal_entries_period_idx').on(t.empresaId, t.period, t.status),
    index('gl_journal_entries_source_idx').on(t.source, t.sourceRef),
  ],
)

// Journal entry lines (legacy DETAPART). A line carries a debit or a credit,
// never both. Amounts are exact decimal strings — never floats.
export const glJournalLines = sqliteTable(
  'gl_journal_lines',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => glJournalEntries.id),
    lineNo: integer('line_no').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => coaAccountsRef.id),
    costCenterId: text('cost_center_id').references(() => glCostCenters.id),
    detail: text('detail').notNull().default(''),
    debit: text('debit').notNull().default('0.00'),
    credit: text('credit').notNull().default('0.00'),
    // Legacy `fcobro`; purpose still an open question.
    collectDate: text('collect_date'),
  },
  (t) => [
    uniqueIndex('gl_journal_lines_entry_line_uq').on(t.entryId, t.lineNo),
    index('gl_journal_lines_account_idx').on(t.accountId),
    index('gl_journal_lines_cost_center_idx').on(t.costCenterId),
  ],
)
