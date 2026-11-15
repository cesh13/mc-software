import { RuleError } from '@accounting/shared/server'
import { GL_SOURCE_LABELS, MONTH_NAMES, isGeneratedSource, type EntryType } from '@accounting/shared'
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

export function sourceMessage(source: string): string {
  if (source === 'cierre') return 'Partida de cierre anual: anúlela y genere el cierre de nuevo.'
  if (isGeneratedSource(source)) {
    const name = GL_SOURCE_LABELS[source]
    return `Partida generada por ${name}: modifíquela o anúlela desde el módulo de ${name}.`
  }
  return 'La partida no se puede modificar aquí.'
}

// Only active, manual or imported entries are edited here.
export function assertEditable(row: EntryRow): void {
  if (!row.isActive) throw new RuleError('La partida está anulada.', 409, 'entry_voided')
  if (!(EDITABLE_SOURCES as readonly string[]).includes(row.source)) {
    throw new RuleError(sourceMessage(row.source), 409, 'entry_not_editable')
  }
}
