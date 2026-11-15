import { and, eq, isNull, or } from 'drizzle-orm'
import type { PermissionOverride } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { corePermissionOverrides as o } from '../db/schema.js'

// Overrides that can affect `userId`: global ones plus, when given, those of
// one empresa. Without `empresaId`, every override of the user.
export function loadOverrides(db: Db, userId: string, empresaId?: string | null): PermissionOverride[] {
  const scope = empresaId === undefined
    ? undefined
    : empresaId === null ? isNull(o.empresaId) : or(isNull(o.empresaId), eq(o.empresaId, empresaId))
  return db
    .select({ permission: o.permission, effect: o.effect, empresaId: o.empresaId })
    .from(o)
    .where(scope ? and(eq(o.userId, userId), scope) : eq(o.userId, userId))
    .all()
}
