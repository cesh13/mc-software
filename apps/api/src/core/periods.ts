import { and, eq, like } from 'drizzle-orm'
import {
  PERIOD_AREA_LABELS, REOPEN_REASON_MIN, isPeriod, periodLabel,
  type PeriodArea, type PeriodStateRow, type PeriodStatus,
} from '@accounting/shared'
import { RuleError, newId, nowIso, type PeriodsService, type ServiceContext } from '@accounting/shared/server'
import { corePeriods as p } from '../db/schema.js'

const toPeriod = (v: string): string => {
  const period = v.slice(0, 7)
  if (!isPeriod(period)) throw new RuleError('Período inválido (AAAA-MM).', 400, 'invalid_period')
  return period
}

const ACTIONS: Record<PeriodStatus, string> = { closed: 'cerrar_mes', open: 'abrir_mes', filed: 'presentar_mes' }

type Row = typeof p.$inferSelect
const view = (r: Row): PeriodStateRow => ({
  area: r.area as PeriodArea, period: r.period, status: r.status, closedBy: r.closedBy, closedAt: r.closedAt,
  reopenedBy: r.reopenedBy, reopenedAt: r.reopenedAt, reopenReason: r.reopenReason,
})

// Implementation of the `periods` contract (contratos.md §2) over core_periods.
export function periodsService(ctx: ServiceContext): PeriodsService {
  const find = (period: string, area: PeriodArea) =>
    ctx.db.select().from(p)
      .where(and(eq(p.empresaId, ctx.empresaId), eq(p.area, area), eq(p.period, period))).get()

  const upsert = (period: string, area: PeriodArea, set: Partial<Row> & { status: PeriodStatus }) => {
    const now = nowIso()
    const row = find(period, area)
    if (row) ctx.db.update(p).set({ ...set, updatedAt: now }).where(eq(p.id, row.id)).run()
    else ctx.db.insert(p).values({ id: newId(), empresaId: ctx.empresaId, area, period, ...set, updatedAt: now }).run()
    const saved = view(find(period, area)!)
    ctx.audit({ module: 'core', action: ACTIONS[set.status], entity: 'period', entityId: period, detail: { area, ...set } }, ctx.db)
    return saved
  }

  const status = (periodOrDate: string, area: PeriodArea): PeriodStatus => find(toPeriod(periodOrDate), area)?.status ?? 'open'

  return {
    status,
    assertOpen(periodOrDate, areas) {
      const period = toPeriod(periodOrDate)
      for (const area of areas) {
        if (status(period, area) !== 'open') {
          const where = area === 'gl' ? '' : ` en ${PERIOD_AREA_LABELS[area]}`
          throw new RuleError(`El mes ${periodLabel(period)} está cerrado${where}; solo se puede consultar.`, 409, 'period_closed')
        }
      }
    },
    close(period, area) {
      period = toPeriod(period)
      if (status(period, area) !== 'open') {
        throw new RuleError(`El mes ${periodLabel(period)} ya está cerrado.`, 409, 'period_already_closed')
      }
      return upsert(period, area, { status: 'closed', closedBy: ctx.userId, closedAt: nowIso() })
    },
    reopen(period, area, reason) {
      period = toPeriod(period)
      const current = status(period, area)
      if (current === 'open') throw new RuleError(`El mes ${periodLabel(period)} no está cerrado.`, 409, 'period_not_closed')
      if (current === 'filed') throw new RuleError(`El mes ${periodLabel(period)} ya fue presentado.`, 409, 'period_filed')
      const text = reason.trim()
      if (text.length < REOPEN_REASON_MIN) {
        throw new RuleError(`Indique el motivo para abrir el mes (al menos ${REOPEN_REASON_MIN} caracteres).`, 400, 'reopen_reason_required')
      }
      return upsert(period, area, { status: 'open', reopenedBy: ctx.userId, reopenedAt: nowIso(), reopenReason: text })
    },
    markFiled(period, area, ref) {
      period = toPeriod(period)
      if (status(period, area) !== 'closed') {
        throw new RuleError(`Cierre el mes ${periodLabel(period)} antes de marcarlo como presentado.`, 409, 'period_not_closed')
      }
      return upsert(period, area, { status: 'filed', filedRef: ref })
    },
    list(area, year) {
      return ctx.db.select().from(p)
        .where(and(eq(p.empresaId, ctx.empresaId), eq(p.area, area), like(p.period, `${year}-%`)))
        .orderBy(p.period).all().map(view)
    },
  }
}
