// Ledger posting contract (docs/sistema/contratos.md §1, fase-0.md F4). Browser-safe types.
import type { GlGeneratedSource } from './gl.js'

export type PostLine = {
  accountId: string       // detail, active account of the empresa
  debit: string           // exact decimal, '0.00' when not used
  credit: string
  detail?: string
  costCenterId?: string | null   // required when the account demands it
}

export type PostEntryRequest = {
  source: GlGeneratedSource
  sourceRef: string       // id of the owning document, batch or run
  entryTypeId: string     // from the module's configuration
  date: string            // AAAA-MM-DD; decides the period
  concept: string
  lines: PostLine[]       // at least 2; Σ debit = Σ credit
}

export type EntryRef = {
  entryId: string
  entryTypeId: string
  period: string
  number: string
  date: string
  isActive: boolean
  source: string
  sourceRef: string
  // Id of the reversal entry when the original was voided in a closed month.
  reversedBy: string | null
}

export type VoidResult =
  | { kind: 'anulada'; entry: EntryRef }
  | { kind: 'reversada'; original: EntryRef; reversal: EntryRef }

export type PostPreview = {
  period: string
  nextNumber: string
  totals: { debit: string; credit: string }
}

export type SourceRefKey = { source: GlGeneratedSource; sourceRef: string }
