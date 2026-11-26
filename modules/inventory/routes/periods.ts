import { Hono } from 'hono'
import { isPeriod, periodsQuery, reopenPeriodInput } from '@accounting/shared'
import { RuleError, requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf, inTx, periodsOf } from '../lib/context.js'

const router = new Hono<ModuleEnv>()

function periodParam(value: string): string {
  if (!isPeriod(value)) throw new RuleError('Período inválido (AAAA-MM).', 400, 'invalid_period')
  return value
}

// The twelve months of a year with the inventory area's state (core_periods).
router.get('/', requirePermission('inv.period.view'), (c) => {
  const { year } = periodsQuery.parse(c.req.query())
  const ctx = ctxOf(c)
  const rows = new Map(periodsOf(ctx).list('inventory', year).map((r) => [r.period, r]))
  return c.json(Array.from({ length: 12 }, (_, k) => {
    const period = `${year}-${String(k + 1).padStart(2, '0')}`
    const r = rows.get(period)
    return { period, status: r?.status ?? 'open', closedAt: r?.closedAt ?? null, closedBy: r?.closedBy ?? null }
  }))
})

router.post('/:period/close', requirePermission('inv.period.close'), (c) => {
  const ctx = ctxOf(c)
  const period = periodParam(c.req.param('period'))
  return c.json(inTx(ctx, (tx) => periodsOf(tx).close(period, 'inventory')))
})

router.post('/:period/reopen', requirePermission('inv.period.reopen'), async (c) => {
  const ctx = ctxOf(c)
  const period = periodParam(c.req.param('period'))
  const { reason } = reopenPeriodInput.parse(await c.req.json().catch(() => ({})))
  return c.json(inTx(ctx, (tx) => periodsOf(tx).reopen(period, 'inventory', reason)))
})

export default router
