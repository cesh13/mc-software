import { Hono } from 'hono'
import type { ModuleEnv } from '@accounting/shared/server'
import accounts from './routes/accounts.js'
import budgetGroups from './routes/budget-groups.js'
import integrity from './routes/integrity.js'

// Mounted by the platform at /api/chart-of-accounts.
const router = new Hono<ModuleEnv>()

router.route('/accounts', accounts)
router.route('/budget-groups', budgetGroups)
router.route('/integrity', integrity)

export default router
