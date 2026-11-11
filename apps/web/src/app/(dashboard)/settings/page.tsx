'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { apiFetch, errorMessage } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'

type Module = { id: string; name: string; version: string; isEnabled: boolean; isAlwaysOn: boolean }

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

      <section className="mt-8">
        <h2 className="mb-1 text-sm font-semibold text-gray-800">Usuarios</h2>
        <p className="text-sm text-gray-600">
          Los usuarios, sus roles y sus empresas se administran en{' '}
          <Link href="/usuarios" className="text-blue-700 underline">Usuarios</Link>.
        </p>
      </section>
    </div>
  )
}
