'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, ACCOUNT_CODE_MAX, type Account, type AccountType } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Alert, Dialog } from '@/components/ui/feedback'
import { Checkbox, Field, Input, Select } from '@/components/ui/form'
import { AccountPicker } from '../AccountPicker'
import { useAccounts, useBudgetGroups, useCoaMutations } from './use-coa'

export type AccountDialogState =
  | { mode: 'add'; parent: Account | null }
  | { mode: 'edit'; account: Account }

export function AccountDialog({
  state,
  onClose,
  onSaved,
}: {
  state: AccountDialogState
  onClose: () => void
  onSaved: (account: Account) => void
}) {
  const edit = state.mode === 'edit' ? state.account : null
  const { byId } = useAccounts()
  const groups = useBudgetGroups()
  const { saveAccount } = useCoaMutations()
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const initialParent = edit
    ? edit.parentId
      ? byId.get(edit.parentId) ?? null
      : null
    : state.mode === 'add'
      ? state.parent
      : null
  const [code, setCode] = useState(edit?.code ?? initialParent?.code ?? '')
  const [name, setName] = useState(edit?.name ?? '')
  const [parent, setParent] = useState<Account | null>(initialParent)
  const [type, setType] = useState<AccountType>(edit?.type ?? initialParent?.type ?? 'activo')
  const [isDetail, setIsDetail] = useState(edit?.isDetail ?? false)
  const [costCenter, setCostCenter] = useState(edit?.requiresCostCenter ?? false)
  const [groupId, setGroupId] = useState(edit?.budgetGroupId ?? '')

  useEffect(() => {
    const el = edit ? nameRef.current : codeRef.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [edit])

  async function save() {
    if (saveAccount.isPending) return
    const common = {
      name,
      type,
      parentId: parent?.id ?? null,
      isDetail,
      requiresCostCenter: isDetail && costCenter,
      budgetGroupId: groupId || null,
    }
    try {
      const saved = await saveAccount.mutateAsync(
        edit ? { id: edit.id, input: common } : { input: { ...common, code: code.trim() } },
      )
      onSaved(saved)
    } catch {
      // The error is shown from saveAccount.error inside the dialog.
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName
    if (e.key === 'F10' || (e.key === 'Enter' && !e.defaultPrevented && tag !== 'BUTTON' && tag !== 'SELECT')) {
      e.preventDefault()
      void save()
    }
  }

  const groupOptions = (groups.data ?? []).filter((g) => g.isActive || g.id === groupId)

  return (
    <Dialog
      open
      title={edit ? 'Modificar cuenta' : 'Agregar cuenta'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar (Esc)</Button>
          <Button variant="primary" disabled={saveAccount.isPending} onClick={() => void save()}>
            Grabar (F10)
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <div className="grid grid-cols-[10rem_1fr] gap-3">
          <Field label="Código">
            <Input ref={codeRef} value={code} maxLength={ACCOUNT_CODE_MAX} disabled={!!edit} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Nombre">
            <Input ref={nameRef} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="coa-parent" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Cuenta padre
          </label>
          <AccountPicker
            id="coa-parent"
            value={parent?.id ?? null}
            excludeDetail
            excludeId={edit?.id}
            onChange={(p) => {
              setParent(p)
              if (p) setType(p.type)
            }}
          />
          {!parent && <p className="text-xs text-gray-400">Vacío = cuenta raíz.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" hint={parent ? 'Heredado de la cuenta padre.' : undefined}>
            <Select value={type} disabled={!!parent} onChange={(e) => setType(e.target.value as AccountType)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Agrupación de presupuesto">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">(ninguna)</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex gap-6">
          <Checkbox
            label="Cuenta de detalle"
            checked={isDetail}
            onChange={(e) => {
              setIsDetail(e.target.checked)
              if (!e.target.checked) setCostCenter(false)
            }}
          />
          <Checkbox
            label="Requiere centro de costo"
            checked={isDetail && costCenter}
            disabled={!isDetail}
            onChange={(e) => setCostCenter(e.target.checked)}
          />
        </div>
        {saveAccount.error && <Alert>{errorMessage(saveAccount.error)}</Alert>}
      </div>
    </Dialog>
  )
}
