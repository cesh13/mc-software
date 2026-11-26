import type { ItemGroup, MovementType, Warehouse } from '@accounting/shared'
import { RuleError } from '@accounting/shared/server'
import { invGroups, invMovementTypes, invWarehouses } from '../schema.js'
import { assertAccount } from './common.js'
import { catalog } from './catalog-crud.js'

type Row<T> = T & { createdAt: string; updatedAt: string; empresaId: string }

export const warehouses = catalog<Row<Warehouse>>({
  table: invWarehouses as never, entity: 'bodega', noun: 'una bodega', label: 'La bodega',
})

export const groups = catalog<Row<ItemGroup>>({
  table: invGroups as never, entity: 'grupo', noun: 'un grupo', label: 'El grupo',
  validate: (ctx, input) => {
    assertAccount(ctx, input.inventoryAccountId as string | null, 'cuenta de inventario')
    assertAccount(ctx, input.cogsAccountId as string | null, 'cuenta de costo')
  },
})

export const movementTypes = catalog<Row<MovementType>>({
  table: invMovementTypes as never, entity: 'tipo_movimiento', noun: 'un tipo de movimiento', label: 'El tipo de movimiento',
  validate: (ctx, input, existing) => {
    assertAccount(ctx, input.counterAccountId as string | null, 'contrapartida')
    const direction = (input.direction ?? existing?.direction) as string
    const kind = (input.kind ?? existing?.kind) as string
    if ((direction === 'transfer') !== (kind === 'transferencia')) {
      throw new RuleError('Las transferencias usan el tipo "Transferencia" y viceversa.', 400, 'type_invalid')
    }
    if (kind === 'inicial' && direction !== 'in') {
      throw new RuleError('El inventario inicial es una entrada.', 400, 'type_invalid')
    }
    if (kind === 'compra' && direction !== 'in') {
      throw new RuleError('Una compra es una entrada.', 400, 'type_invalid')
    }
    if (existing && input.direction && input.direction !== existing.direction) {
      throw new RuleError('No se puede cambiar la dirección de un tipo de movimiento; cree otro.', 409, 'type_direction_locked')
    }
  },
})
