'use client'

import { useState, type KeyboardEvent } from 'react'
import type { EntryType } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, Dialog } from '@/components/ui/feedback'
import { Checkbox, Field, Input } from '@/components/ui/form'
import { SetupScreen, type DialogState } from './SetupScreen'
import { useEntryTypes, useSetupMutations } from './use-gl-setup'

export function EntryTypesScreen() {
  const [showInactive, setShowInactive] = useState(false)
  const list = useEntryTypes(showInactive)
  const { setTypeActive } = useSetupMutations()
  return (
    <SetupScreen<EntryType>
      title="Tipos de partida"
      noun="tipo de partida"
      rows={list.data}
      loading={list.isLoading}
      error={list.error}
      showInactive={showInactive}
      onShowInactive={setShowInactive}
      setActive={setTypeActive}
      columns={[
        { label: 'Código', className: 'w-20 font-mono text-xs', render: (t) => t.code },
        { label: 'Nombre', render: (t) => <>{t.name}{!t.isActive && <span className="ml-2 text-xs italic">(inactivo)</span>}</> },
        { label: 'Usa bancos', className: 'w-28 text-center', render: (t) => (t.isBank ? 'Sí' : '') },
        { label: 'Ancho del número', className: 'w-36 text-right tabular-nums', render: (t) => t.numberWidth },
      ]}
      renderDialog={(state, close, onSaved) => (
        <EntryTypeDialog key={state.mode === 'edit' ? state.item.id : 'add'} state={state} onClose={close} onSaved={onSaved} />
      )}
    />
  )
}

function EntryTypeDialog({
  state, onClose, onSaved,
}: {
  state: DialogState<EntryType>
  onClose: () => void
  onSaved: (t: EntryType) => void
}) {
  const edit = state.mode === 'edit' ? state.item : null
  const { saveType } = useSetupMutations()
  const [code, setCode] = useState(edit?.code ?? '')
  const [name, setName] = useState(edit?.name ?? '')
  const [isBank, setIsBank] = useState(edit?.isBank ?? false)
  const [width, setWidth] = useState(String(edit?.numberWidth ?? 6))
  const [localError, setLocalError] = useState<string | null>(null)

  async function save() {
    if (saveType.isPending) return
    const numberWidth = Number(width)
    if (!/^[A-Z0-9]{2}$/.test(code)) return setLocalError('El código lleva 2 caracteres (letras o números).')
    if (!name.trim()) return setLocalError('Escriba el nombre.')
    if (!Number.isInteger(numberWidth) || numberWidth < 1 || numberWidth > 10) {
      return setLocalError('El ancho del número va de 1 a 10.')
    }
    setLocalError(null)
    const input = { code, name: name.trim(), isBank, numberWidth }
    try {
      onSaved(await saveType.mutateAsync(edit ? { id: edit.id, input } : { input }))
    } catch {
      // Shown below.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName
    if (e.key === 'F10' || (e.key === 'Enter' && tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'checkbox')) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <Dialog
      open
      title={edit ? 'Modificar tipo de partida' : 'Agregar tipo de partida'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar (Esc)</Button>
          <Button variant="primary" disabled={saveType.isPending} onClick={() => void save()}>Grabar (F10)</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field label="Código">
            <Input
              autoFocus
              value={code}
              maxLength={2}
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
          </Field>
          <Field label="Nombre">
            <Input value={name} maxLength={25} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Ancho del número" hint="Dígitos con ceros a la izquierda (CP usa 7).">
            <Input inputMode="numeric" value={width} maxLength={2} onChange={(e) => setWidth(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="pb-6">
            <Checkbox label="Usa bancos" checked={isBank} onChange={(e) => setIsBank(e.target.checked)} />
          </div>
        </div>
        {edit && edit.code !== code && (
          <Alert kind="warning">Cambiar el código afecta cómo se muestran las partidas ya grabadas con este tipo.</Alert>
        )}
        {(localError || saveType.error) && <Alert>{localError ?? errorMessage(saveType.error)}</Alert>}
      </div>
    </Dialog>
  )
}
