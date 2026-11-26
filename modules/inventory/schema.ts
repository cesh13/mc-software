import { invGroups, invItems, invMovementTypes, invWarehouses } from './schema/catalogs.js'
import { invCostState, invDocuments, invMovements } from './schema/movements.js'

export * from './schema/catalogs.js'
export * from './schema/movements.js'

export default { invWarehouses, invGroups, invItems, invMovementTypes, invDocuments, invMovements, invCostState }
