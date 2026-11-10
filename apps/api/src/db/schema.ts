import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export * from './schema-auth.js'
export * from './schema-core.js'

// ── Platform tables ─────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  isAlwaysOn: integer('is_always_on', { mode: 'boolean' }).notNull().default(false),
  enabledAt: text('enabled_at'),
  installedAt: text('installed_at').notNull(),
})
