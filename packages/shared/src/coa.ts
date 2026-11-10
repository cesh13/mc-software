// Request/response contracts for chart-of-accounts (Zod schemas + types).
// Browser-safe: only zod and other shared files.
import { z } from 'zod'

// Legacy `tipocta` 1..7, in the same order.
export const ACCOUNT_TYPES = [
  'activo',
  'pasivo',
  'capital',
  'gastos',
  'ingresos',
  'orden',
  'contra',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  capital: 'Capital',
  gastos: 'Gastos',
  ingresos: 'Ingresos',
  orden: 'Cuentas de orden',
  contra: 'Cuentas contra',
}

// Debit-natured types: balance = previous + debits − credits.
// The rest are credit-natured: balance = previous − debits + credits.
export const DEBIT_NATURE_TYPES: readonly AccountType[] = ['activo', 'gastos', 'orden']

export function isDebitNature(type: AccountType): boolean {
  return DEBIT_NATURE_TYPES.includes(type)
}

export const ACCOUNT_CODE_MAX = 14
export const BUDGET_GROUP_CODE_MAX = 3

const accountCode = z
  .string()
  .trim()
  .min(1, 'El código es obligatorio.')
  .max(ACCOUNT_CODE_MAX, `El código admite hasta ${ACCOUNT_CODE_MAX} caracteres.`)
const accountName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(100, 'El nombre admite hasta 100 caracteres.')
const optionalRef = z.string().trim().min(1).nullish()

export const accountInput = z.object({
  code: accountCode,
  name: accountName,
  type: z.enum(ACCOUNT_TYPES, { error: 'Tipo de cuenta inválido.' }),
  // Parent by code or by id; none = root account.
  parentCode: optionalRef,
  parentId: optionalRef,
  isDetail: z.boolean().default(false),
  requiresCostCenter: z.boolean().default(false),
  budgetGroupId: optionalRef,
})
export type AccountInput = z.input<typeof accountInput>

// Every field optional. `parentCode`/`parentId` = null makes the account a root.
// `code` is accepted only so that an attempt to change it gets a clear error.
export const accountUpdate = z.object({
  code: accountCode.optional(),
  name: accountName.optional(),
  type: z.enum(ACCOUNT_TYPES, { error: 'Tipo de cuenta inválido.' }).optional(),
  parentCode: optionalRef,
  parentId: optionalRef,
  isDetail: z.boolean().optional(),
  requiresCostCenter: z.boolean().optional(),
  budgetGroupId: optionalRef,
})
export type AccountUpdate = z.input<typeof accountUpdate>

const flag = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true')

export const accountListQuery = z.object({
  q: z.string().trim().optional(),
  detail: flag,
  includeInactive: flag,
  limit: z.coerce.number().int().min(1).max(5000).optional(),
})
export type AccountListQuery = z.input<typeof accountListQuery>

export const budgetGroupInput = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código es obligatorio.')
    .max(BUDGET_GROUP_CODE_MAX, `El código admite hasta ${BUDGET_GROUP_CODE_MAX} caracteres.`),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(60, 'El nombre admite hasta 60 caracteres.'),
})
export type BudgetGroupInput = z.input<typeof budgetGroupInput>

export const budgetGroupUpdate = budgetGroupInput.partial()
export type BudgetGroupUpdate = z.input<typeof budgetGroupUpdate>

export type Account = {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  parentCode: string | null
  level: number
  isDetail: boolean
  requiresCostCenter: boolean
  budgetGroupId: string | null
  budgetGroupCode: string | null
  isActive: boolean
  // True when the account has active sub-accounts.
  hasChildren: boolean
  createdAt: string
  updatedAt: string
}

export type BudgetGroup = {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const INTEGRITY_ISSUES = [
  'parent_missing',
  'parent_inactive',
  'parent_is_detail',
  'type_mismatch',
  'level_mismatch',
] as const
export type IntegrityIssue = (typeof INTEGRITY_ISSUES)[number]

export type IntegrityFinding = {
  accountId: string
  code: string
  name: string
  issue: IntegrityIssue
  message: string
  parentCode: string | null
}

export type IntegrityReport = {
  checkedAccounts: number
  findings: IntegrityFinding[]
}

// Stable `code` values of the errors this module returns ({ error, code }).
export const COA_ERROR_CODES = [
  'account_not_found',
  'budget_group_not_found',
  'budget_group_inactive',
  'budget_group_in_use',
  'code_duplicate',
  'code_immutable',
  'parent_conflict',
  'parent_not_found',
  'parent_inactive',
  'parent_is_detail',
  'parent_type_mismatch',
  'parent_cycle',
  'cost_center_not_detail',
  'has_children',
  'has_movements',
  'already_active',
  'already_inactive',
  'invalid_json',
] as const
export type CoaErrorCode = (typeof COA_ERROR_CODES)[number]
