import { Hono } from 'hono'

const router = new Hono()

// GET  /api/chart-of-accounts        — list accounts
// POST /api/chart-of-accounts        — create account
// PATCH /api/chart-of-accounts/:id   — update account
// POST /api/chart-of-accounts/:id/deactivate — soft delete

export default router
