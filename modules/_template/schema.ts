import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Prefix all table names with your module abbreviation.
// Example: ap_vendors, ap_invoices for accounts-payable
// Delete this comment and the example table when you start building.

export const _exampleTable = sqliteTable('tpl_example', {
  id: text('id').primaryKey(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { _exampleTable }
