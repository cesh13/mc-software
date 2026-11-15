import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { PARTY_KINDS } from '@accounting/shared'
import { coreEmpresasRef } from './refs.js'

// One master of third parties per empresa (legacy CCCLI01, PROVEDOR ×2,
// CONTRIBU ×2, CLIENTES ×2). Operational attributes (credit limit, terms,
// salesperson, accounts) belong to accounts-receivable / accounts-payable.
// Parties are deactivated, never deleted.
export const ptyParties = sqliteTable(
  'pty_parties',
  {
    id: text('id').primaryKey(),
    empresaId: text('empresa_id')
      .notNull()
      .references(() => coreEmpresasRef.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    tradeName: text('trade_name'),
    kind: text('kind', { enum: PARTY_KINDS }).notNull(),
    isCustomer: integer('is_customer', { mode: 'boolean' }).notNull().default(false),
    isSupplier: integer('is_supplier', { mode: 'boolean' }).notNull().default(false),
    // Tax ids in canonical form (see normalizeNrc / normalizeNit / normalizeDui).
    nit: text('nit'),
    nrc: text('nrc'),
    dui: text('dui'),
    passport: text('passport'),
    foreignId: text('foreign_id'),
    isForeign: integer('is_foreign', { mode: 'boolean' }).notNull().default(false),
    economicActivityCode: text('economic_activity_code'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    departmentCode: text('department_code'),
    municipalityCode: text('municipality_code'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    // JSON array of { table, key } for imported parties; null when captured here.
    legacyRefs: text('legacy_refs'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('pty_parties_empresa_code_uq').on(t.empresaId, t.code),
    index('pty_parties_empresa_nrc_idx').on(t.empresaId, t.nrc),
    index('pty_parties_empresa_nit_idx').on(t.empresaId, t.nit),
  ],
)

export default { ptyParties }
