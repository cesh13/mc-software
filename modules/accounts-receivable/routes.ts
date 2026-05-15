import { Hono } from 'hono'

const router = new Hono()

// Customers: GET /api/accounts-receivable/customers, POST, PATCH /:id
// Invoices:  GET /api/accounts-receivable/invoices, POST, PATCH /:id
// Payments:  POST /api/accounts-receivable/payments

export default router
