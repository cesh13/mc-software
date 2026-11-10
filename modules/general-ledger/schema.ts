import { glEntryTypes, glCostCenters, glFiscalYears, glPeriods } from './schema/setup.js'
import { glJournalEntries, glJournalLines } from './schema/entries.js'
import { glBudgets } from './schema/budgets.js'

export * from './schema/setup.js'
export * from './schema/entries.js'
export * from './schema/budgets.js'

// Statement layouts (legacy ESTADO01/02/03) are not modeled yet: they wait on
// open question 8 (one report engine with templates) and the .frx extraction.

export default {
  glEntryTypes,
  glCostCenters,
  glFiscalYears,
  glPeriods,
  glJournalEntries,
  glJournalLines,
  glBudgets,
}
