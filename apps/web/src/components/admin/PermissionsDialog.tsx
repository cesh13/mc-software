'use client'

import { useState } from 'react'
import { isRole, ROLE_LABELS, type PermissionDef, type PermissionOverride } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import type { Empresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, Dialog, Loading } from '@/components/ui/feedback'
import { Field, Select } from '@/components/ui/form'
import { PermissionsTable } from './PermissionsTable'
import type { AdminUser } from './use-users'
import {
  setOverride, useSaveOverrides, usePermissionCatalog, useUserPermissions, type Effect,
} from './use-user-permissions'

// Permisos tab of a user: role default, override and effective result per permission.
export function PermissionsDialog({
  user, meId, meIsOwner, empresas, onClose,
}: {
  user: AdminUser
  meId: string
  meIsOwner: boolean
  empresas: Empresa[]
  onClose: () => void
}) {
  const catalog = usePermissionCatalog()
  const current = useUserPermissions(user.id)
  const error = catalog.error ?? current.error
  const readOnly = user.id === meId || (user.role === 'owner' && !meIsOwner)
  return (
    <Dialog open wide onClose={onClose} title={`Permisos de ${user.name}`} footer={<Footer canSave={!!catalog.data && !!current.data && !readOnly && user.role !== 'owner'} onClose={onClose} />}>
      {(catalog.isLoading || current.isLoading) && <Loading />}
      {error != null && <Alert>{errorMessage(error)}</Alert>}
      {catalog.data && current.data && (
        <Editor
          key={user.id}
          user={user}
          meId={meId}
          readOnly={readOnly}
          empresas={empresas}
          catalog={catalog.data}
          initial={current.data.overrides}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

function Footer({ canSave, onClose }: { canSave: boolean; onClose: () => void }) {
  // The save button lives in the editor's form so it can read the draft.
  return (
    <>
      <Button onClick={onClose}>Cerrar</Button>
      {canSave && <Button type="submit" form="permissions-form" variant="primary">Guardar</Button>}
    </>
  )
}

function Editor({
  user, meId, readOnly, empresas, catalog, initial, onClose,
}: {
  user: AdminUser
  meId: string
  readOnly: boolean
  empresas: Empresa[]
  catalog: PermissionDef[]
  initial: PermissionOverride[]
  onClose: () => void
}) {
  const save = useSaveOverrides(user.id)
  // The draft holds the overrides of every scope; PUT replaces them all.
  const [draft, setDraft] = useState(initial)
  const [scope, setScope] = useState<string | null>(null)
  const isOwner = user.role === 'owner'
  const others = draft.filter((o) => o.empresaId !== scope).length

  async function submit() {
    try {
      await save.mutateAsync(draft)
      onClose()
    } catch {
      // Shown below.
    }
  }

  return (
    <form id="permissions-form" onSubmit={(e) => { e.preventDefault(); if (!readOnly) void submit() }} className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Rol: <strong>{isRole(user.role) ? ROLE_LABELS[user.role] : user.role}</strong>. Un ajuste concede o niega un permiso
        sobre lo que da el rol; el de una empresa tiene prioridad sobre el de todas las empresas.
      </p>
      {readOnly && (
        <Alert kind="info">
          {user.id === meId ? 'No puede cambiar sus propios permisos.' : 'Solo un propietario puede cambiar los permisos de un propietario.'}
        </Alert>
      )}
      {isOwner && !readOnly && <Alert kind="info">Un propietario tiene todos los permisos y no admite ajustes.</Alert>}
      <Field label="Alcance del ajuste">
        <Select value={scope ?? ''} onChange={(e) => setScope(e.target.value || null)}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </Select>
      </Field>
      {others > 0 && <p className="text-xs text-gray-500">Hay {others} ajuste(s) en otro alcance; se conservan al guardar.</p>}
      <PermissionsTable
        role={user.role}
        catalog={catalog}
        overrides={draft}
        scope={scope}
        readOnly={readOnly}
        isOwner={isOwner}
        onChange={(permission: string, effect: Effect | null) => setDraft((d) => setOverride(d, permission, scope, effect))}
      />
      {save.error && <Alert>{errorMessage(save.error)}</Alert>}
    </form>
  )
}
