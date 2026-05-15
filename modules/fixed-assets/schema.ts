import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const faAssets = sqliteTable('fa_assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  purchaseDate: text('purchase_date').notNull(),
  purchaseCost: text('purchase_cost').notNull(),
  salvageValue: text('salvage_value').notNull().default('0.00'),
  usefulLifeYears: integer('useful_life_years').notNull(),
  depreciationMethod: text('depreciation_method').notNull().default('straight-line'),
  accountId: text('account_id').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { faAssets }
