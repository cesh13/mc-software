import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const invItems = sqliteTable('inv_items', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  unitCost: text('unit_cost').notNull().default('0.00'),
  quantityOnHand: text('quantity_on_hand').notNull().default('0'),
  accountId: text('account_id').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const invTransactions = sqliteTable('inv_transactions', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull(),
  type: text('type').notNull(), // purchase, sale, adjustment
  quantity: text('quantity').notNull(),
  unitCost: text('unit_cost').notNull(),
  reference: text('reference'),
  date: text('date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { invItems, invTransactions }
