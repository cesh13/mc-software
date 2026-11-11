'use client'

import Link from 'next/link'
import { errorMessage } from '@/lib/api'
import { useCurrentUser } from '@/lib/session'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'
import { useIntegrityReport } from '@/components/contabilidad/coa/use-coa'

export default function RevisionCatalogoPage() {
  const { can } = useCurrentUser()
  const allowed = can('reports')
  const { data, isLoading, error } = useIntegrityReport(allowed)

  return (
    <div className="max-w-5xl">
      <PageHeader title="Revisión del catálogo" subtitle="Verifica la consistencia de la jerarquía de cuentas." />
      {!allowed && <Alert kind="warning">No tiene permiso para ver este reporte.</Alert>}
      {allowed && isLoading && <Loading />}
      {error && <Alert>{errorMessage(error)}</Alert>}
      {data && data.findings.length === 0 && (
        <Alert kind="success">{data.checkedAccounts} cuentas revisadas. El catálogo no tiene observaciones.</Alert>
      )}
      {data && data.findings.length > 0 && (
        <>
          <p className="mb-3 text-sm text-gray-700">
            {data.checkedAccounts} cuentas revisadas, {data.findings.length} observaciones.
          </p>
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Cuenta padre</Th>
                <Th>Observación</Th>
                <Th className="print:hidden" />
              </tr>
            </thead>
            <tbody>
              {data.findings.map((f, i) => (
                <tr key={`${f.accountId}-${f.issue}-${i}`} className={rowClass}>
                  <Td className="font-mono text-xs">{f.code}</Td>
                  <Td>{f.name}</Td>
                  <Td className="font-mono text-xs">{f.parentCode ?? ''}</Td>
                  <Td>{f.message}</Td>
                  <Td className="text-right print:hidden">
                    <Link
                      className="text-blue-700 hover:underline"
                      href={`/contabilidad/catalogo?code=${encodeURIComponent(f.code)}`}
                    >
                      Abrir
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </div>
  )
}
