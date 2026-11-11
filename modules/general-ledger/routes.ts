import { Hono } from 'hono'
import type { ModuleEnv } from '@accounting/shared/server'
import setup from './routes/setup.js'
import periods from './routes/periods.js'
import entries from './routes/entries.js'
import reports from './routes/reports.js'

// Mounted at /api/general-ledger. Routers are thin; rules live in services/.
const router = new Hono<ModuleEnv>()
router.route('/', setup)
router.route('/', periods)
router.route('/', entries)
router.route('/', reports)

export default router
