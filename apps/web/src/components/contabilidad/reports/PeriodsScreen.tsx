'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PeriodStatusRow } from '@accounting/shared'
import { ApiError, apiFetch, errorMessage, qs } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { formatDate } from '@/lib/format'
import { useCurrentUser } from '@/lib/session'
import { useWorkPeriod } from '@/lib/work-period'
import { Button, cx } from '@/components/ui/button'
import { Alert, ConfirmDialog, Loading, PageHeader } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'
import { GL_API, reportKeys } from './api'

type Action = { row: PeriodStatusRow; kind: 'close' | 'reopen' }

export function PeriodsScreen() {
  const { empresa } = useEmpresa()
  const { can } = useCurrentUser()
  const qc = useQueryClient()
  const [work] = useWorkPeriod()
  const [year, setYear] = useState(Number(work.slice(0, 4)))
  const [action, setAction] = useState<Action | null>(null)
  const allowed = can('supervise')

  const { data, isLoading, error } = useQuery<PeriodStatusRow[]>({
    queryKey: [...reportKeys.periods, empresa.id, year],
    queryFn: () => apiFetch(`${GL_API}/periods${qs({ year: String(year) })}`),
  })
  const change = useMutation({
    mutationFn: (a: Action) => apiFetch<PeriodStatusRow>(`${GL_API}/periods/${a.row.period}/${a.kind}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportKeys.periods })
      void qc.invalidateQueries({ queryKey: reportKeys.report })
      setAction(null)
    },
  })

  const draftsError = change.error instanceof ApiError && change.error.code === 'period_has_drafts'
  const closing = action?.kind === 'close'
  const close = () => {
    setAction(null)
    change.reset()
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Cierre de mes" subtitle={empresa.name} />
      {!allowed && <Alert kind="info">Solo puede consultar el estado de los meses; cerrar o abrir requiere supervisor.</Alert>}
      <div className="my-3 flex items-center gap-2">
        <Button aria-label="Año anterior" size="sm" onClick={() => setYear(year - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <span className="w-14 text-center text-sm font-semibold tabular-nums">{year}</span>
        <Button aria-label="Año siguiente" size="sm" onClick={() => setYear(year + 1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
      {isLoading && <Loading />}
      {!!error && <Alert>{errorMessage(error)}</Alert>}
      {data && (
        <Table>
          <thead>
            <tr>
              <Th>Mes</Th>
              <Th>Estado</Th>
              <Th className="text-right">Partidas aplicadas</Th>
              <Th className="text-right">Borradores</Th>
              <Th className="text-right">Anuladas</Th>
              <Th>Cerrado por / fecha</Th>
              {allowed && <Th />}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.period} className={rowClass}>
                <Td className="font-medium">{r.label}</Td>
                <Td>
                  <span className={cx('rounded px-1.5 py-0.5 text-xs font-semibold', r.status === 'closed' ? 'bg-gray-200 text-gray-800' : 'bg-green-100 text-green-800')}>
                    {r.status === 'closed' ? 'Cerrado' : 'Abierto'}
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{r.entries.aplicada}</Td>
                <Td className={cx('text-right tabular-nums', r.entries.borrador > 0 && 'font-semibold text-amber-700')}>
                  {r.entries.borrador}
                </Td>
                <Td className="text-right tabular-nums">{r.entries.voided}</Td>
                <Td>{r.status === 'closed' ? [r.closedBy, formatDate(r.closedAt)].filter(Boolean).join(' · ') : ''}</Td>
                {allowed && (
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant={r.status === 'closed' ? 'secondary' : 'primary'}
                      onClick={() => {
                        change.reset()
                        setAction({ row: r, kind: r.status === 'closed' ? 'reopen' : 'close' })
                      }}
                    >
                      {r.status === 'closed' ? 'Abrir mes' : 'Cerrar mes'}
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <ConfirmDialog
        open={!!action}
        title={closing ? 'Cerrar mes' : 'Abrir mes'}
        confirmLabel={closing ? 'Cerrar mes' : 'Abrir mes'}
        message={
          <>
            {closing
              ? `¿Desea cerrar ${action?.row.label}? En un mes cerrado no se puede agregar, modificar ni anular partidas.`
              : `¿Desea abrir ${action?.row.label}? Podrá agregar, modificar y anular partidas de ese mes otra vez.`}
            {change.error && action && (
              <span className="mt-2 block text-red-700">
                {errorMessage(change.error)}
                {draftsError && (
                  <>
                    {' '}
                    <Link
                      className="font-medium underline"
                      href={`/contabilidad/reportes/descuadradas?period=${action.row.period}`}
                    >
                      Ver partidas en borrador
                    </Link>
                  </>
                )}
              </span>
            )}
          </>
        }
        onConfirm={() => action && change.mutate(action)}
        onClose={close}
      />
    </div>
  )
}
