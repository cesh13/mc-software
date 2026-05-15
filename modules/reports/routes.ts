import { Hono } from 'hono'

const router = new Hono()

// GET /api/reports/balance-sheet?periodId=...
// GET /api/reports/income-statement?periodId=...
// GET /api/reports/trial-balance?periodId=...
// GET /api/reports/saved       — list saved report definitions
// POST /api/reports/saved      — save a report definition

export default router
