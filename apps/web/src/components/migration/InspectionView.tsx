'use client'

import type { InspectionResult, ModuleInspection } from '@accounting/shared'
import { cx } from '@/components/ui/button'
import { Table, Td, Th } from '@/components/ui/table'
import { FindingsList } from './FindingsList'

const range = (r: { from: string; to: string } | null) => (r ? `${r.from.slice(0, 7)} a ${r.to.slice(0, 7)}` : '—')
const n = (v: number) => v.toLocaleString('es-SV')

function ModuleCard({ m }: { m: ModuleInspection }) {
  const missingRequired = m.tables.filter((t) => t.required && !t.found).length
  return (
    <section className="rounded-md border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <div>
          <span className="font-semibold text-gray-900">{m.label}</span>
          <span className="ml-2 text-xs text-gray-500">{m.id}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600">{m.folder ?? 'Carpeta no encontrada'}</span>
          <span className="text-gray-600">Datos: {range(m.dateRange)}</span>
          {m.importer
            ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Con importador</span>
            : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">Importador pendiente</span>}
          {missingRequired > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">Faltan {missingRequired} obligatorias</span>}
        </div>
      </header>
      {m.folder && (
        <Table>
          <thead>
            <tr>
              <Th>Tabla</Th><Th className="text-right">Vivos</Th><Th className="text-right">Borrados</Th>
              <Th>Última modificación</Th><Th>Codificación</Th><Th>Fechas</Th>
            </tr>
          </thead>
          <tbody>
            {m.tables.map((t) => (
              <tr key={t.table} className={cx(!t.found && t.required && 'bg-red-50')}>
                <Td className="font-medium">
                  {t.found ? '✓' : '✗'} {t.table}{t.required && <span className="ml-1 text-xs text-gray-500">(obligatoria)</span>}
                </Td>
                <Td className="text-right tabular-nums">{t.found ? n(t.live) : ''}</Td>
                <Td className="text-right tabular-nums">{t.found ? n(t.deleted) : ''}</Td>
                <Td>{t.lastUpdate ?? ''}</Td>
                <Td>{t.encoding ?? ''}</Td>
                <Td>{t.dateRange ? range(t.dateRange) : ''}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  )
}

// Result of "Revisar carpeta": what each module folder holds and the copy-level findings.
export function InspectionView({ result, showFindings = true }: { result: InspectionResult; showFindings?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Empresas en la copia: {result.empresas.length ? result.empresas.map((e) => e.siglas).join(', ') : 'ninguna encontrada'}
        {' · '}Archivos comprimidos: {result.archives.length}
      </p>
      {showFindings && <FindingsList findings={result.findings} />}
      {result.modules.map((m) => <ModuleCard key={m.id} m={m} />)}
    </div>
  )
}
