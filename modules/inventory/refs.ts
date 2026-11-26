import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Reference stubs for tables owned by the platform, chart-of-accounts and
// parties. They exist only so this module can declare real foreign keys and
// read a few columns. They are NOT exported from schema.ts, so drizzle-kit
// never creates or alters these tables from here. Read-only.

export const coreEmpresasRef = sqliteTable('core_empresas', {
  id: text('id').primaryKey(),
})

export const coaAccountsRef = sqliteTable('coa_accounts', {
  id: text('id').primaryKey(),
  empresaId: text('empresa_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isDetail: integer('is_detail', { mode: 'boolean' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
})

export const ptyPartiesRef = sqliteTable('pty_parties', {
  id: text('id').primaryKey(),
  empresaId: text('empresa_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
})
