import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const coaAccounts = sqliteTable('coa_accounts', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  type: text('type').notNull(), // asset, liability, equity, revenue, expense
  parentId: text('parent_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export default { coaAccounts }
