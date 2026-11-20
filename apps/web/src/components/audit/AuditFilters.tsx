'use client'

import type { Empresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { DateInput } from '@/components/ui/date-input'
import { EMPTY_FILTERS, type AuditFilterState } from './use-audit'

type UserOption = { id: string; name: string }

export function AuditFilters({
  value, onChange, onExport, exporting, isOwner, empresas, users,
}: {
  value: AuditFilterState
  onChange: (v: AuditFilterState) => void
  onExport: () => void
  exporting: boolean
  isOwner: boolean
  empresas: Empresa[]
  users: UserOption[]
}) {
  const set = (k: keyof AuditFilterState) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value })
  return (
    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
      {isOwner && (
        <Field label="Empresa">
          <Select value={value.empresaId} onChange={set('empresaId')}>
            <option value="">Empresa activa</option>
            <option value="all">Todas las empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.siglas}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Usuario">
        <Select value={value.userId} onChange={set('userId')}>
          <option value="">Todos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </Field>
      <Field label="Módulo"><Input value={value.module} onChange={set('module')} placeholder="p. ej. core" /></Field>
      <Field label="Entidad"><Input value={value.entity} onChange={set('entity')} placeholder="p. ej. empresa" /></Field>
      <Field label="Desde"><DateInput value={value.from} onChange={(from) => onChange({ ...value, from })} /></Field>
      <Field label="Hasta"><DateInput value={value.to} onChange={(to) => onChange({ ...value, to })} /></Field>
      <Field label="Buscar" className="md:col-span-2">
        <Input value={value.q} onChange={set('q')} placeholder="Acción, entidad o detalle" />
      </Field>
      <div className="col-span-2 flex items-end gap-2 md:col-span-4">
        <Button onClick={() => onChange(EMPTY_FILTERS)}>Limpiar filtros</Button>
        <Button variant="primary" disabled={exporting} onClick={onExport}>Exportar CSV</Button>
      </div>
    </div>
  )
}
