import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { coreEmpresasRef, ptyPartiesRef } from '../refs.js'
import { invItems, invMovementTypes, invWarehouses } from './catalogs.js'

const empresa = () => text('empresa_id').notNull().references(() => coreEmpresasRef.id)

// A movement document (legacy DATAMOV). Applied when saved; voided, never deleted.
export const invDocuments = sqliteTable('inv_documents', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  typeId: text('type_id').notNull().references(() => invMovementTypes.id),
  number: text('number').notNull(),
  date: text('date').notNull(),
  warehouseId: text('warehouse_id').notNull().references(() => invWarehouses.id),
  destWarehouseId: text('dest_warehouse_id').references(() => invWarehouses.id),
  partyId: text('party_id').references(() => ptyPartiesRef.id),
  reference: text('reference'),
  notes: text('notes'),
  status: text('status', { enum: ['aplicado', 'anulado'] }).notNull(),
  totalCost: text('total_cost').notNull(),
  voidReason: text('void_reason'),
  voidedAt: text('voided_at'),
  voidedBy: text('voided_by'),
  legacyKey: text('legacy_key'),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('inv_documents_empresa_type_number_uq').on(t.empresaId, t.typeId, t.number),
  index('inv_documents_empresa_date_idx').on(t.empresaId, t.date),
])

// The kárdex (legacy MOVIMIEN): one row per line and warehouse. A transfer has an
// 'out' and an 'in' row at the same cost; a void adds reversal rows.
export const invMovements = sqliteTable('inv_movements', {
  id: text('id').primaryKey(),
  empresaId: empresa(),
  documentId: text('document_id').notNull().references(() => invDocuments.id),
  lineNo: integer('line_no').notNull(),
  itemId: text('item_id').notNull().references(() => invItems.id),
  warehouseId: text('warehouse_id').notNull().references(() => invWarehouses.id),
  direction: text('direction', { enum: ['in', 'out'] }).notNull(),
  quantity: text('quantity').notNull(),   // positive, 5 decimals
  unitCost: text('unit_cost').notNull(),  // 5 decimals
  totalCost: text('total_cost').notNull(), // money, frozen when saved
  lotNo: text('lot_no'),
  expiresOn: text('expires_on'),
  date: text('date').notNull(),
  reversalOf: text('reversal_of'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('inv_movements_item_date_idx').on(t.empresaId, t.itemId, t.date),
  index('inv_movements_document_idx').on(t.documentId),
])

// Moving average per item across warehouses (contratos.md §3). Updated in the
// same transaction as each movement; `value` is always Σ totalCost of the movements.
export const invCostState = sqliteTable('inv_cost_state', {
  empresaId: empresa(),
  itemId: text('item_id').notNull().references(() => invItems.id),
  quantity: text('quantity').notNull(),
  value: text('value').notNull(),
  averageCost: text('average_cost').notNull(),
  lastCost: text('last_cost'),
  updatedAt: text('updated_at').notNull(),
}, (t) => [primaryKey({ columns: [t.empresaId, t.itemId] })])
