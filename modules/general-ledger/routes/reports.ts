import { Hono } from 'hono'
import { requirePermission, type ModuleEnv } from '@accounting/shared/server'
import {
  accountLedgerQuery,
  annualCloseInput,
  balanceSheetQuery,
  incomeStatementQuery,
  journalQuery,
  trialBalanceQuery,
} from '@accounting/shared'
import { ctxOf } from '../lib/context.js'
import { trialBalance } from '../services/trial-balance.js'
import { accountLedger } from '../services/account-ledger.js'
import { balanceSheet, incomeStatement, journal } from '../services/statements.js'
import { applyAnnualClose, previewAnnualClose } from '../services/annual-close.js'

const router = new Hono<ModuleEnv>()

router.use('/reports/*', requirePermission('reports'))
router.get('/reports/trial-balance', (c) =>
  c.json(trialBalance(ctxOf(c), trialBalanceQuery.parse(c.req.query()))),
)
router.get('/reports/account-ledger', (c) =>
  c.json(accountLedger(ctxOf(c), accountLedgerQuery.parse(c.req.query()))),
)
router.get('/reports/journal', (c) => c.json(journal(ctxOf(c), journalQuery.parse(c.req.query()).period)))
router.get('/reports/balance-sheet', (c) =>
  c.json(balanceSheet(ctxOf(c), balanceSheetQuery.parse(c.req.query()).period)),
)
router.get('/reports/income-statement', (c) => {
  const q = incomeStatementQuery.parse(c.req.query())
  return c.json(incomeStatement(ctxOf(c), q.from, q.to))
})

// Annual close (cierre anual).
router.use('/annual-close/*', requirePermission('supervise'))
router.post('/annual-close/preview', async (c) =>
  c.json(previewAnnualClose(ctxOf(c), annualCloseInput.parse(await c.req.json()))),
)
router.post('/annual-close/apply', async (c) =>
  c.json(applyAnnualClose(ctxOf(c), annualCloseInput.parse(await c.req.json())), 201),
)

export default router
