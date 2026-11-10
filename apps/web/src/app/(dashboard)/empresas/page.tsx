'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresas, type Empresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, Dialog, Loading, PageHeader } from '@/components/ui/feedback'
import { Checkbox, Field, Input } from '@/components/ui/form'
import { Table, Td, Th, rowClass } from '@/components/ui/table'

type Draft = { id?: string; name: string; siglas: string; moneda: string; granContribuyente: boolean }

const EMPTY: Draft = { name: '', siglas: '', moneda: 'USD', granContribuyente: false }

export default function EmpresasPage() {
  const qc = useQueryClient()
  const { data: empresas, isLoading, error } = useEmpresas()
  const [draft, setDraft] = useState<Draft | null>(null)

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? apiFetch<Empresa>(`/api/empresas/${d.id}`, { method: 'PATCH', json: d })
        : apiFetch<Empresa>('/api/empresas', { json: d }),
    onSuccess: () => {
      setDraft(null)
      qc.invalidateQueries({ queryKey: ['empresas'] })
    },
  })

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Empresas"
        subtitle="Cada empresa lleva su propia contabilidad dentro de esta instalación."
        actions={<Button variant="primary" onClick={() => { save.reset(); setDraft(EMPTY) }}>Agregar empresa</Button>}
      />
      {isLoading && <Loading />}
      {error && <Alert>{errorMessage(error)}</Alert>}
      {empresas && (
        <Table>
          <thead>
            <tr>
              <Th>Siglas</Th>
              <Th>Nombre</Th>
              <Th>Moneda</Th>
              <Th>Gran contribuyente</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className={rowClass}>
                <Td className="font-medium">{e.siglas}</Td>
                <Td>{e.name}</Td>
                <Td>{e.moneda}</Td>
                <Td>{e.granContribuyente ? 'Sí' : 'No'}</Td>
                <Td className="text-right">
                  <Button size="sm" onClick={() => { save.reset(); setDraft({ ...e }) }}>Modificar</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={draft !== null}
        title={draft?.id ? 'Modificar empresa' : 'Agregar empresa'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancelar</Button>
            <Button variant="primary" disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Grabar
            </Button>
          </>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <Field label="Nombre">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Siglas">
                <Input
                  value={draft.siglas}
                  maxLength={10}
                  onChange={(e) => setDraft({ ...draft, siglas: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Moneda" hint="Código de tres letras, p. ej. USD.">
                <Input
                  value={draft.moneda}
                  maxLength={3}
                  onChange={(e) => setDraft({ ...draft, moneda: e.target.value.toUpperCase() })}
                />
              </Field>
            </div>
            <Checkbox
              label="Gran contribuyente"
              checked={draft.granContribuyente}
              onChange={(e) => setDraft({ ...draft, granContribuyente: e.target.checked })}
            />
            {save.error && <Alert>{errorMessage(save.error)}</Alert>}
          </div>
        )}
      </Dialog>
    </div>
  )
}
