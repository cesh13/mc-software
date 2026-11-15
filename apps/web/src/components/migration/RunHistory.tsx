'use client'

import Link from 'next/link'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Alert, Loading } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'
import { SEVERITY_STYLES } from './FindingsList'
import { useRuns } from './use-migration'

const STATUS = { running: 'En curso', ok: 'Terminada', failed: 'Con errores' } as const

export function RunHistory() {
  const runs = useRuns()
  if (runs.isLoading) return <Loading />
  if (runs.error) return <Alert>{errorMessage(runs.error)}</Alert>
  if (!runs.data?.length) return <p className="text-sm text-gray-500">Todavía no hay pruebas.</p>
  return (
    <Table>
      <thead>
        <tr><Th>Fecha</Th><Th>Usuario</Th><Th>Carpeta</Th><Th>Importadores</Th><Th>Estado</Th><Th>Hallazgos</Th><Th /></tr>
      </thead>
      <tbody>
        {runs.data.map((r) => (
          <tr key={r.id} className={rowClass}>
            <Td>{formatDate(r.startedAt)}</Td>
            <Td>{r.startedByName ?? r.startedBy}</Td>
            <Td className="max-w-xs truncate font-mono text-xs">{r.root}</Td>
            <Td>{r.importers.join(', ')}</Td>
            <Td>{STATUS[r.status]}</Td>
            <Td className="whitespace-nowrap text-xs">
              {(['bloquea', 'decidir', 'info'] as const).map((s) => (
                <span key={s} className={`mr-1 rounded px-1.5 py-0.5 ${SEVERITY_STYLES[s]}`}>{r.findings[s]}</span>
              ))}
            </Td>
            <Td><Link className="text-blue-700 underline" href={`/migracion?run=${r.id}`}>Ver</Link></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
