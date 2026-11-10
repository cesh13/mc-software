'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { ROLE_LABELS, isRole, periodLabel } from '@accounting/shared'
import { authClient } from '@/lib/auth-client'
import { selectEmpresa, useEmpresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { useWorkPeriod } from '@/lib/work-period'
import { Select } from './ui/form'

// Empresa, working month and user — always visible, like the legacy status bar.
export default function TopBar() {
  const router = useRouter()
  const qc = useQueryClient()
  const { empresa, empresas } = useEmpresa()
  const { user } = useCurrentUser()
  const [period] = useWorkPeriod()

  async function logout() {
    await authClient.signOut()
    qc.clear()
    router.replace('/login')
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-2 print:hidden">
      <div className="flex items-center gap-3">
        {empresas.length > 1 ? (
          <Select
            aria-label="Empresa"
            className="w-64 font-medium"
            value={empresa.id}
            onChange={(e) => {
              selectEmpresa(e.target.value)
              qc.invalidateQueries()
            }}
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-sm font-semibold text-gray-900">{empresa.name}</span>
        )}
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Mes de trabajo: {periodLabel(period)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {user && (
          <span>
            {user.name}
            <span className="ml-1 text-xs text-gray-400">
              ({isRole(user.role) ? ROLE_LABELS[user.role] : user.role})
            </span>
          </span>
        )}
        <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="rounded p-1.5 hover:bg-gray-100">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
