import { Decimal } from 'decimal.js'
import { ensureCostCenter, newId, type Ctx } from './context.js'
import { money, str } from './source.js'
import { bump, warn } from './types.js'

type BudgetRow = { year: string; account: string; cc: string; amounts: string[] }

// PRESUP rows that can be mapped: a 4-digit year, an account that exists in the
// catalog, and at least one non-zero month. The rest are counted and skipped
// (budgets never affect balances).
export function budgetRows(ctx: Ctx): BudgetRow[] {
  const { report } = ctx
  const merged = new Map<string, BudgetRow>()
  for (const r of ctx.src['presup']!) {
    report.budgets.rowsRead++
    const year = str(r['periodo'])
    const account = str(r['cuenta'])
    const amounts = Array.from({ length: 12 }, (_, i) => money(report, r[`pmes${i + 1}`], 'presupuesto'))
    if (!/^\d{4}$/.test(year)) {
      report.budgets.rowsSkipped++
      if (amounts.some((a) => !new Decimal(a).isZero())) warn(report, 'presupuesto_periodo_invalido', `Presupuesto con monto y período '${year}' no es un año; no se importó (${account}).`)
      continue
    }
    if (!ctx.accounts.has(account)) {
      report.budgets.rowsSkipped++
      if (amounts.some((a) => !new Decimal(a).isZero())) warn(report, 'presupuesto_cuenta_no_encontrada', `Presupuesto con monto de la cuenta ${account} que no está en el catálogo; no se importó.`)
      continue
    }
    if (amounts.every((a) => new Decimal(a).isZero())) {
      report.budgets.rowsSkipped++
      continue
    }
    const cc = str(r['ccosto'])
    const key = `${year}|${account}|${cc}`
    const prev = merged.get(key)
    if (prev) {
      warn(report, 'presupuesto_repetido', `Presupuesto repetido ${key}; se sumaron los montos.`)
      prev.amounts = prev.amounts.map((a, i) => new Decimal(a).plus(amounts[i]!).toFixed(2))
    } else {
      merged.set(key, { year, account, cc, amounts })
    }
  }
  return [...merged.values()]
}

// PRESUP → gl_budgets (pmes1..pmes12 → month 1..12). Zero months are not stored.
export function importBudgets(ctx: Ctx, rows: BudgetRow[], fiscalYears: Map<string, string>): void {
  const insert = ctx.db.prepare(
    `INSERT INTO gl_budgets (id, empresa_id, fiscal_year_id, account_id, cost_center_id, month, amount, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const r of rows) {
    const ccId = r.cc ? ensureCostCenter(ctx, r.cc) : null
    let months = 0
    r.amounts.forEach((amount, i) => {
      if (new Decimal(amount).isZero()) return
      insert.run(newId(), ctx.empresaId, fiscalYears.get(r.year)!, ctx.accounts.get(r.account)!, ccId, i + 1, amount, ctx.now)
      months++
    })
    ctx.report.budgets.rowsImported++
    ctx.report.budgets.monthsImported += months
    bump(ctx.report, 'gl_budgets', months)
  }
}
