// Request/response contracts for general-ledger (Zod schemas + types). Browser-safe.
import { z } from 'zod'
import { isIsoDate, isPeriod } from './period.js'
import type { Money } from './money.js'
import type { AccountType } from './coa.js'

const period = z.string().refine(isPeriod, 'Período inválido (AAAA-MM).')
const date = z.string().refine(isIsoDate, 'Fecha inválida (AAAA-MM-DD).')
// Non-negative amount with up to two decimals, as a string.
const amount = z.string().trim().regex(/^\d{1,13}(\.\d{1,2})?$/, 'Monto inválido.')
const flag = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1')
const id = z.string().trim().min(1)

export const GL_ENTRY_STATUSES = ['borrador', 'aplicada'] as const
export type GlEntryStatus = (typeof GL_ENTRY_STATUSES)[number]
export const GL_ENTRY_SOURCES = ['manual', 'bancos', 'iva', 'cierre', 'importado'] as const
export type GlEntrySource = (typeof GL_ENTRY_SOURCES)[number]
export type GlAccountType = AccountType

// ── Setup data ──────────────────────────────────────────────────────────
export const entryTypeInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}$/, 'El código lleva 2 caracteres.'),
  name: z.string().trim().min(1).max(25),
  isBank: z.boolean().default(false),
  numberWidth: z.number().int().min(1).max(10).default(6),
})
export const entryTypeUpdate = z.object({
  code: entryTypeInput.shape.code.optional(),
  name: z.string().trim().min(1).max(25).optional(),
  isBank: z.boolean().optional(),
  numberWidth: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
})
export type EntryTypeInput = z.input<typeof entryTypeInput>
export type EntryTypeUpdate = z.input<typeof entryTypeUpdate>
export type EntryType = {
  id: string; code: string; name: string; isBank: boolean; numberWidth: number; isActive: boolean
}

export const costCenterInput = z.object({
  code: z.string().trim().toUpperCase().min(1).max(3),
  name: z.string().trim().min(1).max(50),
})
export const costCenterUpdate = z.object({
  code: costCenterInput.shape.code.optional(),
  name: costCenterInput.shape.name.optional(),
  isActive: z.boolean().optional(),
})
export type CostCenterInput = z.input<typeof costCenterInput>
export type CostCenterUpdate = z.input<typeof costCenterUpdate>
export type CostCenter = { id: string; code: string; name: string; isActive: boolean }

export const fiscalYearInput = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  startPeriod: period,
  // Default: startPeriod + 11 months.
  endPeriod: period.optional(),
})
export type FiscalYearInput = z.input<typeof fiscalYearInput>
// id is null when no row exists and the calendar year is used.
export type FiscalYear = { id: string | null; name: string; startPeriod: string; endPeriod: string }

export const periodsQuery = z.object({ year: z.string().regex(/^\d{4}$/, 'Año inválido.') })
export type PeriodStatusRow = {
  period: string; label: string; status: 'open' | 'closed'; closedAt: string | null
  closedBy: string | null; entries: { aplicada: number; borrador: number; voided: number }
}

// ── Journal entries ─────────────────────────────────────────────────────
export const entryLineInput = z.object({
  accountId: id,
  costCenterId: z.string().trim().min(1).nullish(),
  detail: z.string().trim().max(200).default(''),
  debit: amount.default('0.00'),
  credit: amount.default('0.00'),
  collectDate: date.nullish(),
})
export const entryInput = z.object({
  period,
  entryTypeId: id,
  // Optional: the server assigns the next number when omitted or taken.
  number: z.string().trim().regex(/^\d{1,10}$/, 'Número inválido.').optional(),
  date,
  concept: z.string().trim().max(120).default(''),
  status: z.enum(GL_ENTRY_STATUSES).default('aplicada'),
  allowZeroLines: z.boolean().default(false),
  lines: z.array(entryLineInput).max(2000),
})
export type EntryLineInput = z.input<typeof entryLineInput>
export type EntryInput = z.input<typeof entryInput>

