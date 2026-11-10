'use client'

import { isPeriod, type Period } from '@accounting/shared'
import { setStored, useStored } from './local-store'
import { useEmpresa } from './empresa'

// "Mes de trabajo": the month every capture screen works in. Remembered per
// empresa in this browser.

function currentPeriod(): Period {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useWorkPeriod(): [Period, (period: Period) => void] {
  const { empresa } = useEmpresa()
  const key = `workPeriod:${empresa.id}`
  const stored = useStored(key)
  const period = isPeriod(stored) ? stored : currentPeriod()
  return [period, (next) => setStored(key, next)]
}
