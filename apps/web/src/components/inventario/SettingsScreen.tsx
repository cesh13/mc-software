'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch, errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { usePermissions } from '@/lib/permissions'
import { Alert, Loading, PageHeader } from '@/components/ui/feedback'
import { Checkbox, Field, Select } from '@/components/ui/form'
import { useEntryTypes } from '@/components/contabilidad/entries/use-gl-setup'
import { invKey, useInvMutation } from './use-inventory'

type SettingRow = { key: string; value: unknown }

// Configuración del inventario por empresa (namespace 'inventory' de empresa-settings).
export function SettingsScreen() {
  const { empresa } = useEmpresa()
  const { can } = usePermissions()
  const editable = can('core.settings.manage')
  const settings = useQuery<SettingRow[]>({
    queryKey: invKey(empresa.id, 'settings'),
    queryFn: () => apiFetch('/api/empresa-settings?namespace=inventory'),
  })
  const types = useEntryTypes()
  const save = useInvMutation((v: { key: string; value: unknown }) =>
    apiFetch('/api/empresa-settings', { method: 'PUT', json: { namespace: 'inventory', ...v } }))
  const value = (key: string) => settings.data?.find((s) => s.key === key)?.value
  return (
    <div className="max-w-xl">
      <PageHeader title="Configuración de inventario" subtitle={empresa.name} />
      {settings.isLoading && <Loading />}
      {settings.data && (
        <div className="flex flex-col gap-4">
          <Checkbox
            label="Contabilizar los movimientos (una partida por documento)"
            checked={value('postToGl') === true} disabled={!editable}
            onChange={(e) => save.mutate({ key: 'postToGl', value: e.target.checked })}
          />
          <Field label="Tipo de partida para inventario">
            <Select value={(value('entryTypeId') as string | null) ?? ''} disabled={!editable}
              onChange={(e) => save.mutate({ key: 'entryTypeId', value: e.target.value || null })}>
              <option value="">(sin elegir)</option>
              {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
            </Select>
          </Field>
          <Field label="Salidas sin existencia suficiente" hint="Bloquear: solo quien tiene el permiso puede grabarlas, marcándolo en el movimiento.">
            <Select value={String(value('negativeStock') ?? 'bloquear')} disabled={!editable}
              onChange={(e) => save.mutate({ key: 'negativeStock', value: e.target.value })}>
              <option value="bloquear">Bloquear</option>
              <option value="permitir">Permitir</option>
            </Select>
          </Field>
          {!editable && <Alert kind="info">Solo quien administra la configuración de la empresa puede cambiar estos valores.</Alert>}
        </div>
      )}
      {(settings.error ?? save.error) != null && <div className="mt-3"><Alert>{errorMessage(settings.error ?? save.error)}</Alert></div>}
    </div>
  )
}
