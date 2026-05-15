'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { authClient } from '@/lib/auth-client'

type Module = { id: string; name: string; version: string; isEnabled: boolean; isAlwaysOn: boolean }
type User = { id: string; name: string; email: string; role: string }

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: () => authClient.getSession(),
  })
  const role = (session?.data?.user as { role?: string } | null | undefined)?.role

  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users'),
    enabled: role === 'owner' || role === 'admin',
  })

  const toggleModule = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      apiFetch(`/api/modules/${id}/${enable ? 'enable' : 'disable'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modules'] }),
  })

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      {/* Modules */}
      <section>
        <h2 className="text-base font-medium text-gray-800 mb-3">Modules</h2>
        <ul className="flex flex-col gap-2">
          {(modules ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
              <div>
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
                {m.isAlwaysOn && (
                  <span className="ml-2 text-xs text-gray-400">always on</span>
                )}
              </div>
              {role === 'owner' && !m.isAlwaysOn && (
                <button
                  onClick={() => toggleModule.mutate({ id: m.id, enable: !m.isEnabled })}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    m.isEnabled
                      ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600'
                      : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {m.isEnabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Users */}
      {(role === 'owner' || role === 'admin') && (
        <section>
          <h2 className="text-base font-medium text-gray-800 mb-3">Users</h2>
          <ul className="flex flex-col gap-2">
            {(users ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-800">{u.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{u.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
