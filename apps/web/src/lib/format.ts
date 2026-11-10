// Display helpers. Amounts stay as exact decimal strings; never parse to number.

// '1234567.5' → '1,234,567.50'; '-12' → '-12.00'. Empty for null/undefined.
export function formatMoney(value: string | null | undefined, opts: { blankZero?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return ''
  const negative = value.startsWith('-')
  const [intRaw, decRaw = ''] = (negative ? value.slice(1) : value).split('.')
  const dec = (decRaw + '00').slice(0, 2)
  const int = intRaw.replace(/^0+(?=\d)/, '')
  if (opts.blankZero && /^0*$/.test(int) && dec === '00') return ''
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${dec}`
}

// Accepts what a user types ('1,234.5', ' 12 ') and returns '1234.50', or null if invalid.
export function parseMoneyInput(text: string): string | null {
  const clean = text.replace(/[,\s]/g, '')
  if (clean === '') return '0.00'
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [int, dec = ''] = clean.split('.')
  return `${int.replace(/^0+(?=\d)/, '')}.${(dec + '00').slice(0, 2)}`
}

// 'AAAA-MM-DD' → 'DD/MM/AAAA'
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
