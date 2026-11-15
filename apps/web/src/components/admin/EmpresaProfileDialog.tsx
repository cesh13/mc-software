'use client'

import { useEffect, useState } from 'react'
import type { EmpresaProfileInput } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import type { Empresa } from '@/lib/empresa'
import { Button } from '@/components/ui/button'
import { Alert, Dialog, Loading } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/form'
import { useEmpresaProfile, useSaveEmpresaProfile } from './use-empresa-profile'

type Form = Omit<EmpresaProfileInput, 'logoRef'> & { logoRef: string }

const toForm = (p: EmpresaProfileInput): Form => ({ ...p, logoRef: p.logoRef ?? '' })

// Fiscal profile ("ficha fiscal") of one empresa.
export function EmpresaProfileDialog({ empresa, onClose }: { empresa: Empresa; onClose: () => void }) {
  const profile = useEmpresaProfile(empresa.id)
  const save = useSaveEmpresaProfile(empresa.id)
  const [form, setForm] = useState<Form | null>(null)

  useEffect(() => {
    if (!profile.data || form) return
    const p = profile.data
    // First time: start from the empresa's own name.
    setForm(toForm({ ...p, legalName: p.legalName || empresa.name }))
  }, [profile.data, form, empresa.name])

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f))
  const submit = () => form && save.mutate({ ...form, logoRef: form.logoRef.trim() || null }, { onSuccess: onClose })

  return (
    <Dialog
      open
      wide
      title={`Ficha fiscal — ${empresa.siglas}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!form || save.isPending} onClick={submit}>Grabar</Button>
        </>
      }
    >
      {profile.isLoading && <Loading />}
      {profile.error && <Alert>{errorMessage(profile.error)}</Alert>}
      {form && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Razón social" className="col-span-2">
            <Input value={form.legalName} maxLength={200} onChange={set('legalName')} autoFocus />
          </Field>
          <Field label="Nombre comercial" className="col-span-2">
            <Input value={form.tradeName} maxLength={200} onChange={set('tradeName')} />
          </Field>
          <Field label="NIT" hint="Solo dígitos y guiones.">
            <Input value={form.nit} maxLength={20} onChange={set('nit')} />
          </Field>
          <Field label="NRC" hint="Solo dígitos y guiones.">
            <Input value={form.nrc} maxLength={20} onChange={set('nrc')} />
          </Field>
          <Field label="Giro o actividad" className="col-span-2">
            <Input value={form.giro} maxLength={300} onChange={set('giro')} />
          </Field>
          <Field label="Código de actividad económica">
            <Input value={form.economicActivityCode} maxLength={20} onChange={set('economicActivityCode')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departamento">
              <Input value={form.departmentCode} maxLength={10} onChange={set('departmentCode')} />
            </Field>
            <Field label="Municipio">
              <Input value={form.municipalityCode} maxLength={10} onChange={set('municipalityCode')} />
            </Field>
          </div>
          <Field label="Dirección" className="col-span-2">
            <Input value={form.address} maxLength={300} onChange={set('address')} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} maxLength={30} onChange={set('phone')} />
          </Field>
          <Field label="Correo electrónico">
            <Input type="email" value={form.email} maxLength={120} onChange={set('email')} />
          </Field>
          <Field label="Leyenda de montos" hint="Se imprime en los reportes, p. ej. “Valores expresados en dólares”." className="col-span-2">
            <Input value={form.amountsLegend} maxLength={200} onChange={set('amountsLegend')} />
          </Field>
          <Field label="Logo (referencia)" hint="La carga de archivos llegará más adelante." className="col-span-2">
            <Input value={form.logoRef} maxLength={300} onChange={set('logoRef')} />
          </Field>
          {save.error && <div className="col-span-2"><Alert>{errorMessage(save.error)}</Alert></div>}
        </div>
      )}
    </Dialog>
  )
}
