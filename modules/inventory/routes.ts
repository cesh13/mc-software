import { Hono } from 'hono'
import type { ModuleEnv } from '@accounting/shared/server'
import { groupsRouter, movementTypesRouter, warehousesRouter } from './routes/catalogs.js'
import documents from './routes/documents.js'
import imports from './routes/imports.js'
import items from './routes/items.js'
import periods from './routes/periods.js'
import reports from './routes/reports.js'

// Mounted by the platform at /api/inventory.
const router = new Hono<ModuleEnv>()

router.route('/warehouses', warehousesRouter)
router.route('/groups', groupsRouter)
router.route('/movement-types', movementTypesRouter)
router.route('/items', items)
router.route('/documents', documents)
router.route('/reports', reports)
router.route('/periods', periods)
router.route('/imports', imports)

export default router
