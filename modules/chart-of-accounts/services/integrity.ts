import type { IntegrityFinding, IntegrityReport } from '@accounting/shared'
import type { Db } from '@accounting/shared/server'
import { loadRows } from './tree.js'

// Legacy "Revisión del catálogo". Works on dirty (imported) data: only reads.
export function checkIntegrity(db: Db, empresaId: string): IntegrityReport {
  const rows = loadRows(db, empresaId)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const active = rows.filter((r) => r.isActive)
  const findings: IntegrityFinding[] = []

  for (const r of active) {
    const parent = r.parentId ? byId.get(r.parentId) : undefined
    const add = (issue: IntegrityFinding['issue'], message: string) =>
      findings.push({
        accountId: r.id,
        code: r.code,
        name: r.name,
        issue,
        message,
        parentCode: parent?.code ?? null,
      })

    if (!r.parentId) {
      if (r.level !== 1) add('level_mismatch', `Cuenta raíz con nivel ${r.level}; debe ser 1.`)
      continue
    }
    if (!parent) {
      add('parent_missing', 'La cuenta padre no existe.')
      continue
    }
    if (!parent.isActive) add('parent_inactive', `La cuenta padre ${parent.code} está inactiva.`)
    if (parent.isDetail) add('parent_is_detail', `La cuenta padre ${parent.code} es de detalle.`)
    if (parent.type !== r.type) {
      add('type_mismatch', `El tipo (${r.type}) difiere del de la cuenta padre ${parent.code} (${parent.type}).`)
    }
    if (r.level !== parent.level + 1) {
      add('level_mismatch', `Nivel ${r.level}; debe ser ${parent.level + 1}.`)
    }
  }
  return { checkedAccounts: active.length, findings }
}
