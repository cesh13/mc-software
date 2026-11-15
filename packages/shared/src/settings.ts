// Per-empresa settings and sequences (docs/sistema/contratos.md §8). Browser-safe.
import type { z } from 'zod'

// A setting a module (or the core) declares. `dated` settings keep versions
// with a valid-from date (tax rates, thresholds); the others have one value.
export type SettingDef = {
  namespace: string
  key: string
  label: string
  schema: z.ZodType
  default: unknown
  dated?: boolean
}

export type SettingValue = {
  namespace: string
  key: string
  value: unknown
  validFrom: string | null
  isDefault: boolean
}

export type SequenceDef = {
  scope: string
  key: string
  nextValue: number
  width: number
  prefix?: string
  rangeFrom?: number | null
  rangeTo?: number | null
  validFrom?: string | null
  validTo?: string | null
  authorizationRef?: string | null
}

export type SequenceNumber = { value: number; formatted: string }

// Valid-from used for settings without versions.
export const UNDATED = '0000-01-01'

const settingsCatalog = new Map<string, SettingDef>()
const keyOf = (ns: string, key: string) => `${ns}.${key}`

export function registerSettings(defs: readonly SettingDef[]): void {
  for (const d of defs) settingsCatalog.set(keyOf(d.namespace, d.key), d)
}
export function settingDef(namespace: string, key: string): SettingDef | undefined {
  return settingsCatalog.get(keyOf(namespace, key))
}
export function listSettingDefs(namespace?: string): SettingDef[] {
  return [...settingsCatalog.values()].filter((d) => !namespace || d.namespace === namespace)
}

export function formatSequence(value: number, width: number, prefix = ''): string {
  return `${prefix}${String(value).padStart(width, '0')}`
}
