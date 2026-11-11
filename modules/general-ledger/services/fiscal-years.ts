import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { RuleError, newId, nowIso } from '@accounting/shared/server'
import { addMonths, fiscalYearInput, type FiscalYear } from '@accounting/shared'
import type { z } from 'zod'
import { glFiscalYears } from '../schema.js'
import { auditIn, inTx, type Ctx } from '../lib/context.js'

const cols = {
  id: glFiscalYears.id,
  name: glFiscalYears.name,
  startPeriod: glFiscalYears.startPeriod,
  endPeriod: glFiscalYears.endPeriod,
}

export function listFiscalYears(ctx: Ctx): FiscalYear[] {
  return ctx.db
    .select(cols)
    .from(glFiscalYears)
    .where(eq(glFiscalYears.empresaId, ctx.empresaId))
    .orderBy(asc(glFiscalYears.startPeriod))
    .all()
}

export function getFiscalYear(ctx: Ctx, id: string): FiscalYear {
  const row = ctx.db
    .select(cols)
    .from(glFiscalYears)
    .where(and(eq(glFiscalYears.id, id), eq(glFiscalYears.empresaId, ctx.empresaId)))
    .get()
  if (!row) throw new RuleError('El año fiscal no existe.', 404, 'fiscal_year_not_found')
  return row
}

// The fiscal year that contains `period`. Without a row, the calendar year
// (January–December) is the fiscal year.
export function fiscalYearOf(ctx: Ctx, period: string): FiscalYear {
  const row = ctx.db
    .select(cols)
    .from(glFiscalYears)
    .where(
      and(
        eq(glFiscalYears.empresaId, ctx.empresaId),
        lte(glFiscalYears.startPeriod, period),
        gte(glFiscalYears.endPeriod, period),
      ),
    )
    .get()
  if (row) return row
  const year = period.slice(0, 4)
  return { id: null, name: `Ejercicio ${year}`, startPeriod: `${year}-01`, endPeriod: `${year}-12` }
}

export function createFiscalYear(ctx: Ctx, input: z.output<typeof fiscalYearInput>): FiscalYear {
  const startPeriod = input.startPeriod
  const endPeriod = input.endPeriod ?? addMonths(startPeriod, 11)
  if (endPeriod < startPeriod) {
    throw new RuleError('El período final es anterior al inicial.', 400, 'fiscal_year_invalid_range')
  }
  if (endPeriod > addMonths(startPeriod, 23)) {
    throw new RuleError('Un año fiscal no puede durar más de 24 meses.', 400, 'fiscal_year_too_long')
  }
  const overlap = ctx.db
    .select(cols)
    .from(glFiscalYears)
    .where(
      and(
        eq(glFiscalYears.empresaId, ctx.empresaId),
        lte(glFiscalYears.startPeriod, endPeriod),
        gte(glFiscalYears.endPeriod, startPeriod),
      ),
    )
    .get()
  if (overlap) {
    throw new RuleError(
      `Se traslapa con el año fiscal ${overlap.name} (${overlap.startPeriod} a ${overlap.endPeriod}).`,
      409,
      'fiscal_year_overlap',
    )
  }
  const name = input.name ?? `Ejercicio ${startPeriod.slice(0, 4)}`
  const id = newId()
  const now = nowIso()
  inTx(ctx, (tx) => {
    tx.db.insert(glFiscalYears)
      .values({ id, empresaId: ctx.empresaId, name, startPeriod, endPeriod, createdAt: now, updatedAt: now })
      .run()
    auditIn(tx, 'crear', 'fiscal_year', id, { name, startPeriod, endPeriod })
  })
  return getFiscalYear(ctx, id)
}
