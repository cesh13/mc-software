'use client'

import { useState, type KeyboardEvent } from 'react'
import type { CostCenter } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, Dialog } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/form'
import { SetupScreen, type DialogState } from './SetupScreen'
import { useCostCenters, useSetupMutations } from './use-gl-setup'

export function CostCentersScreen() {
  const [showInactive, setShowInactive] = useState(false)
  const list = useCostCenters(showInactive)
  const { setCenterActive } = useSetupMutations()
  return (
    <SetupScreen<CostCenter>
      title="Centros de costo"
      noun="centro de costo"
      rows={list.data}
      loading={list.isLoading}
      error={list.error}
      showInactive={showInactive}
      onShowInactive={setShowInactive}
      setActive={setCenterActive}
      columns={[
        { label: 'Código', className: 'w-24 font-mono text-xs', render: (c) => c.code },
        { label: 'Nombre', render: (c) => <>{c.name}{!c.isActive && <span className="ml-2 text-xs italic">(inactivo)</span>}</> },
      ]}
      renderDialog={(state, close, onSaved) => (
        <CostCenterDialog key={state.mode === 'edit' ? state.item.id : 'add'} state={state} onClose={close} onSaved={onSaved} />
      )}
    />
  )
}

function CostCenterDialog({
  state, onClose, onSaved,
}: {
  state: DialogState<CostCenter>
  onClose: () => void
  onSaved: (c: CostCenter) => void
}) {
  const edit = state.mode === 'edit' ? state.item : null
  const { saveCenter } = useSetupMutations()
  const [code, setCode] = useState(edit?.code ?? '')
  const [name, setName] = useState(edit?.name ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  async function save() {
    if (saveCenter.isPending) return
    if (!code.trim()) return setLocalError('Escriba el código (hasta 3 caracteres).')
    if (!name.trim()) return setLocalError('Escriba el nombre.')
    setLocalError(null)
    const input = { code: code.trim(), name: name.trim() }
    try {
      onSaved(await saveCenter.mutateAsync(edit ? { id: edit.id, input } : { input }))
    } catch {
      // Shown below.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'F10' || (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT')) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <Dialog
      open
      title={edit ? 'Modificar centro de costo' : 'Agregar centro de costo'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar (Esc)</Button>
          <Button variant="primary" disabled={saveCenter.isPending} onClick={() => void save()}>Grabar (F10)</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field label="Código">
            <Input
              autoFocus
              value={code}
              maxLength={3}
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Nombre">
            <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        {(localError || saveCenter.error) && <Alert>{localError ?? errorMessage(saveCenter.error)}</Alert>}
      </div>
    </Dialog>
  )
}
