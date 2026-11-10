'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { NAV } from '@/lib/nav'
import { useCurrentUser } from '@/lib/session'
import { cx } from './ui/button'

type Module = { id: string; isEnabled: boolean }

export default function Sidebar() {
  const pathname = usePathname()
  const { can } = useCurrentUser()
  const { data: modules } = useQuery<Module[]>({
    queryKey: ['modules'],
    queryFn: () => apiFetch('/api/modules'),
  })
  const enabled = new Set(modules?.filter((m) => m.isEnabled).map((m) => m.id))

  const groups = NAV.filter((g) => !g.moduleId || enabled.has(g.moduleId))
    .map((g) => ({ ...g, links: g.links.filter((l) => !l.permission || can(l.permission)) }))
    .filter((g) => g.links.length > 0)

  return (
    <nav className="flex min-h-screen w-60 shrink-0 flex-col gap-4 border-r border-gray-200 bg-gray-50 px-3 py-4 print:hidden">
      <Link href="/dashboard" className="px-2 text-sm font-semibold text-gray-900">
        MC Software
      </Link>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{group.title}</p>
          <ul className="flex flex-col">
            {group.links.map((link) => {
              const active = pathname === link.path || pathname.startsWith(`${link.path}/`)
              return (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'block rounded-md px-2 py-1.5 text-sm transition-colors',
                      active ? 'bg-blue-100 font-medium text-blue-900' : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
