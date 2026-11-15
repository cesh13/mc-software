import { and, eq } from 'drizzle-orm'
import { seesAllEmpresas } from '@accounting/shared'
import { RuleError, type CurrentUser, type Db } from '@accounting/shared/server'
import { coreEmpresas, coreUserEmpresas } from '../db/schema.js'

// Throws unless the empresa exists and the user may work in it (owner: always).
export function requireEmpresaAccess(db: Db, user: CurrentUser, empresaId: string): void {
  const empresa = db.select({ id: coreEmpresas.id }).from(coreEmpresas).where(eq(coreEmpresas.id, empresaId)).get()
  if (!empresa) throw new RuleError('La empresa no existe.', 404, 'empresa_not_found')
  if (seesAllEmpresas(user.role)) return
  const grant = db
    .select({ userId: coreUserEmpresas.userId })
    .from(coreUserEmpresas)
    .where(and(eq(coreUserEmpresas.userId, user.id), eq(coreUserEmpresas.empresaId, empresaId)))
    .get()
  if (!grant) throw new RuleError('No tiene acceso a esta empresa.', 403, 'empresa_forbidden')
}
