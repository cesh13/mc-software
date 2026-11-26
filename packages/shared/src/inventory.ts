// Request/response contracts for inventory (docs/sistema/contratos.md §3).
// Browser-safe: only zod, decimal.js and other shared files.
import { Decimal } from 'decimal.js'
import { z } from 'zod'

// Quantities and unit costs keep five decimals (legacy N13.5 / N12.5); totals are money (two).
export const QTY_PLACES = 5
export type Qty = string

export function toQty(value: Decimal.Value): Qty {
  return new Decimal(value).toFixed(QTY_PLACES, Decimal.ROUND_HALF_UP)
}
export const ZERO_QTY: Qty = toQty(0)

const QTY_RE = /^-?\d+(\.\d{1,5})?$/
export const isQty = (v: unknown): v is Qty => typeof v === 'string' && QTY_RE.test(v)

// ── Catalogs ────────────────────────────────────────────────────────────

export const INV_DIRECTIONS = ['in', 'out', 'transfer'] as const
export type InvDirection = (typeof INV_DIRECTIONS)[number]
export const INV_DIRECTION_LABELS: Record<InvDirection, string> = {
  in: 'Entrada', out: 'Salida', transfer: 'Transferencia',
}

// What a movement type is for. Decides defaults (counter account, cost capture).
export const INV_KINDS = ['inicial', 'compra', 'ajuste', 'consumo', 'venta', 'transferencia', 'otro'] as const
export type InvKind = (typeof INV_KINDS)[number]
export const INV_KIND_LABELS: Record<InvKind, string> = {
  inicial: 'Inventario inicial', compra: 'Compra', ajuste: 'Ajuste', consumo: 'Consumo interno',
  venta: 'Venta (registrada aquí)', transferencia: 'Transferencia', otro: 'Otro',
}

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Escriba ${label}.`).max(max, `${label} admite hasta ${max} caracteres.`)
const optionalText = (max: number) =>
  z.string().trim().max(max, `Admite hasta ${max} caracteres.`).transform((v) => (v === '' ? null : v)).nullish()
const optionalId = z.string().trim().transform((v) => (v === '' ? null : v)).nullish()
const code = (max: number) =>
  text('el código', max).transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9._/-]+$/.test(v), 'El código solo admite letras, dígitos y . _ / -')

const qtyText = (label: string) =>
  z.string().trim().refine(isQty, `${label}: cantidad inválida (hasta ${QTY_PLACES} decimales).`).transform(toQty)

export const warehouseInput = z.object({
  code: code(5), name: text('el nombre', 60), address: optionalText(120),
})
export const groupInput = z.object({
  code: code(10), name: text('el nombre', 60),
  inventoryAccountId: optionalId, cogsAccountId: optionalId,
})
export const itemInput = z.object({
  code: code(20),
  name: text('la descripción', 120),
  groupId: optionalId,
  unit: text('la unidad', 20).default('UNIDAD'),
  barcode: optionalText(40),
  isService: z.boolean().default(false),
  tracksLots: z.boolean().default(false),
  minQty: qtyText('Mínimo').nullish(),
  maxQty: qtyText('Máximo').nullish(),
  inventoryAccountId: optionalId,
  cogsAccountId: optionalId,
})
export const itemUpdate = itemInput.partial()
export const movementTypeInput = z.object({
  code: code(3), name: text('el nombre', 60),
  direction: z.enum(INV_DIRECTIONS), kind: z.enum(INV_KINDS),
  counterAccountId: optionalId,
})

export type Warehouse = z.output<typeof warehouseInput> & { id: string; isActive: boolean }
export type ItemGroup = z.output<typeof groupInput> & { id: string; isActive: boolean }
export type MovementType = z.output<typeof movementTypeInput> & { id: string; isActive: boolean }
export type Item = z.output<typeof itemInput> & {
  id: string; isActive: boolean; groupCode: string | null; groupName: string | null
}

export const itemListQuery = z.object({
  q: z.string().trim().optional(),
  groupId: z.string().optional(),
  inactive: z.enum(['0', '1']).optional(),
})

// ── Documents ───────────────────────────────────────────────────────────

export const documentLineInput = z.object({
  itemId: z.string().min(1, 'Elija el producto.'),
  quantity: qtyText('Cantidad').refine((v) => new Decimal(v).gt(0), 'La cantidad debe ser mayor que cero.'),
  // Entries only (salidas are valued at the average cost).
  unitCost: qtyText('Costo').refine((v) => new Decimal(v).gte(0), 'El costo no puede ser negativo.').nullish(),
  lotNo: optionalText(30),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento inválida.').nullish(),
})
export const documentInput = z.object({
  typeId: z.string().min(1, 'Elija el tipo de movimiento.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD).'),
  warehouseId: z.string().min(1, 'Elija la bodega.'),
  destWarehouseId: optionalId,
  partyId: optionalId,
  reference: optionalText(40),
  notes: optionalText(250),
  // Only honoured with the inv.stock.negative permission.
  allowNegative: z.boolean().optional(),
  lines: z.array(documentLineInput).min(1, 'Agregue al menos una línea.').max(500),
})
export type DocumentInput = z.input<typeof documentInput>
export const voidDocumentInput = z.object({ reason: text('el motivo', 200) })

export const documentListQuery = z.object({
  from: z.string().optional(), to: z.string().optional(),
  typeId: z.string().optional(), warehouseId: z.string().optional(), itemId: z.string().optional(),
})

export type InvDocumentStatus = 'aplicado' | 'anulado'
export type InvDocumentLine = {
  lineNo: number; itemId: string; itemCode: string; itemName: string; unit: string
  quantity: Qty; unitCost: string; totalCost: string; lotNo: string | null; expiresOn: string | null
}
export type InvDocument = {
  id: string; typeId: string; typeCode: string; typeName: string; direction: InvDirection; kind: InvKind
  number: string; date: string; warehouseId: string; warehouseCode: string
  destWarehouseId: string | null; destWarehouseCode: string | null
  partyId: string | null; partyName: string | null; reference: string | null; notes: string | null
  status: InvDocumentStatus; totalCost: string; voidReason: string | null
  entry: { entryId: string; number: string; period: string } | null
  lines: InvDocumentLine[]
}
export type InvDocumentSummary = Omit<InvDocument, 'lines' | 'entry'> & { lineCount: number }
