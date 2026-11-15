// Request/response contracts for parties (customers and suppliers).
// Browser-safe: only zod and other shared files.
import { z } from 'zod'

export const PARTY_KINDS = ['person', 'company'] as const
export type PartyKind = (typeof PARTY_KINDS)[number]

export const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  person: 'Persona natural',
  company: 'Persona jurídica',
}

export const PARTY_CODE_MAX = 20

// ── Tax id normalization ────────────────────────────────────────────────
// Stored in one canonical form so equality (duplicates, byNrc, merges) is exact.

const digitsOf = (raw: string): string => raw.replace(/\D/g, '')

// NRC: digits with the check digit after a dash ('123456-7'); leading zeros dropped.
export function normalizeNrc(raw: string | null | undefined): string | null {
  const d = digitsOf(raw ?? '').replace(/^0+/, '')
  if (!d) return null
  return d.length === 1 ? d : `${d.slice(0, -1)}-${d.slice(-1)}`
}

// DUI: '12345678-9' when it has 9 digits; otherwise the digits as given.
export function normalizeDui(raw: string | null | undefined): string | null {
  const d = digitsOf(raw ?? '')
  if (!d) return null
  return d.length === 9 ? `${d.slice(0, 8)}-${d.slice(8)}` : d
}

// NIT: '0614-010190-101-1' when it has 14 digits, DUI form when it has 9 (homologated).
export function normalizeNit(raw: string | null | undefined): string | null {
  const d = digitsOf(raw ?? '')
  if (!d || /^0+$/.test(d)) return null
  if (d.length === 14) return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10, 13)}-${d.slice(13)}`
  return d.length === 9 ? normalizeDui(d) : d
}

// Loose format check: digits and dashes only.
export const isTaxIdText = (raw: string): boolean => /^[0-9-]+$/.test(raw)

const taxId = (label: string, normalize: (v: string) => string | null) =>
  z
    .string()
    .trim()
    .max(25, `El ${label} admite hasta 25 caracteres.`)
    .refine((v) => v === '' || isTaxIdText(v), `El ${label} solo admite dígitos y guiones.`)
    .transform((v) => normalize(v))
    .nullish()

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} admite hasta ${max} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullish()

const fields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200, 'El nombre admite hasta 200 caracteres.'),
  tradeName: optionalText('El nombre comercial', 200),
  kind: z.enum(PARTY_KINDS, { error: 'Tipo de persona inválido.' }),
  isCustomer: z.boolean(),
  isSupplier: z.boolean(),
  nit: taxId('NIT', normalizeNit),
  nrc: taxId('NRC', normalizeNrc),
  dui: taxId('DUI', normalizeDui),
  passport: optionalText('El pasaporte', 25),
  foreignId: optionalText('El documento de extranjero', 25),
  isForeign: z.boolean(),
  economicActivityCode: optionalText('El código de actividad económica', 10),
  email: z
    .string()
    .trim()
    .max(120, 'El correo admite hasta 120 caracteres.')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'El correo no es válido.')
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalText('El teléfono', 40),
  address: optionalText('La dirección', 250),
  departmentCode: optionalText('El código de departamento', 4),
  municipalityCode: optionalText('El código de municipio', 4),
}

const code = z
  .string()
  .trim()
  .min(1, 'El código es obligatorio.')
  .max(PARTY_CODE_MAX, `El código admite hasta ${PARTY_CODE_MAX} caracteres.`)

const ROLE_REQUIRED = 'El tercero debe ser cliente, proveedor o ambos.'

export const partyInput = z
  .object({
    ...fields,
    code,
    kind: fields.kind.default('company'),
    isCustomer: fields.isCustomer.default(false),
    isSupplier: fields.isSupplier.default(false),
    isForeign: fields.isForeign.default(false),
  })
  .refine((p) => p.isCustomer || p.isSupplier, { message: ROLE_REQUIRED, path: ['isCustomer'] })
export type PartyInput = z.input<typeof partyInput>

// Every field optional; null clears an optional value. The code can change.
export const partyUpdate = z.object({
  code: code.optional(),
  name: fields.name.optional(),
  kind: fields.kind.optional(),
  isCustomer: fields.isCustomer.optional(),
  isSupplier: fields.isSupplier.optional(),
  isForeign: fields.isForeign.optional(),
  tradeName: fields.tradeName,
  nit: fields.nit,
  nrc: fields.nrc,
  dui: fields.dui,
  passport: fields.passport,
  foreignId: fields.foreignId,
  economicActivityCode: fields.economicActivityCode,
  email: fields.email,
  phone: fields.phone,
  address: fields.address,
  departmentCode: fields.departmentCode,
  municipalityCode: fields.municipalityCode,
})
export type PartyUpdate = z.input<typeof partyUpdate>

export const PARTY_ROLES = ['customer', 'supplier'] as const
export type PartyRole = (typeof PARTY_ROLES)[number]

export const partyListQuery = z.object({
  q: z.string().trim().optional(),
  role: z.enum(PARTY_ROLES, { error: 'Rol inválido.' }).optional(),
  status: z.enum(['active', 'inactive', 'all'], { error: 'Estado inválido.' }).default('active'),
  limit: z.coerce.number().int().min(1).max(5000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})
export type PartyListQuery = z.input<typeof partyListQuery>

// Where an imported party came from: legacy table and its key.
export type PartyLegacyRef = { table: string; key: string }

export type Party = {
  id: string
  code: string
  name: string
  tradeName: string | null
  kind: PartyKind
  isCustomer: boolean
  isSupplier: boolean
  nit: string | null
  nrc: string | null
  dui: string | null
  passport: string | null
  foreignId: string | null
  isForeign: boolean
  economicActivityCode: string | null
  email: string | null
  phone: string | null
  address: string | null
  departmentCode: string | null
  municipalityCode: string | null
  isActive: boolean
  legacyRefs: PartyLegacyRef[]
  createdAt: string
  updatedAt: string
}

export type PartyList = { items: Party[]; total: number }

// What other modules read through the `parties` lookup (contratos §7).
export type PartyInfo = Pick<
  Party,
  'id' | 'code' | 'name' | 'kind' | 'nit' | 'nrc' | 'dui' | 'isCustomer' | 'isSupplier' | 'isForeign' | 'isActive'
>

// Bound to one empresa by its factory. `db` is a Drizzle handle or a transaction.
export interface PartiesLookup<D = unknown> {
  get(db: D, id: string): PartyInfo | null
  byNrc(db: D, nrc: string): PartyInfo | null
  search(db: D, q: string): PartyInfo[]
}

export const PTY_ERROR_CODES = [
  'party_not_found',
  'code_duplicate',
  'nrc_duplicate',
  'nit_duplicate',
  'role_required',
  'already_active',
  'already_inactive',
  'invalid_json',
] as const
export type PtyErrorCode = (typeof PTY_ERROR_CODES)[number]
