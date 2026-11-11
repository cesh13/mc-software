'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { isPeriod, type Period } from '@accounting/shared'
import { useWorkPeriod } from '@/lib/work-period'
import { Field, Select } from '@/components/ui/form'
import { useAccounts } from '../coa/use-coa'
import { useCostCenters } from './api'

// Month of a report: `?period=` when valid, else the working month. Changing it never
// changes the working month.
export function usePeriodParam(): [Period, (p: Period) => void] {
  const [work] = useWorkPeriod()
  const fromUrl = useSearchParams().get('period')
  const [local, setLocal] = useState<Period | null>(isPeriod(fromUrl) ? fromUrl : null)
  return [local ?? work, setLocal]
}

// Deepest account level in the catalog (at least 1).
export function useMaxLevel(): number {
  const { data } = useAccounts()
  return Math.max(1, ...(data ?? []).map((a) => a.level))
}

// "Hasta nivel": null means all levels.
export function LevelSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const max = useMaxLevel()
  return (
    <Field label="Hasta nivel">
      <Select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Todos</option>
        {Array.from({ length: max }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export function CostCenterSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useCostCenters()
  return (
    <Field label="Centro de costo">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} - {c.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export const indentStyle = (level: number) => ({ paddingLeft: `${Math.max(level - 1, 0) * 16 + 8}px` })
