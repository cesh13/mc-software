// Production entry: modules are compiled into the bundle instead of being
// discovered on disk. Bundled by build/build.mjs (not part of tsc).
import { start } from '../src/server.js'
import { manifest as chartOfAccounts } from '../../../modules/chart-of-accounts/manifest.js'
import { manifest as generalLedger } from '../../../modules/general-ledger/manifest.js'
import { manifest as accountsPayable } from '../../../modules/accounts-payable/manifest.js'
import { manifest as accountsReceivable } from '../../../modules/accounts-receivable/manifest.js'
import { manifest as fixedAssets } from '../../../modules/fixed-assets/manifest.js'
import { manifest as inventory } from '../../../modules/inventory/manifest.js'
import { manifest as payroll } from '../../../modules/payroll/manifest.js'
import { manifest as reports } from '../../../modules/reports/manifest.js'


start({
  manifests: [
    chartOfAccounts, generalLedger, accountsPayable, accountsReceivable,
    fixedAssets, inventory, payroll, reports,
  ],
}).catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