export const entryListQuery = z.object({
  period,
  entryTypeId: id.optional(),
  status: z.enum(GL_ENTRY_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  includeVoided: flag.optional(),
})
export const nextNumberQuery = z.object({ period, entryTypeId: id })
export const unbalancedQuery = z.object({ period: period.optional() })
export const copyEntryInput = z.object({
  period, date, entryTypeId: id.optional(), concept: z.string().trim().max(120).optional(),
})
export type EntryListQuery = z.input<typeof entryListQuery>
export type CopyEntryInput = z.input<typeof copyEntryInput>
export type EntryTotals = { debit: Money; credit: Money; difference: Money }
export type EntryListItem = {
  id: string; period: string; entryTypeId: string; entryTypeCode: string; number: string
  date: string; concept: string; status: GlEntryStatus; source: GlEntrySource
  importedUnbalanced: boolean; isActive: boolean; lineCount: number; totals: EntryTotals
}
export type EntryLine = {
  id: string; lineNo: number; accountId: string; accountCode: string; accountName: string
  costCenterId: string | null; costCenterCode: string | null; costCenterName: string | null
  detail: string; debit: Money; credit: Money; collectDate: string | null
}
export type Entry = EntryListItem & {
  entryTypeName: string; sourceRef: string | null; createdBy: string; createdAt: string
  updatedAt: string; periodStatus: 'open' | 'closed'; editable: boolean
  lines: EntryLine[]; prevId: string | null; nextId: string | null
}
// Response of create/update: the entry plus whether the number changed.
export type EntrySaveResult = Entry & { numberReassigned: boolean }
export type NextNumber = { period: string; entryTypeId: string; number: string }

// ── Reports ─────────────────────────────────────────────────────────────
export const trialBalanceQuery = z.object({
  period,
  level: z.coerce.number().int().min(1).max(20).optional(),
  onlyWithMovement: flag.optional(),
  costCenterId: id.optional(),
})
export const accountLedgerQuery = z.object({
  accountId: id, from: date, to: date, costCenterId: id.optional(),
})
export const journalQuery = z.object({ period })
export const balanceSheetQuery = journalQuery
export const incomeStatementQuery = z.object({ from: period, to: period })
export type TrialBalanceQuery = z.input<typeof trialBalanceQuery>
export type AccountLedgerQuery = z.input<typeof accountLedgerQuery>
export type ReportAccount = {
  accountId: string; code: string; name: string; type: GlAccountType; level: number
  parentId: string | null; isDetail: boolean
}
export type TrialBalanceRow = ReportAccount & {
  previousBalance: Money; debits: Money; credits: Money; balance: Money
}
export type TrialBalance = {
  period: string; costCenterId: string | null; rows: TrialBalanceRow[]
  // Over detail accounts, independent of the level filter.
  totals: { debits: Money; credits: Money; balanced: boolean }
}
export type LedgerMovement = {
  entryId: string; date: string; period: string; entryTypeCode: string; number: string
  lineNo: number; accountCode: string; costCenterCode: string | null; detail: string
  debit: Money; credit: Money; balance: Money
}
export type AccountLedger = {
  account: ReportAccount; from: string; to: string; costCenterId: string | null
  openingBalance: Money; movements: LedgerMovement[]
  totals: { debits: Money; credits: Money }; closingBalance: Money
}
export type JournalReport = {
  period: string; entries: (EntryListItem & { lines: EntryLine[] })[]
  totals: { debit: Money; credit: Money }
}
export type StatementRow = ReportAccount & { balance: Money }
export type StatementSection = { type: GlAccountType; rows: StatementRow[]; total: Money }
export type BalanceSheet = {
  period: string; fiscalYear: FiscalYear
  activo: StatementSection; pasivo: StatementSection; capital: StatementSection
  // Open question #3: how orden/contra are presented is not decided yet.
  orden: StatementSection; contra: StatementSection
  // ingresos − gastos of the fiscal year up to `period` (0 once the close is applied).
  currentYearResult: Money
  // ingresos − gastos before the fiscal year that no closing entry has cleared.
  priorYearsResult: Money
  // activo − (pasivo + capital + currentYearResult + priorYearsResult); 0 when consistent.
  difference: Money
}
export type IncomeStatement = {
  from: string; to: string; ingresos: StatementSection; gastos: StatementSection; netResult: Money
}

// ── Annual close ────────────────────────────────────────────────────────
export const annualCloseInput = z
  .object({
    fiscalYearId: id.optional(),
    period: period.optional(),
    entryTypeId: id,
    resultAccountId: id,
    date: date.optional(),
  })
  .refine((v) => !!v.fiscalYearId !== !!v.period, 'Indique el año fiscal o un período.')
export type AnnualCloseInput = z.input<typeof annualCloseInput>
export type AnnualClosePreview = {
  fiscalYear: FiscalYear; period: string; date: string; concept: string; entryTypeId: string
  number: string; alreadyClosed: boolean; result: Money
  lines: (Omit<EntryLine, 'id' | 'collectDate'>)[]; totals: EntryTotals
}
