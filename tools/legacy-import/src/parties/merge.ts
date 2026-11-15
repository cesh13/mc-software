import { NO_NAME } from './sources.js'
import { conflict, type LegacyParty, type PartiesImportReport } from './types.js'

// Rows that become one party. `key` is 'nrc:<nrc>', 'nit:<nit>' or 'fila:<table>|<key>'.
export type Group = { key: string; via: 'nrc' | 'nit' | 'none'; members: LegacyParty[] }

const byPriority = (a: LegacyParty, b: LegacyParty) =>
  a.priority - b.priority || Number(b.isActive) - Number(a.isActive) || a.ref.key.localeCompare(b.ref.key)

// Names compared without accents, case, spaces or punctuation ('S.A. de C.V.' = 'SA DE CV').
export const nameKey = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

// Merge rule M3: same NRC ⇒ one party (roles OR'ed). A row without NRC joins the
// NRC group that has its NIT when exactly one does; otherwise rows without NRC
// are grouped by NIT. Rows with neither stay alone.
export function groupParties(rows: LegacyParty[], report: PartiesImportReport): Group[] {
  const byNrc = new Map<string, LegacyParty[]>()
  const noNrc: LegacyParty[] = []
  for (const r of rows) {
    if (r.nrc) push(byNrc, r.nrc, r)
    else noNrc.push(r)
  }
  const groups = new Map<string, Group>()
  for (const [nrc, members] of byNrc) groups.set(`nrc:${nrc}`, { key: `nrc:${nrc}`, via: 'nrc', members })

  const nrcGroupsByNit = new Map<string, Set<string>>()
  for (const g of groups.values()) {
    for (const m of g.members) if (m.nit) (nrcGroupsByNit.get(m.nit) ?? nrcGroupsByNit.set(m.nit, new Set()).get(m.nit)!).add(g.key)
  }
  const loose: Group[] = []
  for (const r of noNrc) {
    if (!r.nit) {
      loose.push({ key: `fila:${r.ref.table}|${r.ref.key}`, via: 'none', members: [r] })
      continue
    }
    const targets = [...(nrcGroupsByNit.get(r.nit) ?? [])]
    if (targets.length === 1) {
      groups.get(targets[0]!)!.members.push(r)
      continue
    }
    if (targets.length > 1) {
      conflict(report, 'nit_en_varios_nrc', `nit:${r.nit}`, [r.ref, ...targets.flatMap((k) => groups.get(k)!.members.map((m) => m.ref))])
    }
    const key = `nit:${r.nit}`
    const g = groups.get(key)
    if (g) g.members.push(r)
    else groups.set(key, { key, via: 'nit', members: [r] })
  }
  const all = [...groups.values(), ...loose]
  for (const g of all) g.members.sort(byPriority)
  checkGroups(all, report)
  return all
}

function checkGroups(groups: Group[], report: PartiesImportReport): void {
  const nitOwners = new Map<string, Group[]>()
  for (const g of groups) {
    const refs = g.members.map((m) => m.ref)
    // A name cut by a shorter legacy field (C60 vs C70) is not a conflict.
    const names = g.members.filter((m) => m.name !== NO_NAME).map((m) => nameKey(m.name))
    if (names.some((a) => names.some((b) => !a.startsWith(b) && !b.startsWith(a)))) conflict(report, 'nombre_distinto', g.key, refs)
    const nits = new Set(g.members.map((m) => m.nit).filter(Boolean))
    if (g.via === 'nrc' && nits.size > 1) conflict(report, 'nit_distinto', g.key, refs)
    const nit = g.members.find((m) => m.nit)?.nit
    if (nit) push(nitOwners, nit, g)
  }
  for (const [nit, owners] of nitOwners) {
    if (owners.length > 1 && owners.filter((g) => g.via === 'nrc').length > 1) {
      conflict(report, 'mismo_nit_distinto_nrc', `nit:${nit}`, owners.flatMap((g) => g.members.map((m) => m.ref)))
    }
  }
}

export type MergedParty = Omit<LegacyParty, 'ref' | 'priority' | 'code' | 'master'> & {
  codes: string[]
  refs: LegacyParty['ref'][]
}

type Field = Exclude<keyof MergedParty, 'codes' | 'refs' | 'isCustomer' | 'isSupplier' | 'isActive' | 'isForeign' | 'master'>

const FIELDS: Field[] = [
  'name', 'tradeName', 'nrc', 'nit', 'dui', 'passport', 'foreignId', 'economicActivityCode',
  'email', 'phone', 'address', 'departmentCode', 'municipalityCode',
]

// Values: first non-empty one in priority order. Flags: any member.
export function mergeGroup(g: Group): MergedParty {
  const masters = g.members.filter((m) => m.master)
  const pick = (f: Field) => g.members.find((m) => m[f])?.[f] ?? null
  const out = {
    isCustomer: g.members.some((m) => m.isCustomer),
    isSupplier: g.members.some((m) => m.isSupplier),
    // Book copies carry no active flag: only masters decide when there is one.
    isActive: masters.length ? masters.some((m) => m.isActive) : true,
    isForeign: g.members.some((m) => m.isForeign),
    codes: g.members.map((m) => m.code).filter((c): c is string => !!c),
    refs: g.members.map((m) => m.ref),
  } as MergedParty
  for (const f of FIELDS) (out as Record<Field, string | null>)[f] = pick(f)
  out.name = (g.members.find((m) => m.name !== NO_NAME) ?? g.members[0]!).name
  return out
}
