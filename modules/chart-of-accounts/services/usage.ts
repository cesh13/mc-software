import { sql } from 'drizzle-orm'
import type { Db } from '@accounting/shared/server'

// "Has movements" = an active journal entry has a line on the account.
// general-ledger may not be installed and this module cannot import it, so
// the tables are looked up by name and queried with raw SQL.

function glInstalled(db: Db): boolean {
  const rows = db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'table' and name in ('gl_journal_lines', 'gl_journal_entries')`,
  )
  return rows.length === 2
}

const CHUNK = 500

// Returns the subset of `accountIds` that have movements.
export function accountsWithMovements(db: Db, accountIds: string[]): Set<string> {
  const found = new Set<string>()
  if (accountIds.length === 0 || !glInstalled(db)) return found
  for (let i = 0; i < accountIds.length; i += CHUNK) {
    const ids = accountIds.slice(i, i + CHUNK)
    const rows = db.all<{ account_id: string }>(
      sql`select distinct l.account_id as account_id
          from gl_journal_lines l
          join gl_journal_entries e on e.id = l.entry_id
          where e.is_active = 1 and l.account_id in (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    )
    for (const r of rows) found.add(r.account_id)
  }
  return found
}

export function accountHasMovements(db: Db, accountId: string): boolean {
  return accountsWithMovements(db, [accountId]).has(accountId)
}
