'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isRole, ROLE_LABELS } from '@accounting/shared'
import { apiFetch, errorMessage } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'

type Module = { id: string; name: string; version: string; isEnabled: boolean; isAlwaysOn: boolean }
type User = { id: string; name: string; email: string; role: string }

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => authClient.getSession(),
  })
  const role = (session?.data?.user as { role?: string } | null | undefined)?.role

  const { data: modules, isLoading, error } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users'),
    enabled: role === 'owner' || role === 'admin' || role === 'supervisor',
  })

  const toggleModule = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      apiFetch(`/api/modules/${id}/${enable ? 'enable' : 'disable'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules'] }),
  })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Configuración" />

      {isLoading && <Loading />}
      {error && <Alert>{errorMessage(error)}</Alert>}
      {toggleModule.error && <Alert>{errorMessage(toggleModule.error)}</Alert>}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Módulos</h2>
        {modules && (
          <Table>
            <thead>
              <tr>
                <Th>Módulo</Th>
                <Th>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.id} className={rowClass}>
                  <Td className="font-medium">
                    {m.name}
                    {m.isAlwaysOn && <span className="ml-2 text-xs text-gray-400">siempre activo</span>}
                  </Td>
                  <Td>{m.isEnabled ? 'Activo' : 'Inactivo'}</Td>
                  <Td className="text-right">
                    {role === 'owner' && !m.isAlwaysOn && (
                      <Button
                        size="sm"
                        variant={m.isEnabled ? 'danger' : 'primary'}
                        disabled={toggleModule.isPending}
                        onClick={() => toggleModule.mutate({ id: m.id, enable: !m.isEnabled })}
                      >
                        {m.isEnabled ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      {(role === 'owner' || role === 'admin' || role === 'supervisor') && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">Usuarios</h2>
          {users && (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Correo electrónico</Th>
                  <Th>Rol</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={rowClass}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td>{u.email}</Td>
                    <Td>{isRole(u.role) ? ROLE_LABELS[u.role] : u.role}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}
    </div>
  )
}
