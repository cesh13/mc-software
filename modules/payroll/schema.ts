import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const payEmployees = sqliteTable('pay_employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  salary: text('salary').notNull().default('0.00'),
  payType: text('pay_type').notNull().default('salary'), // salary, hourly
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const payRuns = sqliteTable('pay_runs', {
  id: text('id').primaryKey(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  totalGross: text('total_gross').notNull().default('0.00'),
  totalNet: text('total_net').notNull().default('0.00'),
  status: text('status').notNull().default('draft'), // draft, approved, posted
  journalEntryId: text('journal_entry_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { payEmployees, payRuns }
