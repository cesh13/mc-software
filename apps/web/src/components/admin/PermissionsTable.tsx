'use client'

import { Fragment } from 'react'
import type { PermissionDef, PermissionOverride } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { Td, Th } from '@/components/ui/table'
import { effectiveIn, overrideIn, roleDefault, type Effect } from './use-user-permissions'

const yesNo = (v: boolean) => (v ? 'Sí' : 'No')

// Catalog grouped by screen: role default, override and effective result.
export function PermissionsTable({
  role, catalog, overrides, scope, readOnly, isOwner, onChange,
}: {
  role: string
  catalog: PermissionDef[]
  overrides: PermissionOverride[]
  scope: string | null
  readOnly: boolean
  isOwner: boolean
  onChange: (permission: string, effect: Effect | null) => void
}) {
  const groups = new Map<string, PermissionDef[]>()
  for (const d of catalog) groups.set(d.group, [...(groups.get(d.group) ?? []), d])

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <Th>Permiso</Th>
          <Th className="w-20 text-center">Por rol</Th>
          <Th className="w-40">Ajuste</Th>
          <Th className="w-24 text-center">Efectivo</Th>
        </tr>
      </thead>
      <tbody>
        {[...groups].map(([group, defs]) => (
          <Fragment key={group}>
            <tr>
              <td colSpan={4} className="bg-gray-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {group}
              </td>
            </tr>
            {defs.map((d) => {
              // Rows in this scope only; the effective result also counts the global one.
              const own = overrides.find((o) => o.permission === d.id && o.empresaId === scope)?.effect ?? ''
              const inherited = !own && scope !== null && overrideIn(overrides, d.id, null)
              const allowed = effectiveIn(role, d, overrides, scope)
              return (
                <tr key={d.id} className="border-b border-gray-100">
                  <Td>{d.label}</Td>
                  <Td className="text-center">{yesNo(roleDefault(role, d))}</Td>
                  <Td>
                    <Select
                      aria-label={`Ajuste de ${d.label}`}
                      value={own}
                      disabled={readOnly || isOwner}
                      onChange={(e) => onChange(d.id, (e.target.value || null) as Effect | null)}
                    >
                      <option value="">{inherited ? 'Según todas las empresas' : 'Sin ajuste'}</option>
                      <option value="grant">Conceder</option>
                      <option value="deny" disabled={isOwner}>Negar</option>
                    </Select>
                  </Td>
                  <Td className={cx('text-center font-medium', allowed ? 'text-green-700' : 'text-red-700')}>{yesNo(allowed)}</Td>
                </tr>
              )
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
