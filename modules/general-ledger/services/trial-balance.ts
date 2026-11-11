import type { TrialBalance, TrialBalanceRow, trialBalanceQuery } from '@accounting/shared'
import type { z } from 'zod'
import { centsToMoney } from '../lib/cents.js'
import type { Ctx } from '../lib/context.js'
import { Chart, natured, toReportAccount } from './accounts.js'
import { rolledBalances, zeroSums } from './balances.js'
import { getCostCenter } from './cost-centers.js'

// Balance de Comprobación: previous balance, debits and credits of the
// month and ending balance for every account, detail and parent.
export function trialBalance(ctx: Ctx, q: z.output<typeof trialBalanceQuery>): TrialBalance {
  if (q.costCenterId) getCostCenter(ctx, q.costCenterId)
  const chart = Chart.load(ctx)
  const sums = rolledBalances(ctx, chart, {
    to: q.period,
    splitAt: q.period,
    costCenterId: q.costCenterId,
  })

  const rows: TrialBalanceRow[] = []
  let debits = 0n
  let credits = 0n
  for (const a of chart.accounts) {
    const s = sums.get(a.accountId) ?? zeroSums()
    if (a.isDetail) {
      debits += s.debit
      credits += s.credit
    }
    const previous = natured(a.type, s.prevDebit, s.prevCredit)
    const balance = previous + natured(a.type, s.debit, s.credit)
    const moved = previous !== 0n || s.debit !== 0n || s.credit !== 0n
    if (!moved && (q.onlyWithMovement || !a.isActive || q.costCenterId)) continue
    if (q.level !== undefined && a.level > q.level) continue
    rows.push({
      ...toReportAccount(a),
      previousBalance: centsToMoney(previous),
      debits: centsToMoney(s.debit),
      credits: centsToMoney(s.credit),
      balance: centsToMoney(balance),
    })
  }
  return {
    period: q.period,
    costCenterId: q.costCenterId ?? null,
    rows,
    totals: { debits: centsToMoney(debits), credits: centsToMoney(credits), balanced: debits === credits },
  }
}
