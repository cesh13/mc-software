import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Reports module has no persistent data of its own —
// it reads from gl_journal_entries, gl_journal_lines, and coa_accounts.
// This table stores saved report definitions for quick access.
export const rptSavedReports = sqliteTable('rpt_saved_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // balance-sheet, income-statement, trial-balance
  parameters: text('parameters').notNull().default('{}'), // JSON string
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
})

export default { rptSavedReports }
