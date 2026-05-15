import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const arCustomers = sqliteTable('ar_customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const arInvoices = sqliteTable('ar_invoices', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  dueDate: text('due_date').notNull(),
  amount: text('amount').notNull(),
  amountPaid: text('amount_paid').notNull().default('0.00'),
  status: text('status').notNull().default('open'),
  memo: text('memo'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const arPayments = sqliteTable('ar_payments', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  date: text('date').notNull(),
  amount: text('amount').notNull(),
  reference: text('reference'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { arCustomers, arInvoices, arPayments }
