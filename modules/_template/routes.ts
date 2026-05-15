import { Hono } from 'hono'

const router = new Hono()

// Mount under /api/{module-id}/*
// requireAuth and requireRole are imported from the platform:
//   import { requireAuth, requireRole } from '../../apps/api/src/middleware/auth.js'

export default router
