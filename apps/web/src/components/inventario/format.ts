// Quantities keep five decimals in the API; show them without trailing zeros.
// '1234.50000' → '1,234.5'; '-3.00000' → '-3'. Strings only, never numbers.
export function formatQty(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const negative = value.startsWith('-')
  const [intRaw, decRaw = ''] = (negative ? value.slice(1) : value).split('.')
  const dec = decRaw.replace(/0+$/, '')
  const int = intRaw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${int}${dec ? `.${dec}` : ''}`
}

// Unit costs keep five decimals; show at least two.
export function formatCost(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const [int, dec = ''] = value.split('.')
  const trimmed = dec.replace(/0+$/, '')
  const shown = trimmed.length < 2 ? (trimmed + '00').slice(0, 2) : trimmed
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${shown}`
}

// What a user types in a quantity/cost cell: '1,234.5' → '1234.5'; null if invalid.
export function parseQtyInput(text: string): string | null {
  const clean = text.replace(/[,\s]/g, '')
  if (clean === '') return null
  return /^\d+(\.\d{0,5})?$/.test(clean) ? clean : null
}

export const todayIso = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
