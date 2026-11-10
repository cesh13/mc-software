import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { user } from './schema-auth.js'

// ── Core business tables shared by every module ─────────────────────────────
// One install = one encrypted DB per customer; a customer can have several
// empresas. Every business table in every module carries an empresa_id.

export const coreEmpresas = sqliteTable('core_empresas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  siglas: text('siglas').notNull().unique(),
  // One currency per empresa (ISO 4217). No multi-currency.
  moneda: text('moneda').notNull().default('USD'),
  granContribuyente: integer('gran_contribuyente', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Empresa this one consolidates into, if any.
  consolidaEnId: text('consolida_en_id').references(
    (): AnySQLiteColumn => coreEmpresas.id,
  ),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// Which empresas a user may work in (legacy USREMP).
export const coreUserEmpresas = sqliteTable(
  'core_user_empresas',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresas.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.empresaId] })],
)

// Audit trail (legacy BITACORA). Append-only.
export const coreAuditLog = sqliteTable(
  'core_audit_log',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id').references(() => coreEmpresas.id),
    userId: text('user_id').notNull(),
    at: text('at').notNull(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    entity: text('entity'),
    entityId: text('entity_id'),
    // JSON string with the before/after or free-form detail.
    detail: text('detail'),
  },
  (t) => [
    index('core_audit_log_empresa_at_idx').on(t.empresaId, t.at),
    index('core_audit_log_entity_idx').on(t.entity, t.entityId),
  ],
)
