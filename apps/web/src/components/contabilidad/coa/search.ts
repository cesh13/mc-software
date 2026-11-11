import type { Account, AccountType } from '@accounting/shared'

// Lowercase without accents, so "cartera" finds "Cartera" and "Depreciación" finds "depreciacion".
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Catalog table filter: code prefix or name substring. Keeps the incoming (code) order.
export function filterAccounts(
  list: Account[],
  query: string,
  type: AccountType | '',
  showInactive: boolean,
): Account[] {
  const q = fold(query.trim())
  return list.filter((a) => {
    if (!showInactive && !a.isActive) return false
    if (type && a.type !== type) return false
    return !q || a.code.toLowerCase().startsWith(q) || fold(a.name).includes(q)
  })
}

export type PickerFilter = { detailOnly?: boolean; excludeDetail?: boolean; excludeId?: string }

// Lookup used by AccountPicker: only active accounts; exact code first, then code prefix, then name.
export function searchAccounts(list: Account[], query: string, filter: PickerFilter, limit = 50): Account[] {
  const q = fold(query.trim())
  const out: { a: Account; rank: number }[] = []
  for (const a of list) {
    if (!a.isActive || a.id === filter.excludeId) continue
    if (filter.detailOnly && !a.isDetail) continue
    if (filter.excludeDetail && a.isDetail) continue
    const code = a.code.toLowerCase()
    const rank = !q ? 1 : code === q ? 0 : code.startsWith(q) ? 1 : fold(a.name).includes(q) ? 2 : -1
    if (rank >= 0) out.push({ a, rank })
  }
  // Array.sort is stable, so the code order is kept inside each rank.
  return out.sort((x, y) => x.rank - y.rank).slice(0, limit).map((o) => o.a)
}
