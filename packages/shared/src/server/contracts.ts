import type { PeriodArea, PeriodStateRow, PeriodStatus } from '../periods.js'
import type { ServiceContext } from './services.js'

// Contract `periods`, provided by the platform core (contratos.md §2).
// Every method uses ctx.db: pass a context bound to the caller's transaction.
export interface PeriodsService {
  // `periodOrDate`: 'AAAA-MM' or 'AAAA-MM-DD'. No row ⇒ 'open'.
  status(periodOrDate: string, area: PeriodArea): PeriodStatus
  // Throws RuleError 409 'period_closed' if any area is closed or filed.
  assertOpen(periodOrDate: string, areas: PeriodArea[]): void
  close(period: string, area: PeriodArea): PeriodStateRow
  // Requires a reason (REOPEN_REASON_MIN characters). 'filed' cannot be reopened here.
  reopen(period: string, area: PeriodArea, reason: string): PeriodStateRow
  markFiled(period: string, area: PeriodArea, ref: string): PeriodStateRow
  list(area: PeriodArea, year: string): PeriodStateRow[]
}

export type PeriodsFactory = (ctx: ServiceContext) => PeriodsService
