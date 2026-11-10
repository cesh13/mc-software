import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Reference stubs for tables owned by the platform. They exist only so this
// module can declare real foreign keys without importing platform code.
// They are NOT exported from schema.ts, so drizzle-kit never creates or
// alters these tables from here.

export const coreEmpresasRef = sqliteTable('core_empresas', {
  id: text('id').primaryKey(),
})
