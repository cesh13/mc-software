import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import type { AccountLedger, LedgerMovement, accountLedgerQuery } from '@accounting/shared'
import type { z } from 'zod'
import {
  glCostCenters as cc,
  glEntryTypes as t,
  glJournalEntries as e,
  glJournalLines as l,
} from '../schema.js'
import { coaAccountsRef as acc } from '../refs.js'
import { centsToMoney, fromSqlCents, sqlCents, toCents } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { Chart, getAccount, natured, toReportAccount } from './accounts.js'
import { countedEntries } from './balances.js'
import { getCostCenter } from './cost-centers.js'
import { numberOrder } from './entries-read.js'

// Mayor / libro auxiliar: opening balance, each movement with its running
// balance, and the closing balance. A parent account shows the movements of
// all its descendants.
export function accountLedger(ctx: Ctx, q: z.output<typeof accountLedgerQuery>): AccountLedger {
  if (q.from > q.to) {
    throw new RuleError('La fecha inicial es posterior a la final.', 400, 'invalid_range')
  }
  const account = getAccount(ctx, q.accountId)
  if (q.costCenterId) getCostCenter(ctx, q.costCenterId)
  const ids = Chart.load(ctx).subtree(account.accountId)

  const where = [...countedEntries(ctx), inArray(l.accountId, ids)]
  if (q.costCenterId) where.push(eq(l.costCenterId, q.costCenterId))

  const opening = ctx.db
    .select({
      debit: sql<number>`coalesce(sum(${sqlCents(l.debit)}), 0)`,
      credit: sql<number>`coalesce(sum(${sqlCents(l.credit)}), 0)`,
    })
    .from(l)
    .innerJoin(e, eq(e.id, l.entryId))
    .where(and(...where, lt(e.date, q.from)))
    .get()
  const openingBalance = natured(
    account.type,
    fromSqlCents(opening?.debit),
    fromSqlCents(opening?.credit),
  )

  const rows = ctx.db
    .select({
      entryId: e.id,
      date: e.date,
      period: e.period,
      entryTypeCode: t.code,
      number: e.number,
      lineNo: l.lineNo,
      accountCode: acc.code,
      costCenterCode: cc.code,
      detail: l.detail,
      debit: l.debit,
      credit: l.credit,
    })
    .from(l)
    .innerJoin(e, eq(e.id, l.entryId))
    .innerJoin(t, eq(t.id, e.entryTypeId))
    .innerJoin(acc, eq(acc.id, l.accountId))
    .leftJoin(cc, eq(cc.id, l.costCenterId))
    .where(and(...where, gte(e.date, q.from), lte(e.date, q.to)))
    .orderBy(asc(e.date), asc(t.code), asc(numberOrder), asc(e.id), asc(l.lineNo))
    .all()

  let balance = openingBalance
  let debits = 0n
  let credits = 0n
  const movements: LedgerMovement[] = rows.map((r) => {
    const d = toCents(r.debit)
    const c = toCents(r.credit)
    debits += d
    credits += c
    balance += natured(account.type, d, c)
    return { ...r, balance: centsToMoney(balance) }
  })

  return {
    account: toReportAccount(account),
    from: q.from,
    to: q.to,
    costCenterId: q.costCenterId ?? null,
    openingBalance: centsToMoney(openingBalance),
    movements,
    totals: { debits: centsToMoney(debits), credits: centsToMoney(credits) },
    closingBalance: centsToMoney(balance),
  }
}
