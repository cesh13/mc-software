import { addMoney, type Account, type EntryLine } from '@accounting/shared'

// Legal print of an entry, as the legacy GENPART: each line climbs the catalog
// up to its cuenta de mayor (level MAYOR_LEVEL). The mayor carries the total in
// Cargo or Abono, the accounts in between their subtotal in Parciales, and the
// line's own account lists each line's detail with its amount. Cargos come
// first, then abonos; accounts in code order; one node per account and side.

export const MAYOR_LEVEL = 3

export type Side = 'cargo' | 'abono'
export type TreeNode = {
  code: string
  name: string
  amount: string
  // Lines posted to this very account.
  details: { id: string; text: string; amount: string }[]
  children: TreeNode[]
}
export type EntryTree = { side: Side; nodes: TreeNode[] }[]

type Ref = { code: string; name: string; parentId: string | null; level: number }

export function buildEntryTree(lines: EntryLine[], byId: Map<string, Account>, mayorLevel = MAYOR_LEVEL): EntryTree {
  const roots: Record<Side, Map<string, Mutable>> = { cargo: new Map(), abono: new Map() }
  for (const l of lines) {
    const side: Side = Number(l.credit) > 0 && Number(l.debit) === 0 ? 'abono' : 'cargo'
    const amount = side === 'cargo' ? l.debit : l.credit
    // Chain from the line's account up to its mayor (or as far as the catalog goes).
    const own: Ref = byId.get(l.accountId) ?? { code: l.accountCode, name: l.accountName, parentId: null, level: 0 }
    const chain: Ref[] = [{ ...own, code: l.accountCode, name: l.accountName }]
    let cur = own
    while (cur.level > mayorLevel && cur.parentId) {
      const parent = byId.get(cur.parentId)
      if (!parent) break
      chain.push(parent)
      cur = parent
    }
    chain.reverse()
    let level = roots[side]
    let node: Mutable | undefined
    for (const ref of chain) {
      node = level.get(ref.code)
      if (!node) {
        node = { code: ref.code, name: ref.name, amount: '0.00', details: [], kids: new Map() }
        level.set(ref.code, node)
      }
      node.amount = addMoney(node.amount, amount)
      level = node.kids
    }
    node!.details.push({ id: l.id, text: l.detail, amount })
  }
  return (['cargo', 'abono'] as const)
    .map((side) => ({ side, nodes: freeze(roots[side]) }))
    .filter((s) => s.nodes.length > 0)
}

type Mutable = Omit<TreeNode, 'children'> & { kids: Map<string, Mutable> }

function freeze(level: Map<string, Mutable>): TreeNode[] {
  return [...level.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(({ kids, ...n }) => ({ ...n, children: freeze(kids) }))
}
