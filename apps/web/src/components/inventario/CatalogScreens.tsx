'use client'

import { useState } from 'react'
import { INV_DIRECTION_LABELS, INV_DIRECTIONS, INV_KIND_LABELS, INV_KINDS } from '@accounting/shared'
import { SetupScreen, type SetupColumn, type SetupItem } from '@/components/contabilidad/entries/SetupScreen'
import { useAccounts } from '@/components/contabilidad/coa/use-coa'
import { FormDialog, type FormField } from './FormDialog'
import { useCatalog, useCatalogMutations, type Catalog } from './use-inventory'

type Row = SetupItem & Record<string, unknown>

function CatalogScreen(p: { catalog: Catalog; title: string; noun: string; fields: FormField[]; columns: SetupColumn<Row>[]; blank: Record<string, string | boolean | null> }) {
  const [showInactive, setShowInactive] = useState(false)
  const list = useCatalog(p.catalog, showInactive)
  const { save, setActive } = useCatalogMutations(p.catalog)
  return (
    <SetupScreen<Row>
      title={p.title}
      managePermission="inv.config.manage"
      noun={p.noun}
      rows={list.data as Row[] | undefined}
      loading={list.isLoading}
      error={list.error}
      showInactive={showInactive}
      onShowInactive={setShowInactive}
      setActive={setActive}
      columns={[
        { label: 'Código', className: 'w-24 font-mono text-xs', render: (r) => r.code },
        { label: 'Nombre', render: (r) => <>{r.name}{!r.isActive && <span className="ml-2 text-xs italic">(inactivo)</span>}</> },
        ...p.columns,
      ]}
      renderDialog={(state, close, onSaved) => {
        const edit = state.mode === 'edit' ? state.item : null
        const initial = Object.fromEntries(Object.keys(p.blank).map((k) => [k, (edit?.[k] as string | boolean | null) ?? p.blank[k]!]))
        return (
          <FormDialog
            key={edit?.id ?? 'add'}
            title={`${edit ? 'Modificar' : 'Agregar'} ${p.noun}`}
            fields={p.fields}
            initial={initial}
            editing={!!edit}
            saving={save.isPending}
            error={save.error}
            onClose={close}
            onSave={async (values) => onSaved((await save.mutateAsync({ id: edit?.id, input: values })) as Row)}
          />
        )
      }}
    />
  )
}

function useAccountCode() {
  const { byId } = useAccounts()
  return (id: unknown) => (typeof id === 'string' ? byId.get(id)?.code ?? '' : '')
}

const code = (max: number): FormField => ({ key: 'code', label: 'Código', kind: 'text', maxLength: max, upper: true, required: true })
const name: FormField = { key: 'name', label: 'Nombre', kind: 'text', maxLength: 60, required: true }

export function WarehousesScreen() {
  return (
    <CatalogScreen
      catalog="warehouses" title="Bodegas" noun="bodega"
      blank={{ code: '', name: '', address: '' }}
      fields={[code(5), name, { key: 'address', label: 'Dirección', kind: 'text', maxLength: 120, span: 2 }]}
      columns={[{ label: 'Dirección', render: (r) => (r.address as string) ?? '' }]}
    />
  )
}

export function GroupsScreen() {
  const acc = useAccountCode()
  return (
    <CatalogScreen
      catalog="groups" title="Grupos de productos" noun="grupo"
      blank={{ code: '', name: '', inventoryAccountId: null, cogsAccountId: null }}
      fields={[
        code(10), name,
        { key: 'inventoryAccountId', label: 'Cuenta de inventario', kind: 'account' },
        { key: 'cogsAccountId', label: 'Cuenta de costo', kind: 'account', hint: 'Para salidas sin contrapartida propia.' },
      ]}
      columns={[
        { label: 'Cta. inventario', className: 'w-32 font-mono text-xs', render: (r) => acc(r.inventoryAccountId) },
        { label: 'Cta. costo', className: 'w-32 font-mono text-xs', render: (r) => acc(r.cogsAccountId) },
      ]}
    />
  )
}

export function MovementTypesScreen() {
  const acc = useAccountCode()
  return (
    <CatalogScreen
      catalog="movement-types" title="Tipos de movimiento" noun="tipo de movimiento"
      blank={{ code: '', name: '', direction: 'in', kind: 'compra', counterAccountId: null }}
      fields={[
        code(3), name,
        { key: 'direction', label: 'Movimiento', kind: 'select', disabledOnEdit: true, options: INV_DIRECTIONS.map((d) => ({ value: d, label: INV_DIRECTION_LABELS[d] })) },
        { key: 'kind', label: 'Clase', kind: 'select', options: INV_KINDS.map((k) => ({ value: k, label: INV_KIND_LABELS[k] })) },
        { key: 'counterAccountId', label: 'Contrapartida contable', kind: 'account', span: 2, hint: 'Vacía en salidas: usa la cuenta de costo del producto o su grupo.' },
      ]}
      columns={[
        { label: 'Movimiento', className: 'w-32', render: (r) => INV_DIRECTION_LABELS[r.direction as 'in'] },
        { label: 'Clase', className: 'w-44', render: (r) => INV_KIND_LABELS[r.kind as 'compra'] },
        { label: 'Contrapartida', className: 'w-32 font-mono text-xs', render: (r) => acc(r.counterAccountId) },
      ]}
    />
  )
}
