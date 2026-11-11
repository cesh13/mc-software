import { RuleError } from '@accounting/shared/server'
import type { entryLineInput } from '@accounting/shared'
import type { z } from 'zod'
import { toCents, normalizeMoney } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { findAccount, type Account } from './accounts.js'
import { findCostCenter } from './cost-centers.js'

export type LineInput = z.output<typeof entryLineInput>

export type NormalizedLine = {
  lineNo: number
  accountId: string
  costCenterId: string | null
  detail: string
  debit: string
  credit: string
  collectDate: string | null
}

function fail(lineNo: number, message: string, code: string, status: 400 | 404 = 400): never {
  throw new RuleError(`Línea ${lineNo}: ${message}`, status, code)
}

// Validates the lines of an entry against the chart of accounts and the
// cost centers of the empresa, and returns them normalized (2-decimal
// amounts, default detail, line numbers 1..n).
export function validateLines(
  ctx: Ctx,
  lines: LineInput[],
  concept: string,
  allowZeroLines: boolean,
): NormalizedLine[] {
  if (lines.length === 0) {
    throw new RuleError('La partida debe tener al menos una línea.', 400, 'no_lines')
  }
  const accounts = new Map<string, Account | undefined>()
  const centers = new Map<string, boolean>()
  let previousDetail = ''

  return lines.map((line, i) => {
    const lineNo = i + 1
    if (!accounts.has(line.accountId)) accounts.set(line.accountId, findAccount(ctx, line.accountId))
    const account = accounts.get(line.accountId)
    if (!account) fail(lineNo, 'La cuenta no existe.', 'account_not_found', 404)
    if (!account.isActive) fail(lineNo, `La cuenta ${account.code} está inactiva.`, 'account_inactive')
    if (!account.isDetail) {
      fail(lineNo, `Cuenta ${account.code} no es de detalle.`, 'account_not_detail')
    }

    const costCenterId = line.costCenterId ?? null
    if (account.requiresCostCenter) {
      if (!costCenterId) {
        fail(lineNo, `La cuenta ${account.code} exige centro de costo.`, 'cost_center_required')
      }
      if (!centers.has(costCenterId)) {
        const cc = findCostCenter(ctx, costCenterId)
        centers.set(costCenterId, !!cc && cc.isActive)
      }
      if (!centers.get(costCenterId)) {
        fail(lineNo, 'El centro de costo no existe o está inactivo.', 'cost_center_not_found', 404)
      }
    } else if (costCenterId) {
      fail(lineNo, `La cuenta ${account.code} no usa centro de costo.`, 'cost_center_not_allowed')
    }

    const debit = toCents(line.debit)
    const credit = toCents(line.credit)
    if (debit < 0n || credit < 0n) fail(lineNo, 'Los montos no pueden ser negativos.', 'negative_amount')
    if (debit > 0n && credit > 0n) {
      fail(lineNo, 'Una línea lleva cargo o abono, no ambos.', 'debit_and_credit')
    }
    if (debit === 0n && credit === 0n && !allowZeroLines) {
      fail(lineNo, 'La línea no tiene cargo ni abono.', 'zero_line')
    }

    const detail = line.detail || concept || previousDetail
    if (!detail) fail(lineNo, 'El detalle es obligatorio.', 'detail_required')
    previousDetail = detail

    return {
      lineNo,
      accountId: account.accountId,
      costCenterId,
      detail,
      debit: normalizeMoney(line.debit),
      credit: normalizeMoney(line.credit),
      collectDate: line.collectDate ?? null,
    }
  })
}
