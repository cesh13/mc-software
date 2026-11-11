'use client'

import type { Empresa } from '@/lib/empresa'
import { Checkbox } from '@/components/ui/form'

export function EmpresaChecklist({
  empresas,
  value,
  onChange,
  disabled,
}: {
  empresas: Empresa[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id))
  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Empresas</legend>
      {disabled && <p className="text-xs text-gray-500">El propietario tiene acceso a todas las empresas.</p>}
      <div className="flex max-h-40 flex-col gap-1 overflow-auto rounded-md border border-gray-200 p-2">
        {empresas.length === 0 && <p className="text-sm text-gray-500">No hay empresas.</p>}
        {empresas.map((e) => (
          <Checkbox
            key={e.id}
            label={`${e.siglas} - ${e.name}`}
            checked={value.includes(e.id)}
            disabled={disabled}
            onChange={(ev) => toggle(e.id, ev.target.checked)}
          />
        ))}
      </div>
    </fieldset>
  )
}
