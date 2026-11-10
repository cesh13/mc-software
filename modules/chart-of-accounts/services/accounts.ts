import type { Account, AccountListQuery } from '@accounting/shared'
import { accountListQuery } from '@accounting/shared'
import { RuleError, type Db } from '@accounting/shared/server'
import { findRow, loadRows, toAccounts } from './tree.js'

export function listAccounts(db: Db, empresaId: string, rawQuery: AccountListQuery): Account[] {
  const query = accountListQuery.parse(rawQuery)
  const rows = loadRows(db, empresaId)
  const q = query.q?.toLowerCase()
  const selected = rows.filter((r) => {
    if (!query.includeInactive && !r.isActive) return false
    if (query.detail && !r.isDetail) return false
    if (q && !r.code.toLowerCase().startsWith(q) && !r.name.toLowerCase().includes(q)) return false
    return true
  })
  const limited = query.limit ? selected.slice(0, query.limit) : selected
  return toAccounts(db, empresaId, rows, limited)
}

function notFound(): never {
  throw new RuleError('La cuenta no existe.', 404, 'account_not_found')
}

export function getAccount(db: Db, empresaId: string, id: string): Account {
  if (!findRow(db, empresaId, id)) notFound()
  const rows = loadRows(db, empresaId)
  return toAccounts(db, empresaId, rows, rows.filter((r) => r.id === id))[0]!
}

export function getAccountByCode(db: Db, empresaId: string, code: string): Account {
  const rows = loadRows(db, empresaId)
  const row = rows.find((r) => r.code === code.trim())
  if (!row) notFound()
  return toAccounts(db, empresaId, rows, [row])[0]!
}

export { notFound as accountNotFound }
