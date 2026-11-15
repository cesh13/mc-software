import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
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

// Fiscal profile of an empresa ("ficha fiscal"): one row per empresa.
export const coreEmpresaProfile = sqliteTable('core_empresa_profile', {
  empresaId: text('empresa_id')
    .primaryKey()
    .references(() => coreEmpresas.id),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name').notNull().default(''),
  nit: text('nit').notNull().default(''),
  nrc: text('nrc').notNull().default(''),
  giro: text('giro').notNull().default(''),
  economicActivityCode: text('economic_activity_code').notNull().default(''),
  departmentCode: text('department_code').notNull().default(''),
  municipalityCode: text('municipality_code').notNull().default(''),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  // Reference to a stored file; upload comes later.
  logoRef: text('logo_ref'),
  amountsLegend: text('amounts_legend').notNull().default(''),
  updatedBy: text('updated_by'),
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

// Per-user permission overrides (legacy PERFIL). empresa_id null = every empresa.
// Resolution order lives in @accounting/shared `can()` (docs/sistema/fase-0.md F1).
export const corePermissionOverrides = sqliteTable(
  'core_permission_overrides',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    effect: text('effect', { enum: ['grant', 'deny'] }).notNull(),
    empresaId: text('empresa_id').references(() => coreEmpresas.id),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('core_permission_overrides_user_idx').on(t.userId)],
)

// Module active per empresa (production, fixed assets, payroll are optional per
// client). Always-on modules ignore this table. No row = not active.
export const coreEmpresaModules = sqliteTable(
  'core_empresa_modules',
  {
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresas.id),
    moduleId: text('module_id').notNull(),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
    updatedBy: text('updated_by').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.empresaId, t.moduleId] })],
)

// Shared period state per empresa, area and month (contratos.md §2). No row = open.
export const corePeriods = sqliteTable(
  'core_periods',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresas.id),
    area: text('area').notNull(),
    period: text('period').notNull(),
    status: text('status', { enum: ['open', 'closed', 'filed'] }).notNull(),
    closedBy: text('closed_by'),
    closedAt: text('closed_at'),
    reopenedBy: text('reopened_by'),
    reopenedAt: text('reopened_at'),
    reopenReason: text('reopen_reason'),
    filedRef: text('filed_ref'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('core_periods_empresa_area_period_uq').on(t.empresaId, t.area, t.period)],
)

// Per-empresa settings by namespace and key (contratos.md §8). Dated settings
// keep one row per valid_from; undated ones use valid_from = '0000-01-01'.
export const coreEmpresaSettings = sqliteTable(
  'core_empresa_settings',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresas.id),
    namespace: text('namespace').notNull(),
    key: text('key').notNull(),
    // JSON text, validated by the declaring manifest's Zod schema.
    value: text('value').notNull(),
    validFrom: text('valid_from').notNull(),
    updatedBy: text('updated_by').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('core_empresa_settings_uq').on(t.empresaId, t.namespace, t.key, t.validFrom)],
)

// Document numbering with ranges and authorizations (cheques, receipts,
// fiscal series, retention vouchers). Journal entries are numbered by the GL.
export const coreSequences = sqliteTable(
  'core_sequences',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresas.id),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    nextValue: integer('next_value').notNull(),
    width: integer('width').notNull(),
    prefix: text('prefix').notNull().default(''),
    rangeFrom: integer('range_from'),
    rangeTo: integer('range_to'),
    validFrom: text('valid_from'),
    validTo: text('valid_to'),
    authorizationRef: text('authorization_ref'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('core_sequences_uq').on(t.empresaId, t.scope, t.key)],
)
