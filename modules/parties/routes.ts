import { Hono } from 'hono'
import type { ModuleEnv } from '@accounting/shared/server'
import parties from './routes/parties.js'

// Mounted by the platform at /api/parties.
const router = new Hono<ModuleEnv>()

router.route('/parties', parties)

export default router
