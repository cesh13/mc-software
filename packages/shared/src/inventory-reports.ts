// Inventory reports and bulk imports (pasted from a spreadsheet). Browser-safe.
import { z } from 'zod'
import type { Qty } from './inventory.js'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD).')

export const stockQuery = z.object({
  at: date, warehouseId: z.string().optional(), groupId: z.string().optional(),
  zero: z.enum(['0', '1']).optional(), // include items with zero stock
  lots: z.enum(['0', '1']).optional(), // one row per lot
})
export type StockRow = {
  itemId: string; itemCode: string; itemName: string; unit: string; groupCode: string | null
  warehouseId: string | null; warehouseCode: string | null; lotNo: string | null; expiresOn: string | null
  quantity: Qty; minQty: Qty | null; belowMin: boolean
}

export const kardexQuery = z.object({
  itemId: z.string().min(1, 'Elija el producto.'), from: date, to: date, warehouseId: z.string().optional(),
})
export type KardexRow = {
  movementId: string; documentId: string; date: string; typeCode: string; number: string
  warehouseCode: string; lotNo: string | null; reference: string | null
  inQty: Qty; outQty: Qty; balanceQty: Qty
  unitCost: string; inValue: string; outValue: string; balanceValue: string
  isReversal: boolean
}
export type Kardex = {
  item: { id: string; code: string; name: string; unit: string }
  opening: { quantity: Qty; value: string }
  rows: KardexRow[]
  closing: { quantity: Qty; value: string }
}

export const valuationQuery = z.object({ at: date, groupId: z.string().optional() })
export type ValuationRow = {
  itemId: string; itemCode: string; itemName: string; unit: string; groupCode: string | null
  inventoryAccountCode: string | null; quantity: Qty; averageCost: string; value: string
}
export type Valuation = {
  at: string; rows: ValuationRow[]
  byAccount: { accountId: string | null; accountCode: string | null; accountName: string | null; value: string }[]
  total: string
}

// ── Imports (rows pasted from a spreadsheet, already split into cells by the screen) ──

export const itemImportRow = z.object({
  code: z.string(), name: z.string(), groupCode: z.string().optional(), unit: z.string().optional(),
  isService: z.boolean().optional(), tracksLots: z.boolean().optional(),
})
export const itemImportInput = z.object({ rows: z.array(itemImportRow).min(1).max(5000), dryRun: z.boolean().default(false) })

export const openingImportRow = z.object({
  itemCode: z.string(), warehouseCode: z.string(), quantity: z.string(), unitCost: z.string(),
  lotNo: z.string().optional(), expiresOn: z.string().optional(),
})
export const openingImportInput = z.object({
  typeId: z.string().min(1, 'Elija el tipo de movimiento de inventario inicial.'),
  date, reference: z.string().optional(),
  rows: z.array(openingImportRow).min(1).max(5000), dryRun: z.boolean().default(false),
})

export type ImportProblem = { row: number; message: string }
export type ImportResult = {
  dryRun: boolean; accepted: number; problems: ImportProblem[]
  created?: number; updated?: number; documentIds?: string[]
}
