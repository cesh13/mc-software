import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const glFiscalPeriods = sqliteTable('gl_fiscal_periods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
})

export const glJournalEntries = sqliteTable('gl_journal_entries', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  reference: text('reference'),
  memo: text('memo'),
  periodId: text('period_id').notNull(),
  createdBy: text('created_by').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const glJournalLines = sqliteTable('gl_journal_lines', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  accountId: text('account_id').notNull(),
  debit: text('debit').notNull().default('0.00'),
  credit: text('credit').notNull().default('0.00'),
  memo: text('memo'),
})

export default { glFiscalPeriods, glJournalEntries, glJournalLines }
