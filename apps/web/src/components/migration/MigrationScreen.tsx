'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { errorMessage } from '@/lib/api'
import { usePermissions } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Checkbox, Field, Input } from '@/components/ui/form'
import { InspectionView } from './InspectionView'
import { RunHistory } from './RunHistory'
import { RunView } from './RunView'
import { useImporters, useInspect, useRuns, useStartRun } from './use-migration'

// Migración: check a legacy folder and run trial imports on a copy (docs/sistema/migracion.md).
export function MigrationScreen() {
  const { can, loading } = usePermissions()
  const runId = useSearchParams().get('run')
  const router = useRouter()
  const runs = useRuns()
  const importers = useImporters()
  const inspect = useInspect()
  const start = useStartRun()
  const [root, setRoot] = useState('')
  const [chosen, setChosen] = useState<string[]>(['contac', 'parties'])
  const [siglas, setSiglas] = useState('')
  const [replace, setReplace] = useState(false)

  useEffect(() => {
    if (!root && runs.data?.[0]) setRoot(runs.data[0].root)
  }, [runs.data, root])

  if (loading) return <Loading />
  if (!can('core.migration.run')) return <Alert kind="warning">No tiene acceso a esta opción.</Alert>

  if (runId) {
    return (
      <div className="max-w-6xl">
        <PageHeader title="Prueba de importación" actions={<Link className="text-sm text-blue-700 underline" href="/migracion">Volver</Link>} />
        <RunView id={runId} />
      </div>
    )
  }

  const toggle = (id: string, on: boolean) => {
    const list = importers.data ?? []
    let next = on ? [...chosen, id] : chosen.filter((x) => x !== id)
    // Checking one adds what it depends on; unchecking one removes what depends on it.
    if (on) next = [...new Set([...next, ...(list.find((i) => i.id === id)?.dependsOn ?? [])])]
    else next = next.filter((x) => !(list.find((i) => i.id === x)?.dependsOn ?? []).includes(id))
    setChosen(next)
  }
  const run = () =>
    start.mutate(
      { root, importers: chosen, siglas: siglas || undefined, replace },
      { onSuccess: (r) => router.push(`/migracion?run=${r.id}`) },
    )

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Migración" subtitle="Revisar una copia del sistema anterior y probar su importación." />
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">1. Carpeta del sistema anterior</h2>
        <p className="text-sm text-gray-600">
          La carpeta se lee en la PC servidor (la que tiene CONTAC, INV64, cxc64…) y nunca se modifica.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Carpeta" className="min-w-96 flex-1">
            <Input value={root} placeholder="D:\MCERP" onChange={(e) => setRoot(e.target.value)} />
          </Field>
          <Button disabled={root.trim().length < 3 || inspect.isPending} onClick={() => inspect.mutate(root.trim())}>
            {inspect.isPending ? 'Revisando…' : 'Revisar carpeta'}
          </Button>
        </div>
        {inspect.error && <Alert>{errorMessage(inspect.error)}</Alert>}
        {inspect.data && <InspectionView result={inspect.data} />}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">2. Prueba de importación</h2>
        <Alert kind="info">La prueba corre sobre una copia en memoria; la base real no cambia.</Alert>
        <div className="flex flex-wrap items-center gap-4">
          {(importers.data ?? []).map((i) => (
            <Checkbox key={i.id} label={i.label} checked={chosen.includes(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} />
          ))}
          <Field label="Siglas de la empresa (si hay varias)">
            <Input value={siglas} maxLength={10} onChange={(e) => setSiglas(e.target.value)} />
          </Field>
          <Checkbox label="Reemplazar la importación anterior" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        </div>
        <div>
          <Button variant="primary" disabled={root.trim().length < 3 || chosen.length === 0 || start.isPending} onClick={run}>
            Probar importación
          </Button>
        </div>
        {start.error && <Alert>{errorMessage(start.error)}</Alert>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">Historial de pruebas</h2>
        <RunHistory />
      </section>
    </div>
  )
}
