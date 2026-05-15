import { Hono } from 'hono'

const router = new Hono()

// Vendors: GET /api/accounts-payable/vendors, POST, PATCH /:id
// Invoices: GET /api/accounts-payable/invoices, POST, PATCH /:id
// Payments: POST /api/accounts-payable/payments

export default router
