// A period is a month written 'AAAA-MM'. Dates are 'AAAA-MM-DD'.

export type Period = string

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export const MONTH_NAMES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && PERIOD_RE.test(value)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function periodOfDate(date: string): Period {
  return date.slice(0, 7)
}

// Legacy `salfec` 'AAAAMM' → 'AAAA-MM'.
export function periodFromSalfec(salfec: string): Period {
  return `${salfec.slice(0, 4)}-${salfec.slice(4, 6)}`
}

export function addMonths(period: Period, months: number): Period {
  const total = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
}

export function lastDayOfPeriod(period: Period): string {
  const y = Number(period.slice(0, 4))
  const m = Number(period.slice(5, 7))
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${period}-${String(day).padStart(2, '0')}`
}

export function periodLabel(period: Period): string {
  return `${MONTH_NAMES[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`
}
