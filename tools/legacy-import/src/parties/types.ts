import type { SourceTableInfo, WarningBucket } from '../contac/types.js'

export type PartiesImportOptions = {
  // The MCERP root folder: holds CONTAC/, INV64/, cxc64/ and IVA64/.
  sourceRoot: string
  // Target empresa (core_empresas). Without either, the only empresa is used.
  empresaId?: string
  siglas?: string
  // Delete this empresa's previously imported parties first (manual ones stay).
  replace?: boolean
  userId?: string
  // Fixed clock for tests.
  now?: string
}

export type LegacyRef = { table: string; key: string }

// One legacy row, already mapped to party fields. Tax ids are canonical.
export type LegacyParty = {
  ref: LegacyRef
  // Lower = more trusted when merged values differ.
  priority: number
  // Legacy code usable as the party code (CCCLI01.fcta, PROVEDOR.provedor).
  code: string | null
  isCustomer: boolean
  isSupplier: boolean
  isActive: boolean
  // Row of a real master (CCCLI01, PROVEDOR); IVA/INV book copies are not.
  master: boolean
  name: string
  tradeName: string | null
  nrc: string | null
  nit: string | null
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
}

export type ConflictKind =
  // Same NRC (or NIT), names that do not match.
  | 'nombre_distinto'
  // Same NRC, different NIT.
  | 'nit_distinto'
  // A row without NRC whose NIT belongs to several NRCs: not merged.
  | 'nit_en_varios_nrc'
  // Two parties with different NRC end up with the same NIT.
  | 'mismo_nit_distinto_nrc'

export type MergeEntry = { key: string; refs: LegacyRef[]; existingPartyCode?: string }
export type ConflictEntry = { kind: ConflictKind; key: string; refs: LegacyRef[] }

export type PartiesImportReport = {
  empresa: { id: string; siglas: string }
  // deleted = imported parties wiped; detached = captured parties that lost their legacy refs.
  replaced: { deleted: number; detached: number } | null
  source: Record<string, SourceTableInfo & { file: string }>
  missingSources: string[]
  rowsRead: number
  rowsAlreadyImported: number
  counts: {
    partiesCreated: number
    partiesUpdated: number
    customers: number
    suppliers: number
    bothRoles: number
    persons: number
    companies: number
    inactive: number
    withoutTaxId: number
    // Generated code: the party only exists in IVA/INV books, or its legacy code was taken.
    codesGeneratedNoLegacyCode: number
    codesGeneratedCodeTaken: number
  }
  // Groups of more than one legacy row that became (or joined) one party.
  merges: MergeEntry[]
  mergesSummary: { total: number; bothRoles: number; repeatedInSource: number; byNit: number; intoExisting: number }
  conflicts: ConflictEntry[]
  conflictsSummary: Record<ConflictKind, number>
  warnings: Record<string, WarningBucket>
}

export function newPartiesReport(): PartiesImportReport {
  return {
    empresa: { id: '', siglas: '' },
    replaced: null,
    source: {},
    missingSources: [],
    rowsRead: 0,
    rowsAlreadyImported: 0,
    counts: {
      partiesCreated: 0, partiesUpdated: 0, customers: 0, suppliers: 0, bothRoles: 0,
      persons: 0, companies: 0, inactive: 0, withoutTaxId: 0,
      codesGeneratedNoLegacyCode: 0, codesGeneratedCodeTaken: 0,
    },
    merges: [],
    mergesSummary: { total: 0, bothRoles: 0, repeatedInSource: 0, byNit: 0, intoExisting: 0 },
    conflicts: [],
    conflictsSummary: { nombre_distinto: 0, nit_distinto: 0, nit_en_varios_nrc: 0, mismo_nit_distinto_nrc: 0 },
    warnings: {},
  }
}

export function conflict(report: PartiesImportReport, kind: ConflictKind, key: string, refs: LegacyRef[]): void {
  report.conflicts.push({ kind, key, refs })
  report.conflictsSummary[kind]++
}
