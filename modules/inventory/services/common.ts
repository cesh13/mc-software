import { and, eq } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import { coaAccountsRef as acc } from '../refs.js'
import type { Ctx } from '../lib/context.js'

export const notFound = (what: string) => new RuleError(`${what} no existe.`, 404, 'not_found')

// An account used by inventory must be a detail, active account of the empresa.
export function assertAccount(ctx: Ctx, accountId: string | null | undefined, label: string): void {
  if (!accountId) return
  const row = ctx.db.select().from(acc).where(and(eq(acc.id, accountId), eq(acc.empresaId, ctx.empresaId))).get()
  if (!row) throw new RuleError(`La ${label} no existe en el catálogo de esta empresa.`, 400, 'account_invalid')
  if (!row.isDetail) throw new RuleError(`La ${label} (${row.code}) no es de detalle.`, 400, 'account_invalid')
  if (!row.isActive) throw new RuleError(`La ${label} (${row.code}) está inactiva.`, 400, 'account_invalid')
}

export function accountCodes(ctx: Ctx): Map<string, { code: string; name: string }> {
  const rows = ctx.db.select({ id: acc.id, code: acc.code, name: acc.name }).from(acc)
    .where(eq(acc.empresaId, ctx.empresaId)).all()
  return new Map(rows.map((r) => [r.id, { code: r.code, name: r.name }]))
}

export const duplicate = (what: string, code: string) =>
  new RuleError(`Ya existe ${what} con el código ${code}.`, 409, 'code_duplicate')

// SQLite UNIQUE violation → friendly duplicate error.
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/.test(e.message)
}
