'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

type Module = { id: string; name: string; isEnabled: boolean; isAlwaysOn: boolean }
type NavItem = { label: string; path: string; icon: string }

const MODULE_NAV: Record<string, NavItem[]> = {
  'chart-of-accounts': [{ label: 'Chart of Accounts', path: '/chart-of-accounts', icon: 'BookOpen' }],
  'general-ledger': [{ label: 'General Ledger', path: '/general-ledger', icon: 'BookMarked' }],
  'accounts-payable': [{ label: 'Accounts Payable', path: '/accounts-payable', icon: 'ArrowDownCircle' }],
  'accounts-receivable': [{ label: 'Accounts Receivable', path: '/accounts-receivable', icon: 'ArrowUpCircle' }],
  inventory: [{ label: 'Inventory', path: '/inventory', icon: 'Package' }],
  payroll: [{ label: 'Payroll', path: '/payroll', icon: 'Users' }],
  'fixed-assets': [{ label: 'Fixed Assets', path: '/fixed-assets', icon: 'Building2' }],
  reports: [{ label: 'Reports', path: '/reports', icon: 'BarChart3' }],
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })

  const navItems =
    modules
      ?.filter((m) => m.isEnabled)
      .flatMap((m) => MODULE_NAV[m.id] ?? []) ?? []

  return (
    <nav className="flex flex-col w-56 shrink-0 border-r border-gray-200 bg-gray-50 min-h-screen px-3 py-4 gap-1">
      <Link href="/dashboard" className="text-sm font-semibold px-3 py-2 mb-2 text-gray-800">
        Accounting Platform
      </Link>
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          className={`text-sm px-3 py-2 rounded-md transition-colors ${
            pathname === item.path
              ? 'bg-gray-200 font-medium text-gray-900'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <div className="mt-auto">
        <Link href="/settings" className="text-sm px-3 py-2 rounded-md text-gray-500 hover:bg-gray-100 block">
          Settings
        </Link>
      </div>
    </nav>
  )
}
