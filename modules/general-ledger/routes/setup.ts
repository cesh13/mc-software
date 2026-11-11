import { Hono } from 'hono'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import {
  costCenterInput,
  costCenterUpdate,
  entryTypeInput,
  entryTypeUpdate,
  fiscalYearInput,
  nextNumberQuery,
} from '@accounting/shared'
import { ctxOf } from '../lib/context.js'
import * as types from '../services/entry-types.js'
import * as centers from '../services/cost-centers.js'
import * as years from '../services/fiscal-years.js'

const router = new Hono<ModuleEnv>()
const includeInactive = (v: string | undefined) => v === 'true' || v === '1'
const periodQuery = nextNumberQuery.pick({ period: true })

// Entry types (comprobantes).
router.get('/entry-types', (c) =>
  c.json(types.listEntryTypes(ctxOf(c), includeInactive(c.req.query('includeInactive')))),
)
router.post('/entry-types', requirePermission('capture'), async (c) =>
  c.json(types.createEntryType(ctxOf(c), entryTypeInput.parse(await c.req.json())), 201),
)
router.patch('/entry-types/:id', requirePermission('capture'), async (c) =>
  c.json(types.updateEntryType(ctxOf(c), c.req.param('id'), entryTypeUpdate.parse(await c.req.json()))),
)
router.post('/entry-types/:id/deactivate', requirePermission('capture'), (c) =>
  c.json(types.deactivateEntryType(ctxOf(c), c.req.param('id'))),
)

// Cost centers.
router.get('/cost-centers', (c) =>
  c.json(centers.listCostCenters(ctxOf(c), includeInactive(c.req.query('includeInactive')))),
)
router.post('/cost-centers', requirePermission('capture'), async (c) =>
  c.json(centers.createCostCenter(ctxOf(c), costCenterInput.parse(await c.req.json())), 201),
)
router.patch('/cost-centers/:id', requirePermission('capture'), async (c) =>
  c.json(centers.updateCostCenter(ctxOf(c), c.req.param('id'), costCenterUpdate.parse(await c.req.json()))),
)
router.post('/cost-centers/:id/deactivate', requirePermission('capture'), (c) =>
  c.json(centers.deactivateCostCenter(ctxOf(c), c.req.param('id'))),
)

// Fiscal years.
router.get('/fiscal-years', (c) => c.json(years.listFiscalYears(ctxOf(c))))
router.get('/fiscal-years/for-period', (c) =>
  c.json(years.fiscalYearOf(ctxOf(c), periodQuery.parse(c.req.query()).period)),
)
router.post('/fiscal-years', requirePermission('supervise'), async (c) =>
  c.json(years.createFiscalYear(ctxOf(c), fiscalYearInput.parse(await c.req.json())), 201),
)

export default router
