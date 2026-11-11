import {
  addMoney, isZeroMoney, lastDayOfPeriod, subMoney, ZERO,
  type Entry, type EntryLineInput, type Money, type Period,
} from '@accounting/shared'

// Working copy of an entry while it is being added or modified.

export type LineDraft = {
  key: string
  accountId: string | null
  costCenterId: string
  detail: string
  debit: Money
  credit: Money
  collectDate: string | null
}

export type EntryDraft = {
  // null while adding.
  id: string | null
  entryTypeId: string
  number: string
  numberEdited: boolean
  date: string
  concept: string
  lines: LineDraft[]
}

let seq = 0
export const lineKey = () => `l${++seq}`

export function emptyLine(detail = ''): LineDraft {
  return { key: lineKey(), accountId: null, costCenterId: '', detail, debit: ZERO, credit: ZERO, collectDate: null }
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today when it falls inside the month, otherwise the month's last day.
export function defaultDate(period: Period): string {
  const today = todayIso()
  return today.startsWith(`${period}-`) ? today : lastDayOfPeriod(period)
}

export function newDraft(period: Period, entryTypeId: string): EntryDraft {
  return {
    id: null, entryTypeId, number: '', numberEdited: false, date: defaultDate(period), concept: '', lines: [emptyLine()],
  }
}

export function draftFromEntry(entry: Entry): EntryDraft {
  const lines = entry.lines.map<LineDraft>((l) => ({
    key: lineKey(),
    accountId: l.accountId,
    costCenterId: l.costCenterId ?? '',
    detail: l.detail,
    debit: l.debit,
    credit: l.credit,
    collectDate: l.collectDate,
  }))
  return {
    id: entry.id,
    entryTypeId: entry.entryTypeId,
    number: entry.number,
    numberEdited: false,
    date: entry.date,
    concept: entry.concept,
    lines: lines.length ? lines : [emptyLine(entry.concept)],
  }
}

export type Totals = { debit: Money; credit: Money; difference: Money; balanced: boolean }

export function totalsOf(lines: readonly { debit: Money; credit: Money }[]): Totals {
  const debit = addMoney(...lines.map((l) => l.debit || ZERO))
  const credit = addMoney(...lines.map((l) => l.credit || ZERO))
  const difference = subMoney(debit, credit)
  return { debit, credit, difference, balanced: isZeroMoney(difference) }
}

export const isBlankLine = (l: LineDraft) => !l.accountId && isZeroMoney(l.debit) && isZeroMoney(l.credit)

// Lines that are sent: trailing blank lines are dropped silently.
export function linesToSave(lines: LineDraft[]): LineDraft[] {
  let end = lines.length
  while (end > 0 && isBlankLine(lines[end - 1])) end--
  return lines.slice(0, end)
}

export function toLineInput(l: LineDraft, requiresCostCenter: boolean): EntryLineInput {
  return {
    accountId: l.accountId ?? '',
    costCenterId: requiresCostCenter && l.costCenterId ? l.costCenterId : null,
    detail: l.detail.trim(),
    debit: l.debit || ZERO,
    credit: l.credit || ZERO,
    collectDate: l.collectDate,
  }
}

// '-12.50' → '12.50'
export const absMoney = (m: Money) => m.replace(/^-/, '')
