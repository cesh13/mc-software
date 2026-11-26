import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { INV_DIRECTIONS, INV_KINDS } from '@accounting/shared'
import { coaAccountsRef, coreEmpresasRef } from '../refs.js'

const empresa = () => text('empresa_id').notNull().references(() => coreEmpresasRef.id)
const account = (name: string) => text(name).references(() => coaAccountsRef.id)
const active = () => integer('is_active', { mode: 'boolean' }).notNull().default(true)

// Legacy BODEGAS.
export const invWarehouses = sqliteTable('inv_warehouses', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  isActive: active(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('inv_warehouses_empresa_code_uq').on(t.empresaId, t.code)])

// Legacy TABLA (grupos). Default accounts for the items of the group.
export const invGroups = sqliteTable('inv_groups', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  inventoryAccountId: account('inventory_account_id'),
  cogsAccountId: account('cogs_account_id'),
  isActive: active(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('inv_groups_empresa_code_uq').on(t.empresaId, t.code)])

// Legacy ARTICULO, without stored stock or cost: both are derived from movements.
export const invItems = sqliteTable('inv_items', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  groupId: text('group_id').references(() => invGroups.id),
  unit: text('unit').notNull().default('UNIDAD'),
  barcode: text('barcode'),
  isService: integer('is_service', { mode: 'boolean' }).notNull().default(false),
  tracksLots: integer('tracks_lots', { mode: 'boolean' }).notNull().default(false),
  minQty: text('min_qty'),
  maxQty: text('max_qty'),
  // Null = the group's account.
  inventoryAccountId: account('inventory_account_id'),
  cogsAccountId: account('cogs_account_id'),
  isActive: active(),
  legacyKey: text('legacy_key'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('inv_items_empresa_code_uq').on(t.empresaId, t.code),
  index('inv_items_empresa_group_idx').on(t.empresaId, t.groupId),
])

// Legacy CONCEPTO. One code per empresa (the legacy repeats codes per direction).
export const invMovementTypes = sqliteTable('inv_movement_types', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  direction: text('direction', { enum: INV_DIRECTIONS }).notNull(),
  kind: text('kind', { enum: INV_KINDS }).notNull(),
  // Account against inventory in the entry. Null on salidas = the item's cost account.
  counterAccountId: account('counter_account_id'),
  isActive: active(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('inv_movement_types_empresa_code_uq').on(t.empresaId, t.code)])
