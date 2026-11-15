// Fiscal profile of an empresa ("ficha fiscal") and audit-trail rows. Browser-safe.
import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`).default('')
const digits = (label: string) =>
  z.string().trim().max(20).regex(/^(\d[\d-]*)?$/, `${label} solo admite dígitos y guiones.`).default('')

export const empresaProfileInput = z.object({
  legalName: z.string().trim().min(1, 'La razón social es obligatoria.').max(200),
  tradeName: text(200),
  nit: digits('El NIT'),
  nrc: digits('El NRC'),
  giro: text(300),
  economicActivityCode: text(20),
  departmentCode: text(10),
  municipalityCode: text(10),
  address: text(300),
  phone: text(30),
  email: z.string().trim().max(120).email('El correo no es válido.').or(z.literal('')).default(''),
  logoRef: z.string().trim().max(300).nullable().default(null),
  amountsLegend: text(200),
})

export type EmpresaProfileInput = z.infer<typeof empresaProfileInput>

export type EmpresaProfile = EmpresaProfileInput & {
  empresaId: string
  updatedBy: string | null
  updatedAt: string | null
}

export type AuditRow = {
  id: string
  empresaId: string | null
  userId: string
  userName: string | null
  at: string
  module: string
  action: string
  entity: string | null
  entityId: string | null
  detail: string | null
}

export type AuditPage = { rows: AuditRow[]; total: number; limit: number; offset: number }
