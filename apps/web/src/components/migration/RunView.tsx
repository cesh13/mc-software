'use client'

import type { MigrationRun } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { Alert, Loading } from '@/components/ui/feedback'
import { Table, Td, Th } from '@/components/ui/table'
import { countLabel } from './count-labels'
import { FindingsList } from './FindingsList'
import { InspectionView } from './InspectionView'
import { useRun } from './use-migration'

const STATUS: Record<MigrationRun['status'], string> = { running: 'En curso…', ok: 'Terminada', failed: 'Con errores' }

// Detail of one trial import: counts and findings per importer.
export function RunView({ id }: { id: string }) {
  const run = useRun(id)
  if (run.isLoading) return <Loading />
  if (run.error) return <Alert>{errorMessage(run.error)}</Alert>
  const r = run.data!
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-700">
        <span className="font-semibold">{STATUS[r.status]}</span>
        {' · '}{r.startedByName ?? r.startedBy} · {formatDate(r.startedAt)}
        {' · '}Carpeta: <span className="font-mono">{r.root}</span>
        {r.options.replace ? ' · reemplazando la importación anterior' : ''}
      </div>
      {r.status === 'running' && <Loading label="Importando en la copia…" />}
      {r.error && <Alert>{r.error}</Alert>}
      {r.results.map((res) => (
        <section key={res.importer} className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <h3 className="mb-2 font-semibold text-gray-900">
            {res.importer === 'contac' ? 'Contabilidad' : res.importer === 'parties' ? 'Clientes y proveedores' : res.importer}
            <span className="ml-2 text-xs font-normal text-gray-500">{(res.durationMs / 1000).toFixed(1)} s</span>
          </h3>
          {res.error && <Alert>{res.error}</Alert>}
          {Object.keys(res.counts).length > 0 && (
            <div className="mb-3 max-w-xl">
              <Table>
                <thead><tr><Th>Concepto</Th><Th className="text-right">Cantidad</Th></tr></thead>
                <tbody>
                  {Object.entries(res.counts).map(([k, v]) => (
                    <tr key={k}><Td>{countLabel(k)}</Td><Td className="text-right tabular-nums">{v.toLocaleString('es-SV')}</Td></tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <FindingsList findings={res.findings} />
        </section>
      ))}
      {r.inspection && (
        <details className="rounded-md border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">Revisión de la carpeta en esta prueba</summary>
          <div className="mt-3"><InspectionView result={r.inspection} /></div>
        </details>
      )}
    </div>
  )
}
