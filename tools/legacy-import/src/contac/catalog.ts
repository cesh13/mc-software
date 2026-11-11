import { accountTypeOf, ensureBudgetGroup, newId, type Ctx } from './context.js'
import { int, str, type Row } from './source.js'
import { bump, warn, type CatalogFinding } from './types.js'

type Node = { row: Row; code: string; parent: string | null; depth: number }

// AGRUPA → coa_budget_groups.
export function importBudgetGroups(ctx: Ctx): void {
  const insert = ctx.db.prepare(
    `INSERT INTO coa_budget_groups (id, empresa_id, code, name, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
  )
  for (const r of ctx.src['agrupa']!) {
    const code = str(r['codigoa'])
    if (!code || ctx.budgetGroups.has(code)) continue
    const id = newId()
    insert.run(id, ctx.empresaId, code, str(r['descripa']), ctx.now, ctx.now)
    ctx.budgetGroups.set(code, id)
    bump(ctx.report, 'coa_budget_groups')
  }
}

// Depth in the parent chain; a cycle is reported and cut (the account becomes a root).
function depthOf(code: string, nodes: Map<string, Node>, finding: (f: CatalogFinding) => void): number {
  const seen = new Set<string>()
  let d = 0
  let cur = nodes.get(code)
  while (cur?.parent) {
    if (seen.has(cur.code)) {
      finding({ code, kind: 'ciclo', detail: 'La cadena de cuentas padre da vueltas; se importa como raíz.' })
      cur.parent = null
      return depthOf(code, nodes, finding)
    }
    seen.add(cur.code)
    d++
    cur = nodes.get(cur.parent)
  }
  return d
}

function readNodes(ctx: Ctx, finding: (f: CatalogFinding) => void): Map<string, Node> {
  const nodes = new Map<string, Node>()
  for (const row of ctx.src['catalogo']!) {
    const code = str(row['cuenta'])
    if (!code) continue
    if (nodes.has(code)) {
      finding({ code, kind: 'codigo_duplicado', detail: 'Código repetido; se conserva el primero.' })
      continue
    }
    const anterior = str(row['anterior'])
    nodes.set(code, { row, code, parent: anterior === '' || anterior === '0' ? null : anterior, depth: 0 })
  }
  for (const n of nodes.values()) {
    if (n.parent === n.code) {
      finding({ code: n.code, kind: 'ciclo', detail: 'La cuenta es su propio padre; se importa como raíz.' })
      n.parent = null
    } else if (n.parent && !nodes.has(n.parent)) {
      finding({ code: n.code, kind: 'padre_inexistente', detail: `La cuenta padre ${n.parent} no existe; se importa como raíz.` })
      n.parent = null
    }
  }
  for (const n of nodes.values()) n.depth = depthOf(n.code, nodes, finding)
  return nodes
}

// CATALOGO → coa_accounts. Integrity errors are reported, never fixed silently.
export function importCatalog(ctx: Ctx): void {
  const { report } = ctx
  const finding = (f: CatalogFinding) => report.catalogFindings.push(f)
  const nodes = readNodes(ctx, finding)
  if (nodes.size === 0) warn(report, 'catalogo_vacio', 'El catálogo de cuentas está vacío.')

  const insert = ctx.db.prepare(
    `INSERT INTO coa_accounts (id, empresa_id, code, name, type, parent_id, level, is_detail,
       requires_cost_center, budget_group_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
  const levels = new Map<string, number>()
  const types = new Map<string, string>()

  // Parents first, so the foreign key always resolves.
  for (const n of [...nodes.values()].sort((a, b) => a.depth - b.depth)) {
    const parent = n.parent ? nodes.get(n.parent) : undefined
    const parentType = n.parent ? types.get(n.parent) : undefined
    let type: string | null = accountTypeOf(int(n.row['tipocta']))
    if (!type) {
      finding({ code: n.code, kind: 'tipo_invalido', detail: `tipocta ${String(n.row['tipocta'])} fuera de 1..7.` })
      type = parentType ?? 'activo'
    } else if (parentType && parentType !== type) {
      finding({ code: n.code, kind: 'tipo_distinto_al_padre', detail: `Tipo ${type}, el padre es ${parentType}.` })
    }
    if (parent && parent.row['es_detalle'] === true) {
      finding({ code: n.code, kind: 'padre_es_detalle', detail: `La cuenta padre ${n.parent} es de detalle.` })
    }
    const expected = n.parent ? (levels.get(n.parent) ?? 0) + 1 : 1
    const declared = int(n.row['nivel'])
    if (declared !== null && declared !== expected) {
      finding({ code: n.code, kind: 'nivel_incorrecto', detail: `nivel ${declared}, esperado ${expected}.` })
    }
    const level = declared !== null && declared >= 1 ? declared : expected
    const groupCode = str(n.row['codigoa'])
    const id = newId()
    ctx.accounts.set(n.code, id)
    insert.run(
      id, ctx.empresaId, n.code, str(n.row['nombrecta']), type,
      n.parent ? ctx.accounts.get(n.parent)! : null, level,
      n.row['es_detalle'] === true ? 1 : 0, n.row['pcosto'] === true ? 1 : 0,
      groupCode ? ensureBudgetGroup(ctx, groupCode) : null, ctx.now, ctx.now,
    )
    levels.set(n.code, level)
    types.set(n.code, type)
    bump(report, 'coa_accounts')
  }
}
