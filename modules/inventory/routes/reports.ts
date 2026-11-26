import { Hono } from 'hono'
import { kardexQuery, stockQuery, valuationQuery } from '@accounting/shared'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import { ctxOf } from '../lib/context.js'
import { kardexReport, redactKardex } from '../services/kardex.js'
import { stockReport, valuationReport } from '../services/reports.js'

const router = new Hono<ModuleEnv>()

router.get('/stock', requirePermission('inv.report.view'), (c) =>
  c.json(stockReport(ctxOf(c), stockQuery.parse(c.req.query()))))

router.get('/kardex', requirePermission('inv.report.view'), (c) => {
  const ctx = ctxOf(c)
  const k = kardexReport(ctx, kardexQuery.parse(c.req.query()))
  return c.json(ctx.can('inv.cost.view') ? k : redactKardex(k))
})

router.get('/valuation', requirePermission('inv.cost.view'), (c) =>
  c.json(valuationReport(ctxOf(c), valuationQuery.parse(c.req.query()))))

export default router
