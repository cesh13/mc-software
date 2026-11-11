'use client'

import { useMemo, useRef, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { useEmpresas } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { ActionToolbar } from '@/components/ui/toolbar'
import { UserDialog } from './UserDialog'
import { UsersTable } from './UsersTable'
import { useUsers, type AdminUser } from './use-users'

type DialogState = { user: AdminUser | null } | null

export function UsersScreen() {
  const { user: me, can } = useCurrentUser()
  const allowed = can('supervise')
  const users = useUsers(allowed)
  const empresas = useEmpresas()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const siglas = useMemo(() => new Map((empresas.data ?? []).map((e) => [e.id, e.siglas])), [empresas.data])
  const siglasOf = (u: AdminUser) => {
    if (u.role === 'owner') return 'Todas'
    const known = u.empresaIds.map((id) => siglas.get(id)).filter(Boolean)
    const hidden = u.empresaIds.length - known.length
    return [...known, ...(hidden ? [`+${hidden}`] : [])].join(', ')
  }

  if (!me) return <Loading />
  if (!allowed) return <Alert kind="warning">No tiene permiso para administrar usuarios.</Alert>

  const selected = users.data?.find((u) => u.id === selectedId) ?? null
  const close = () => {
    setDialog(null)
    setTimeout(() => tableRef.current?.focus(), 0)
  }
  const openEdit = (u: AdminUser | null) => u && setDialog({ user: u })

  return (
    <div className="max-w-5xl">
      <PageHeader title="Usuarios" subtitle="Cuentas, roles y empresas en las que puede trabajar cada usuario." />
      <div className="mb-3">
        <ActionToolbar
          shortcuts={dialog === null}
          actions={{
            agregar: () => setDialog({ user: null }),
            modificar: selected ? () => openEdit(selected) : undefined,
          }}
        />
      </div>
      {users.isLoading && <Loading />}
      {users.error && <Alert>{errorMessage(users.error)}</Alert>}
      {users.data?.length === 0 && <p className="py-6 text-sm text-gray-500">No hay usuarios. Use Agregar para crear el primero.</p>}
      {!!users.data?.length && (
        <UsersTable
          rows={users.data}
          selectedId={selectedId}
          siglasOf={siglasOf}
          onSelect={setSelectedId}
          onOpen={openEdit}
          wrapRef={tableRef}
        />
      )}
      {dialog && (
        <UserDialog
          key={dialog.user?.id ?? 'add'}
          user={dialog.user}
          meId={me.id}
          meIsOwner={me.role === 'owner'}
          empresas={empresas.data ?? []}
          onClose={close}
        />
      )}
    </div>
  )
}
