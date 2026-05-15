import { Hono } from 'hono'

const router = new Hono()

// GET  /api/fixed-assets/assets     — list assets
// POST /api/fixed-assets/assets     — add asset
// PATCH /api/fixed-assets/assets/:id
// POST /api/fixed-assets/assets/:id/dispose

export default router
