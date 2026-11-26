import { Decimal } from 'decimal.js'
import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import {
  isQty, itemInput, toQty, type ImportProblem, type ImportResult, type itemImportInput, type openingImportInput,
} from '@accounting/shared'
import { RuleError } from '@accounting/shared/server'
import { invGroups as g, invWarehouses as w } from '../schema.js'
import { inTx, type Ctx } from '../lib/context.js'
import { movementTypes } from './catalogs.js'
import { createItem, itemByCode, updateItem } from './items.js'
import { createDocument } from './documents-write.js'

// Bulk loads pasted from a spreadsheet. All or nothing: any problem rejects the
// whole load; `dryRun` only reports. Row numbers are 1-based, as on the sheet.

// '1,234.50' → '1234.50'; '12,5' → '12.5'.
export function parseNumber(raw: string): string | null {
  let v = raw.trim().replace(/\s/g, '')
  if (v.includes(',') && v.includes('.')) v = v.replace(/,/g, '')
  else if (v.includes(',')) v = v.replace(',', '.')
  return isQty(v) ? v : null
}

const byCode = <T extends { code: string }>(rows: T[]) => new Map(rows.map((r) => [r.code.toUpperCase(), r]))

export function importItems(ctx: Ctx, input: z.output<typeof itemImportInput>): ImportResult {
  const groups = byCode(ctx.db.select().from(g).where(eq(g.empresaId, ctx.empresaId)).all())
  const problems: ImportProblem[] = []
  const ok: { n: number; value: z.output<typeof itemInput> }[] = []
  const seen = new Set<string>()
  input.rows.forEach((r, idx) => {
    const n = idx + 1
    const group = r.groupCode?.trim() ? groups.get(r.groupCode.trim().toUpperCase()) : undefined
    if (r.groupCode?.trim() && !group) return problems.push({ row: n, message: `El grupo ${r.groupCode} no existe.` })
    const parsed = itemInput.safeParse({
      code: r.code, name: r.name, groupId: group?.id ?? null, unit: r.unit?.trim() || 'UNIDAD',
      isService: r.isService ?? false, tracksLots: r.tracksLots ?? false,
    })
    if (!parsed.success) return problems.push({ row: n, message: parsed.error.issues[0]?.message ?? 'Fila inválida.' })
    if (seen.has(parsed.data.code)) return problems.push({ row: n, message: `El código ${parsed.data.code} está repetido en la lista.` })
    seen.add(parsed.data.code)
    ok.push({ n, value: parsed.data })
  })
  const result: ImportResult = { dryRun: input.dryRun, accepted: ok.length, problems }
  if (input.dryRun || problems.length) return result
  let created = 0
  let updated = 0
  inTx(ctx, (tx) => {
    for (const { value } of ok) {
      const existing = itemByCode(tx, value.code)
      if (existing) {
        updateItem(tx, existing.id, { name: value.name, unit: value.unit, ...(value.groupId ? { groupId: value.groupId } : {}) })
        updated++
      } else {
        createItem(tx, value)
        created++
      }
    }
  })
  return { ...result, created, updated }
}

const CHUNK = 500

export function importOpening(ctx: Ctx, input: z.output<typeof openingImportInput>): ImportResult {
  const type = movementTypes.get(ctx, input.typeId)
  if (type.kind !== 'inicial') {
    throw new RuleError('Elija un tipo de movimiento de clase "Inventario inicial".', 400, 'type_invalid')
  }
  const whs = byCode(ctx.db.select().from(w).where(and(eq(w.empresaId, ctx.empresaId), eq(w.isActive, true))).all())
  const problems: ImportProblem[] = []
  const byWarehouse = new Map<string, { itemId: string; quantity: string; unitCost: string; lotNo: string | null; expiresOn: string | null }[]>()
  input.rows.forEach((r, idx) => {
    const n = idx + 1
    const item = itemByCode(ctx, r.itemCode.trim())
    if (!item) return problems.push({ row: n, message: `El producto ${r.itemCode} no existe.` })
    if (item.isService) return problems.push({ row: n, message: `${item.code} es un servicio.` })
    const wh = whs.get(r.warehouseCode.trim().toUpperCase())
    if (!wh) return problems.push({ row: n, message: `La bodega ${r.warehouseCode} no existe o está inactiva.` })
    const quantity = parseNumber(r.quantity)
    if (!quantity || !new Decimal(quantity).gt(0)) return problems.push({ row: n, message: 'Cantidad inválida (debe ser mayor que cero).' })
    const unitCost = parseNumber(r.unitCost)
    if (!unitCost || unitCost.startsWith('-')) return problems.push({ row: n, message: 'Costo unitario inválido.' })
    const lotNo = r.lotNo?.trim() || null
    if (item.tracksLots && !lotNo) return problems.push({ row: n, message: `${item.code} lleva lote; escriba el lote.` })
    const expiresOn = r.expiresOn?.trim() || null
    if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return problems.push({ row: n, message: 'Vencimiento inválido (AAAA-MM-DD).' })
    const list = byWarehouse.get(wh.id) ?? []
    list.push({ itemId: item.id, quantity: toQty(quantity), unitCost, lotNo, expiresOn })
    byWarehouse.set(wh.id, list)
  })
  const accepted = input.rows.length - problems.length
  const result: ImportResult = { dryRun: input.dryRun, accepted, problems }
  if (input.dryRun || problems.length) return result
  const documentIds: string[] = []
  inTx(ctx, (tx) => {
    for (const [warehouseId, lines] of byWarehouse) {
      for (let k = 0; k < lines.length; k += CHUNK) {
        documentIds.push(createDocument(tx, {
          typeId: type.id, date: input.date, warehouseId, reference: input.reference ?? 'Inventario inicial',
          lines: lines.slice(k, k + CHUNK),
        }))
      }
    }
  })
  return { ...result, created: documentIds.length, documentIds }
}
