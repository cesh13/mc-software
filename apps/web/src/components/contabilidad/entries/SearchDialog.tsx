'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { periodLabel, type EntryType, type Period } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cx } from '@/components/ui/button'
import { Alert, Dialog, Loading } from '@/components/ui/feedback'
import { Checkbox, Input, Select } from '@/components/ui/form'
import { MoneyTd, Td, Th, selectedRowClass } from '@/components/ui/table'
import { fold } from '../coa/search'
import { useEntryList } from './use-entries'

const rowId = (id: string) => `entry-search-${id}`

// "Buscar": the month's entries; ↑/↓ choose, Enter (or double click) opens.
export function SearchDialog({
  period, types, currentId, onOpen, onClose,
}: {
  period: Period
  types: EntryType[]
  currentId: string | null
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const [typeId, setTypeId] = useState('')
  const [text, setText] = useState('')
  const [voided, setVoided] = useState(false)
  const [active, setActive] = useState<string | null>(currentId)
  const list = useEntryList(period, voided)

  const rows = useMemo(() => {
    const q = fold(text.trim())
    return (list.data ?? []).filter(
      (e) => (!typeId || e.entryTypeId === typeId) && (!q || e.number.includes(q) || fold(e.concept).includes(q)),
    )
  }, [list.data, typeId, text])

  const index = rows.findIndex((r) => r.id === active)
  useEffect(() => {
    if (active) document.getElementById(rowId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!rows.length) return
    const go = (i: number) => {
      e.preventDefault()
      setActive(rows[Math.min(Math.max(i, 0), rows.length - 1)].id)
    }
    if (e.key === 'ArrowDown') go(index + 1)
    else if (e.key === 'ArrowUp') go(index < 0 ? 0 : index - 1)
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') {
      e.preventDefault()
      onOpen(rows[index >= 0 ? index : 0].id)
    }
  }

  return (
    <Dialog open wide title={`Buscar partida — ${periodLabel(period)}`} onClose={onClose}>
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown}>
        <div className="flex flex-wrap items-center gap-3">
          <Select aria-label="Tipo de partida" className="max-w-[14rem]" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Todos los tipos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
            ))}
          </Select>
          <Input
            autoFocus
            aria-label="Buscar por número o concepto"
            placeholder="Número o concepto"
            className="max-w-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Checkbox label="Ver anuladas" checked={voided} onChange={(e) => setVoided(e.target.checked)} />
        </div>
        {list.isLoading && <Loading />}
        {list.error && <Alert>{errorMessage(list.error)}</Alert>}
        {list.data && rows.length === 0 && <p className="py-4 text-sm text-gray-500">No hay partidas que coincidan.</p>}
        {rows.length > 0 && (
          <div className="max-h-[45vh] overflow-auto rounded-md border border-gray-200">
            <table role="grid" aria-label="Partidas del mes" className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <Th>Tipo</Th><Th>Número</Th><Th>Fecha</Th><Th>Concepto</Th>
                  <Th className="text-right">Cargos</Th><Th className="text-right">Abonos</Th><Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e.id}
                    id={rowId(e.id)}
                    aria-selected={e.id === active}
                    onClick={() => setActive(e.id)}
                    onDoubleClick={() => onOpen(e.id)}
                    className={cx('cursor-default hover:bg-blue-50/50', e.id === active && selectedRowClass, !e.isActive && 'text-gray-400 line-through')}
                  >
                    <Td className="font-mono text-xs">{e.entryTypeCode}</Td>
                    <Td className="font-mono text-xs">{e.number}</Td>
                    <Td className="whitespace-nowrap">{formatDate(e.date)}</Td>
                    <Td className="max-w-[16rem] truncate">{e.concept}</Td>
                    <MoneyTd value={e.totals.debit} showZero />
                    <MoneyTd value={e.totals.credit} showZero />
                    <Td className="whitespace-nowrap text-xs">
                      {!e.isActive ? 'Anulada' : e.status === 'aplicada' ? 'Aplicada' : 'Borrador'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500">↑/↓ para elegir, Enter para abrir.</p>
      </div>
    </Dialog>
  )
}
