import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// Reference stubs for tables owned by the platform or by chart-of-accounts.
// They exist only so this module can declare real foreign keys without
// importing another module. They are NOT exported from schema.ts, so
// drizzle-kit never creates or alters these tables from here.
// Read-only: this module never writes to them.

export const coreEmpresasRef = sqliteTable('core_empresas', {
  id: text('id').primaryKey(),
})

export const coaAccountsRef = sqliteTable('coa_accounts', {
  id: text('id').primaryKey(),
  empresaId: text('empresa_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['activo', 'pasivo', 'capital', 'gastos', 'ingresos', 'orden', 'contra'],
  }).notNull(),
  parentId: text('parent_id'),
  level: integer('level').notNull(),
  isDetail: integer('is_detail', { mode: 'boolean' }).notNull(),
  requiresCostCenter: integer('requires_cost_center', { mode: 'boolean' }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
})
