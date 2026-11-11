import { and, asc, eq } from 'drizzle-orm'
import { RuleError } from '@accounting/shared/server'
import { isDebitNature, type GlAccountType, type ReportAccount } from '@accounting/shared'
import { coaAccountsRef as acc } from '../refs.js'
import type { Ctx } from '../lib/context.js'

// Read-only access to the chart of accounts (owned by chart-of-accounts).

export type Account = ReportAccount & { requiresCostCenter: boolean; isActive: boolean }

const cols = {
  accountId: acc.id,
  code: acc.code,
  name: acc.name,
  type: acc.type,
  level: acc.level,
  parentId: acc.parentId,
  isDetail: acc.isDetail,
  requiresCostCenter: acc.requiresCostCenter,
  isActive: acc.isActive,
}

// Balance from raw debit/credit cents according to the account's nature.
export function natured(type: GlAccountType, debit: bigint, credit: bigint): bigint {
  return isDebitNature(type) ? debit - credit : credit - debit
}

export function findAccount(ctx: Ctx, id: string): Account | undefined {
  return ctx.db
    .select(cols)
    .from(acc)
    .where(and(eq(acc.id, id), eq(acc.empresaId, ctx.empresaId)))
    .get()
}

export function getAccount(ctx: Ctx, id: string): Account {
  const row = findAccount(ctx, id)
  if (!row) throw new RuleError('La cuenta no existe.', 404, 'account_not_found')
  return row
}

export function toReportAccount(a: Account): ReportAccount {
  return {
    accountId: a.accountId,
    code: a.code,
    name: a.name,
    type: a.type,
    level: a.level,
    parentId: a.parentId,
    isDetail: a.isDetail,
  }
}

// The whole chart of one empresa, ordered by code, with hierarchy helpers.
export class Chart {
  readonly byId = new Map<string, Account>()
  readonly children = new Map<string, string[]>()

  constructor(readonly accounts: Account[]) {
    for (const a of accounts) this.byId.set(a.accountId, a)
    for (const a of accounts) {
      if (a.parentId && this.byId.has(a.parentId)) {
        const list = this.children.get(a.parentId) ?? []
        list.push(a.accountId)
        this.children.set(a.parentId, list)
      }
    }
  }

  static load(ctx: Ctx): Chart {
    return new Chart(
      ctx.db.select(cols).from(acc).where(eq(acc.empresaId, ctx.empresaId)).orderBy(asc(acc.code)).all(),
    )
  }

  // The account itself followed by every ancestor (guards against cycles).
  chain(id: string): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    let cur: string | null | undefined = id
    while (cur && this.byId.has(cur) && !seen.has(cur)) {
      out.push(cur)
      seen.add(cur)
      cur = this.byId.get(cur)!.parentId
    }
    return out
  }

  // The account and all its descendants.
  subtree(id: string): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const stack = [id]
    while (stack.length) {
      const cur = stack.pop()!
      if (seen.has(cur)) continue
      seen.add(cur)
      out.push(cur)
      stack.push(...(this.children.get(cur) ?? []))
    }
    return out
  }
}
