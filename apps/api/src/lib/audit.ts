import { newId, nowIso, type AuditEntry, type Db } from '@accounting/shared/server'
import { coreAuditLog } from '../db/schema.js'

// Appends one row to the audit trail (legacy BITACORA). Never updated or deleted.
export function writeAudit(
  db: Db,
  who: { userId: string; empresaId: string | null },
  entry: AuditEntry,
): void {
  db.insert(coreAuditLog)
    .values({
      id: newId(),
      empresaId: who.empresaId,
      userId: who.userId,
      at: nowIso(),
      module: entry.module,
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    })
    .run()
}
