'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, errorMessage } from '@/lib/api'
import { EmpresaProvider, selectEmpresa, useActiveEmpresaId, useEmpresas, type Empresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { Button } from './ui/button'
import { Alert, Loading } from './ui/feedback'
import { Field, Input } from './ui/form'

// Makes sure an empresa is selected before any screen renders. Users with
// more than one pick at entry, like the legacy "seleccionar empresa".
export default function EmpresaGate({ children }: { children: ReactNode }) {
  const { data: empresas, isLoading, error } = useEmpresas()
  const activeId = useActiveEmpresaId()
  const active = empresas?.filter((e) => e.isActive) ?? []
  const empresa = active.find((e) => e.id === activeId)

  useEffect(() => {
    if (!empresas) return
    if (!empresa && active.length === 1) selectEmpresa(active[0].id)
    else if (activeId && !empresa) selectEmpresa(null)
  }, [empresas, empresa, active, activeId])

  if (isLoading) return <Centered><Loading /></Centered>
  if (error) return <Centered><Alert>{errorMessage(error)}</Alert></Centered>
  if (empresa) return <EmpresaProvider value={{ empresa, empresas: active }}>{children}</EmpresaProvider>
  if (active.length === 0) return <Centered><FirstEmpresa /></Centered>
  if (active.length === 1) return null
  return (
    <Centered>
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Seleccione la empresa</h1>
      <p className="mb-4 text-sm text-gray-500">Puede cambiarla después desde la barra superior.</p>
      <ul className="flex flex-col gap-2">
        {active.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => selectEmpresa(e.id)}
              className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 text-left text-sm hover:border-blue-600 hover:bg-blue-50"
            >
              <span className="font-medium text-gray-900">{e.name}</span>
              <span className="text-xs text-gray-500">{e.siglas}</span>
            </button>
          </li>
        ))}
      </ul>
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  )
}

function FirstEmpresa() {
  const { can } = useCurrentUser()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [siglas, setSiglas] = useState('')
  const create = useMutation({
    mutationFn: () => apiFetch<Empresa>('/api/empresas', { json: { name, siglas } }),
    onSuccess: (e) => {
      selectEmpresa(e.id)
      qc.invalidateQueries({ queryKey: ['empresas'] })
    },
  })

  if (!can('supervise')) {
    return <Alert kind="warning">No tiene empresas asignadas. Pida acceso a un supervisor.</Alert>
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate()
      }}
    >
      <h1 className="text-lg font-semibold text-gray-900">Crear la primera empresa</h1>
      <p className="text-sm text-gray-500">
        Si viene del sistema anterior, la empresa se crea al importar sus datos.
      </p>
      <Field label="Nombre">
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Siglas" hint="Hasta 10 caracteres.">
        <Input value={siglas} onChange={(e) => setSiglas(e.target.value.toUpperCase())} maxLength={10} required />
      </Field>
      {create.error && <Alert>{errorMessage(create.error)}</Alert>}
      <Button type="submit" variant="primary" disabled={create.isPending}>
        Crear empresa
      </Button>
    </form>
  )
}
