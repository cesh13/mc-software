'use client'

import { useMemo, useState } from 'react'
import { errorMessage } from '@/lib/api'
import { useEmpresa, useEmpresas } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { usePermissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { useUsers } from '@/components/admin/use-users'
import { AuditFilters } from './AuditFilters'
import { AuditTable } from './AuditTable'
import { EMPTY_FILTERS, PAGE_SIZE, downloadAuditCsv, useAudit, type AuditFilterState } from './use-audit'

// Bitácora: who did what, in which empresa and when.
export function AuditScreen() {
  const { user: me } = useCurrentUser()
  const { empresa } = useEmpresa()
  const { can, loading } = usePermissions()
  const allowed = can('core.audit.view')
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const empresas = useEmpresas()
  const users = useUsers(can('core.users.manage'))
  const audit = useAudit(filters, page, empresa.id)

  const siglas = useMemo(() => new Map((empresas.data ?? []).map((e) => [e.id, e.siglas])), [empresas.data])
  const siglasOf = (id: string | null) => (id ? siglas.get(id) ?? id : '')

  if (!me || loading) return <Loading />
  if (!allowed) return <Alert kind="warning">No tiene acceso a esta opción.</Alert>

  const total = audit.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const change = (f: AuditFilterState) => {
    setFilters(f)
    setPage(0)
  }
  const exportCsv = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await downloadAuditCsv(filters)
    } catch (err) {
      setExportError(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Bitácora" subtitle="Registro de los cambios hechos en el sistema." />
      <AuditFilters
        value={filters}
        onChange={change}
        onExport={exportCsv}
        exporting={exporting}
        isOwner={me.role === 'owner'}
        empresas={empresas.data ?? []}
        users={(users.data ?? []).map((u) => ({ id: u.id, name: u.name }))}
      />
      {exportError && <Alert>{exportError}</Alert>}
      {audit.isLoading && <Loading />}
      {audit.error && <Alert>{errorMessage(audit.error)}</Alert>}
      {audit.data && audit.data.rows.length === 0 && (
        <p className="py-6 text-sm text-gray-500">No hay registros con esos filtros.</p>
      )}
      {!!audit.data?.rows.length && <AuditTable rows={audit.data.rows} siglasOf={siglasOf} />}
      <div className="mt-3 flex items-center gap-3 text-sm text-gray-600 print:hidden">
        <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
        <span>Página {page + 1} de {pages} — {total} registros</span>
        <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
      </div>
    </div>
  )
}
