'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { authClient } from '@/lib/auth-client'

type Module = { id: string; name: string; version: string; isEnabled: boolean }

export default function DashboardPage() {
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => authClient.getSession(),
  })
  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })

  const enabledModules = modules?.filter((m) => m.isEnabled) ?? []

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">
        Welcome back{session?.data?.user?.name ? `, ${session.data.user.name}` : ''}.
      </p>

      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Active modules
        </h2>
        {enabledModules.length === 0 ? (
          <p className="text-sm text-gray-400">No modules enabled. Go to Settings to enable modules.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {enabledModules.map((m) => (
              <li key={m.id} className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
                {m.name} <span className="text-gray-400 text-xs">v{m.version}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
