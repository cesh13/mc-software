'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, Loading } from '@/components/ui/feedback'
import { Table, Td, Th, rowClass } from '@/components/ui/table'

type Row = { id: string; name: string; alwaysOn: boolean; installed: boolean; active: boolean; missing: string[] }

// Modules switched on for the active empresa (/api/empresa-modules). A module must
// first be enabled for the installation (table above) and the service restarted.
export function EmpresaModules() {
  const { empresa } = useEmpresa()
  const qc = useQueryClient()
  const key = ['empresa-modules', empresa.id]
  const list = useQuery<Row[]>({ queryKey: key, queryFn: () => apiFetch(`/api/empresa-modules/${empresa.id}`) })
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) =>
      apiFetch<Row[]>(`/api/empresa-modules/${empresa.id}/${v.id}`, { method: 'PUT', json: { enabled: v.enabled } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
  const rows = (list.data ?? []).filter((m) => !m.alwaysOn && m.installed)
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-sm font-semibold text-gray-800">Módulos de {empresa.name}</h2>
      <p className="mb-3 text-xs text-gray-500">
        Solo aparecen los módulos activos en la instalación. Después de activar uno arriba, reinicie el servicio del servidor.
      </p>
      {list.isLoading && <Loading />}
      {(list.error ?? toggle.error) != null && <div className="mb-2"><Alert>{errorMessage(list.error ?? toggle.error)}</Alert></div>}
      {list.data && !rows.length && <p className="text-sm text-gray-500">No hay módulos opcionales activos en la instalación.</p>}
      {rows.length > 0 && (
        <Table>
          <thead><tr><Th>Módulo</Th><Th>En esta empresa</Th><Th /></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={rowClass}>
                <Td className="font-medium">{m.name}</Td>
                <Td>{m.active ? 'Activo' : 'Inactivo'}</Td>
                <Td className="text-right">
                  <Button size="sm" variant={m.active ? 'danger' : 'primary'} disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: m.id, enabled: !m.active })}>
                    {m.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  )
}
