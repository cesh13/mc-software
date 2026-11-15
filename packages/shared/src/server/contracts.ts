import type { PeriodArea, PeriodStateRow, PeriodStatus } from '../periods.js'
import type { SequenceDef, SequenceNumber, SettingValue } from '../settings.js'
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

// Contract `settings` (contratos.md §8). Keys must be declared by a manifest
// (or the core); values are validated with the declared Zod schema.
export interface SettingsService {
  // Value in force on `at` (AAAA-MM-DD, default today); the declared default when none.
  get<T>(namespace: string, key: string, at?: string): T
  // `validFrom` only for dated settings (required there). Audited.
  set(namespace: string, key: string, value: unknown, validFrom?: string): SettingValue
  history(namespace: string, key: string): SettingValue[]
}

// Contract `sequences` (contratos.md §8). `next` consumes a number inside the
// caller's transaction: if the transaction fails, the number is not used.
export interface SequencesService {
  next(scope: string, key: string): SequenceNumber
  peek(scope: string, key: string): SequenceNumber | null
  define(def: SequenceDef): void
}
