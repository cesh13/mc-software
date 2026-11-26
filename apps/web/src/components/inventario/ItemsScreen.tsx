'use client'

import { useState } from 'react'
import type { Item } from '@accounting/shared'
import { SetupScreen } from '@/components/contabilidad/entries/SetupScreen'
import { FormDialog, type FormField } from './FormDialog'
import { formatQty } from './format'
import { useCatalog, useCatalogMutations, useItems } from './use-inventory'

// Productos (legacy "Mantenimiento de Artículos"). Stock and cost are not
// stored on the item: see Existencias and Kárdex.
export function ItemsScreen() {
  const [showInactive, setShowInactive] = useState(false)
  const list = useItems(showInactive)
  const groups = useCatalog('groups')
  const { save, setActive } = useCatalogMutations('items')
  const fields: FormField[] = [
    { key: 'code', label: 'Código', kind: 'text', maxLength: 20, upper: true, required: true },
    { key: 'unit', label: 'Unidad de medida', kind: 'text', maxLength: 20, upper: true, required: true },
    { key: 'name', label: 'Descripción', kind: 'text', maxLength: 120, required: true, span: 2 },
    {
      key: 'groupId', label: 'Grupo', kind: 'select',
      options: [{ value: '', label: '(sin grupo)' }, ...(groups.data ?? []).map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` }))],
    },
    { key: 'barcode', label: 'Código de barras', kind: 'text', maxLength: 40 },
    { key: 'minQty', label: 'Existencia mínima', kind: 'text', maxLength: 20 },
    { key: 'maxQty', label: 'Existencia máxima', kind: 'text', maxLength: 20 },
    { key: 'tracksLots', label: 'Maneja lotes y vencimiento', kind: 'check' },
    { key: 'isService', label: 'Es servicio (no lleva existencias)', kind: 'check' },
    { key: 'inventoryAccountId', label: 'Cuenta de inventario', kind: 'account', hint: 'Vacía: la del grupo.' },
    { key: 'cogsAccountId', label: 'Cuenta de costo', kind: 'account', hint: 'Vacía: la del grupo.' },
  ]
  return (
    <SetupScreen<Item>
      title="Productos"
      managePermission="inv.item.manage"
      noun="producto"
      rows={list.data}
      loading={list.isLoading}
      error={list.error}
      showInactive={showInactive}
      onShowInactive={setShowInactive}
      setActive={setActive}
      columns={[
        { label: 'Código', className: 'w-36 font-mono text-xs', render: (r) => r.code },
        { label: 'Descripción', render: (r) => <>{r.name}{!r.isActive && <span className="ml-2 text-xs italic">(inactivo)</span>}</> },
        { label: 'Grupo', className: 'w-24 font-mono text-xs', render: (r) => r.groupCode ?? '' },
        { label: 'Unidad', className: 'w-24', render: (r) => r.unit },
        { label: 'Mínimo', className: 'w-20 text-right', render: (r) => formatQty(r.minQty) },
        { label: 'Lotes', className: 'w-14 text-center', render: (r) => (r.tracksLots ? 'Sí' : '') },
        { label: 'Servicio', className: 'w-16 text-center', render: (r) => (r.isService ? 'Sí' : '') },
      ]}
      renderDialog={(state, close, onSaved) => {
        const edit = state.mode === 'edit' ? state.item : null
        return (
          <FormDialog
            key={edit?.id ?? 'add'}
            title={edit ? `Modificar producto ${edit.code}` : 'Agregar producto'}
            fields={fields}
            editing={!!edit}
            saving={save.isPending}
            error={save.error}
            initial={{
              code: edit?.code ?? '', unit: edit?.unit ?? 'UNIDAD', name: edit?.name ?? '', groupId: edit?.groupId ?? '',
              barcode: edit?.barcode ?? '', minQty: edit?.minQty ? formatQty(edit.minQty).replace(/,/g, '') : '',
              maxQty: edit?.maxQty ? formatQty(edit.maxQty).replace(/,/g, '') : '',
              tracksLots: edit?.tracksLots ?? false, isService: edit?.isService ?? false,
              inventoryAccountId: edit?.inventoryAccountId ?? null, cogsAccountId: edit?.cogsAccountId ?? null,
            }}
            onClose={close}
            onSave={async (values) => onSaved((await save.mutateAsync({ id: edit?.id, input: values })) as Item)}
          />
        )
      }}
    />
  )
}
