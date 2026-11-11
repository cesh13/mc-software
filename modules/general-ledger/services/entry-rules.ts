import { RuleError } from '@accounting/shared/server'
import { MONTH_NAMES, type EntryType } from '@accounting/shared'
import { DetailedRuleError } from '../lib/errors.js'
import type { EntryRow } from './entry-detail.js'
import { EDITABLE_SOURCES } from './entry-detail.js'
import { getEntryType } from './entry-types.js'
import type { Ctx } from '../lib/context.js'

// Rules shared by every write on journal entries.

export function assertDateInPeriod(date: string, period: string): void {
  const year = period.slice(0, 4)
  if (date.slice(0, 4) !== year) {
    throw new RuleError(`Año incorrecto. Debe ser ${year}.`, 400, 'wrong_year')
  }
  if (date.slice(5, 7) !== period.slice(5, 7)) {
    const month = MONTH_NAMES[Number(period.slice(5, 7)) - 1]
    throw new RuleError(`Mes incorrecto. Debe ser ${month}.`, 400, 'wrong_month')
  }
}

export function activeEntryType(ctx: Ctx, id: string): EntryType {
  const type = getEntryType(ctx, id)
  if (!type.isActive) {
    throw new RuleError(`El tipo de partida ${type.code} está inactivo.`, 400, 'entry_type_inactive')
  }
  return type
}

export function unbalancedError(totals: { debit: string; credit: string; difference: string }) {
  const abs = totals.difference.replace('-', '')
  return new DetailedRuleError(
    `La partida NO CUADRA por ${abs}. Corrija los montos o guárdela como borrador.`,
    409,
    'unbalanced',
    { difference: totals.difference, debit: totals.debit, credit: totals.credit },
  )
}

const SOURCE_MESSAGES: Record<string, string> = {
  bancos: 'Partida generada por Bancos: modifíquela desde el módulo de Bancos.',
  iva: 'Partida generada por IVA: modifíquela desde el módulo de IVA.',
  cierre: 'Partida de cierre anual: anúlela y genere el cierre de nuevo.',
}

// Only active, manual or imported entries are edited here.
export function assertEditable(row: EntryRow): void {
  if (!row.isActive) throw new RuleError('La partida está anulada.', 409, 'entry_voided')
  if (!(EDITABLE_SOURCES as readonly string[]).includes(row.source)) {
    throw new RuleError(
      SOURCE_MESSAGES[row.source] ?? 'La partida no se puede modificar aquí.',
      409,
      'entry_not_editable',
    )
  }
}
