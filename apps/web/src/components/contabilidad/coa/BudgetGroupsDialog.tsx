'use client'

import { useState } from 'react'
import { BUDGET_GROUP_CODE_MAX, type BudgetGroup } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { useCurrentUser } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Alert, Dialog, Loading } from '@/components/ui/feedback'
import { Input } from '@/components/ui/form'
import { Td, Th } from '@/components/ui/table'
import { useBudgetGroups, useCoaMutations } from './use-coa'

export function BudgetGroupsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can } = useCurrentUser()
  const { data, isLoading, error } = useBudgetGroups()
  const { createGroup, updateGroup, setGroupActive } = useCoaMutations()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const failure = createGroup.error ?? updateGroup.error ?? setGroupActive.error

  async function add() {
    try {
      await createGroup.mutateAsync({ code, name })
      setCode('')
      setName('')
    } catch {
      // Shown below.
    }
  }

  async function rename() {
    if (!editing) return
    try {
      await updateGroup.mutateAsync({ id: editing.id, input: { name: editing.name } })
      setEditing(null)
    } catch {
      // Shown below.
    }
  }

  const row = (g: BudgetGroup) => (
    <tr key={g.id} className={g.isActive ? '' : 'text-gray-400'}>
      <Td className="font-mono text-xs">{g.code}</Td>
      <Td>
        {editing?.id === g.id ? (
          <Input
            aria-label="Nombre de la agrupación"
            autoFocus
            value={editing.name}
            maxLength={60}
            onChange={(e) => setEditing({ id: g.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void rename()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setEditing(null)
              }
            }}
          />
        ) : (
          g.name
        )}
      </Td>
      <Td className="whitespace-nowrap text-right">
        {editing?.id === g.id ? (
          <Button size="sm" variant="primary" onClick={() => void rename()}>Grabar</Button>
        ) : (
          <>
            {can('capture') && g.isActive && (
              <Button size="sm" variant="ghost" onClick={() => setEditing({ id: g.id, name: g.name })}>Renombrar</Button>
            )}
            {can('supervise') && (
              <Button size="sm" variant="ghost" onClick={() => setGroupActive.mutate({ id: g.id, active: !g.isActive })}>
                {g.isActive ? 'Desactivar' : 'Reactivar'}
              </Button>
            )}
          </>
        )}
      </Td>
    </tr>
  )

  return (
    <Dialog open={open} onClose={onClose} title="Agrupaciones de presupuesto" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <div className="flex flex-col gap-3">
        {isLoading && <Loading />}
        {error && <Alert>{errorMessage(error)}</Alert>}
        {data && data.length === 0 && <p className="text-sm text-gray-500">No hay agrupaciones registradas.</p>}
        {data && data.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr><Th className="w-20">Código</Th><Th>Nombre</Th><Th /></tr>
            </thead>
            <tbody>{data.map(row)}</tbody>
          </table>
        )}
        {can('capture') && (
          <form
            className="flex items-end gap-2 border-t border-gray-200 pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <label className="w-20 text-xs font-medium uppercase text-gray-500">
              Código
              <Input value={code} maxLength={BUDGET_GROUP_CODE_MAX} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="flex-1 text-xs font-medium uppercase text-gray-500">
              Nombre
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
            <Button type="submit" variant="primary" disabled={createGroup.isPending}>Agregar</Button>
          </form>
        )}
        {failure && <Alert>{errorMessage(failure)}</Alert>}
      </div>
    </Dialog>
  )
}
