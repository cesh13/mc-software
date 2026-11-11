import { Hono } from 'hono'
import { RuleError, requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { isPeriod, periodsQuery } from '@accounting/shared'
import { ctxOf } from '../lib/context.js'
import { respond } from '../lib/errors.js'
import { closePeriod, listPeriods, reopenPeriod } from '../services/periods.js'

const router = new Hono<ModuleEnv>()

function periodParam(value: string): string {
  if (!isPeriod(value)) throw new RuleError('Período inválido (AAAA-MM).', 400, 'invalid_period')
  return value
}

router.get('/periods', (c) => c.json(listPeriods(ctxOf(c), periodsQuery.parse(c.req.query()).year)))
router.post('/periods/:period/close', requirePermission('supervise'), (c) =>
  respond(c, () => closePeriod(ctxOf(c), periodParam(c.req.param('period')))),
)
router.post('/periods/:period/reopen', requirePermission('supervise'), (c) =>
  c.json(reopenPeriod(ctxOf(c), periodParam(c.req.param('period')))),
)

export default router
