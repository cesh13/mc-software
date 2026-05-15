import { Hono } from 'hono'

const router = new Hono()

// Employees: GET /api/payroll/employees, POST, PATCH /:id
// Pay runs:  GET /api/payroll/runs, POST, POST /:id/approve

export default router
