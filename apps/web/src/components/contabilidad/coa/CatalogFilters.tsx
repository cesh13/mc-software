import type { Ref } from 'react'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from '@accounting/shared'
import { Checkbox, Input, Select } from '@/components/ui/form'

export function CatalogFilters(props: {
  search: string
  onSearch: (v: string) => void
  type: AccountType | ''
  onType: (v: AccountType | '') => void
  showInactive: boolean
  onShowInactive: (v: boolean) => void
  searchRef: Ref<HTMLInputElement>
  onSearchEnter: () => void
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
      <Input
        ref={props.searchRef}
        aria-label="Buscar cuenta"
        placeholder="Buscar por código o nombre"
        className="max-w-xs"
        value={props.search}
        onChange={(e) => props.onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault()
            props.onSearchEnter()
          }
        }}
      />
      <Select
        aria-label="Filtrar por tipo"
        className="max-w-[12rem]"
        value={props.type}
        onChange={(e) => props.onType(e.target.value as AccountType | '')}
      >
        <option value="">Todos los tipos</option>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
        ))}
      </Select>
      <Checkbox label="Mostrar inactivas" checked={props.showInactive} onChange={(e) => props.onShowInactive(e.target.checked)} />
    </div>
  )
}
