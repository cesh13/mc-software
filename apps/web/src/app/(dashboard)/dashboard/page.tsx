'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { Loading, PageHeader } from '@/components/ui/feedback'

type Module = { id: string; name: string; version: string; isEnabled: boolean }

export default function DashboardPage() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => authClient.getSession(),
  })
  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })

  const enabledModules = modules?.filter((m) => m.isEnabled) ?? []
  const name = session?.data?.user?.name

  return (
    <div className="max-w-3xl">
      <PageHeader title="Inicio" subtitle={name ? `Bienvenido, ${name}.` : 'Bienvenido.'} />

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Módulos activos</h2>
        {isLoading && <Loading />}
        {!isLoading && enabledModules.length === 0 && (
          <p className="text-sm text-gray-500">
            No hay módulos activos. Vaya a Configuración para activar módulos.
          </p>
        )}
        {enabledModules.length > 0 && (
          <ul className="grid grid-cols-2 gap-3">
            {enabledModules.map((m) => (
              <li key={m.id} className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
                {m.name} <span className="text-xs text-gray-400">v{m.version}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
