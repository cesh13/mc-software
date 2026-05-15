import { Hono } from 'hono'

const router = new Hono()

// GET  /api/general-ledger/periods          — fiscal periods
// POST /api/general-ledger/entries          — create journal entry
// GET  /api/general-ledger/entries          — list entries
// GET  /api/general-ledger/trial-balance    — trial balance report

export default router
