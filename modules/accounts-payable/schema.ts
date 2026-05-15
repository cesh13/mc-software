import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const apVendors = sqliteTable('ap_vendors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const apInvoices = sqliteTable('ap_invoices', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  dueDate: text('due_date').notNull(),
  amount: text('amount').notNull(),
  amountPaid: text('amount_paid').notNull().default('0.00'),
  status: text('status').notNull().default('open'), // open, partial, paid, void
  memo: text('memo'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export const apPayments = sqliteTable('ap_payments', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  date: text('date').notNull(),
  amount: text('amount').notNull(),
  reference: text('reference'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

export default { apVendors, apInvoices, apPayments }
