import { Hono } from 'hono'

const router = new Hono()

// GET  /api/inventory/items    — list items
// POST /api/inventory/items    — create item
// PATCH /api/inventory/items/:id
// POST /api/inventory/transactions — record stock movement

export default router
