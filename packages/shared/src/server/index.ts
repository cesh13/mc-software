import { randomUUID } from 'node:crypto'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { createMiddleware } from 'hono/factory'
import { can, type Permission } from '../roles.js'

// Server-only helpers for modules. The web app must never import this file.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = BetterSQLite3Database<any>

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: string
}

export type AuditEntry = {
  module: string
  action: string
  entity?: string
  entityId?: string
  detail?: unknown
}

// What the platform puts on the Hono context before a module route runs.
export type ModuleEnv = {
  Variables: {
    db: Db
    user: CurrentUser
    // Active empresa, already checked against the empresas the user may use.
    empresaId: string
    // Appends to core_audit_log. Pass the transaction handle when inside one.
    audit: (entry: AuditEntry, tx?: Db) => void
  }
}

export function newId(): string {
  return randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

// Business-rule failure with a message meant for the end user (in Spanish).
// The platform turns it into a JSON response: { error, code }.
export class RuleError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
    public code?: string,
  ) {
    super(message)
  }
}

export const requirePermission = (permission: Permission) =>
  createMiddleware<ModuleEnv>(async (c, next) => {
    if (!can(c.get('user').role, permission)) {
      return c.json({ error: 'No tiene permiso para esta acción.' }, 403)
    }
    await next()
  })
