'use client'

import { useState } from 'react'
import { ROLE_LABELS } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import type { Empresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, ConfirmDialog, Dialog } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/form'
import { EmpresaChecklist } from './EmpresaChecklist'
import {
  ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, useUserMutations,
  type AdminUser, type AssignableRole,
} from './use-users'

const ALIASES: Record<string, AssignableRole> = { admin: 'supervisor', member: 'consulta' }
const asAssignable = (role: string): AssignableRole =>
  (ASSIGNABLE_ROLES as readonly string[]).includes(role) ? (role as AssignableRole) : ALIASES[role] ?? 'consulta'

// Add (user === null) or modify one user.
export function UserDialog({
  user, meId, meIsOwner, empresas, onClose,
}: {
  user: AdminUser | null
  meId: string | undefined
  meIsOwner: boolean
  empresas: Empresa[]
  onClose: () => void
}) {
  const { create, update, setBanned } = useUserMutations()
  const initialRole = user ? asAssignable(user.role) : 'consulta'
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [role, setRole] = useState<AssignableRole>(initialRole)
  const [ids, setIds] = useState<string[]>(user?.empresaIds ?? [])
  const [confirm, setConfirm] = useState(false)

  const isSelf = !!user && user.id === meId
  const locked = !!user && user.role === 'owner' && !meIsOwner
  const roles = ASSIGNABLE_ROLES.filter((r) => r !== 'owner' || meIsOwner)
  const known = new Set(empresas.map((e) => e.id))
  const visibleIds = ids.filter((i) => known.has(i))
  const hiddenIds = ids.filter((i) => !known.has(i)) // grants to empresas this caller cannot see are kept
  const pending = create.isPending || update.isPending || setBanned.isPending
  const error = create.error ?? update.error ?? setBanned.error
  const invalid = !name.trim() || (!user && (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8))

  async function save() {
    try {
      if (!user) {
        await create.mutateAsync({ name, email, password, role, empresaIds: role === 'owner' ? [] : ids })
      } else {
        const patch: { name?: string; role?: string } = {}
        if (name.trim() !== user.name) patch.name = name
        if (role !== initialRole) patch.role = role
        const grants = role === 'owner' ? undefined : ids
        const changed = grants && [...grants].sort().join() !== [...user.empresaIds].sort().join()
        await update.mutateAsync({
          id: user.id,
          patch: Object.keys(patch).length ? patch : undefined,
          empresaIds: changed ? grants : undefined,
        })
      }
      onClose()
    } catch {
      // The error is shown in the dialog.
    }
  }

  async function toggleBan() {
    if (!user) return
    try {
      await setBanned.mutateAsync({ id: user.id, banned: !user.banned })
      setConfirm(false)
      onClose()
    } catch {
      setConfirm(false)
    }
  }

  return (
    <>
      <Dialog
        open
        title={user ? 'Modificar usuario' : 'Agregar usuario'}
        onClose={confirm ? () => {} : onClose}
        footer={
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={pending || invalid || locked} onClick={() => void save()}>Grabar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {locked && <Alert kind="info">Solo un propietario puede modificar a otro propietario.</Alert>}
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus disabled={locked} />
          </Field>
          {user ? (
            <Field label="Correo"><Input value={user.email} readOnly /></Field>
          ) : (
            <>
              <Field label="Correo">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Contraseña" hint="Mínimo 8 caracteres.">
                <div className="flex gap-2">
                  <Input type={showPw ? 'text' : 'password'} value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
                  <Button onClick={() => setShowPw(!showPw)} aria-pressed={showPw}>{showPw ? 'ocultar' : 'mostrar'}</Button>
                </div>
              </Field>
            </>
          )}
          <Field label="Rol" hint={isSelf ? 'No puede cambiar su propio rol.' : ROLE_DESCRIPTIONS[role]}>
            <Select value={role} disabled={isSelf || locked} onChange={(e) => setRole(e.target.value as AssignableRole)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <EmpresaChecklist
            empresas={empresas}
            value={visibleIds}
            disabled={role === 'owner' || locked}
            onChange={(v) => setIds([...hiddenIds, ...v])}
          />
          {user && (
            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
              <Button variant="danger" disabled={isSelf || locked || pending} onClick={() => { setBanned.reset(); setConfirm(true) }}>
                {user.banned ? 'Desbloquear' : 'Bloquear'}
              </Button>
              {isSelf && <span className="text-xs text-gray-500">No puede bloquearse a sí mismo.</span>}
              {user.banned && !isSelf && <span className="text-xs text-gray-500">Este usuario no puede iniciar sesión.</span>}
            </div>
          )}
          {error && !confirm && <Alert>{errorMessage(error)}</Alert>}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        danger={!user?.banned}
        title={user?.banned ? 'Desbloquear usuario' : 'Bloquear usuario'}
        confirmLabel={user?.banned ? 'Desbloquear' : 'Bloquear'}
        message={
          user?.banned
            ? `¿Desea desbloquear a ${user?.name}? Podrá iniciar sesión de nuevo.`
            : `¿Desea bloquear a ${user?.name}? Dejará de tener acceso al sistema.`
        }
        onConfirm={() => void toggleBan()}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
