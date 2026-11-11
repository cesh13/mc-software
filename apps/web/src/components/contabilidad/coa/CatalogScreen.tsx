'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Account } from '@accounting/shared'
import { errorMessage } from '@/lib/api'
import { useEmpresa } from '@/lib/empresa'
import { useCurrentUser } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Alert, ConfirmDialog, Loading, PageHeader } from '@/components/ui/feedback'
import { ActionToolbar } from '@/components/ui/toolbar'
import { AccountDialog, type AccountDialogState } from './AccountDialog'
import { AccountsTable, rowDomId } from './AccountsTable'
import { BudgetGroupsDialog } from './BudgetGroupsDialog'
import { CatalogFilters } from './CatalogFilters'
import { useCatalogView } from './use-catalog-view'
import { useAccounts, useCoaMutations } from './use-coa'

export function CatalogScreen() {
  const { empresa } = useEmpresa()
  const { can } = useCurrentUser()
  const accounts = useAccounts()
  const view = useCatalogView(accounts.data)
  const { reveal } = view
  const { setAccountActive } = useCoaMutations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrollTick, setScrollTick] = useState(0)
  const [dialog, setDialog] = useState<AccountDialogState | null>(null)
  const [confirm, setConfirm] = useState<Account | null>(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = selectedId ? accounts.byId.get(selectedId) ?? null : null
  const busy = dialog !== null || confirm !== null || groupsOpen
  const focusTable = () => setTimeout(() => tableRef.current?.focus(), 0)

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setScrollTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (selectedId) document.getElementById(rowDomId(selectedId))?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, scrollTick])

  // /contabilidad/catalogo?code=... selects that account once the list is loaded.
  const codeParam = useSearchParams().get('code')
  const handledCode = useRef<string | null>(null)
  useEffect(() => {
    if (!codeParam || !accounts.data || handledCode.current === codeParam) return
    handledCode.current = codeParam
    const hit = accounts.data.find((a) => a.code === codeParam)
    if (hit) {
      reveal(hit)
      select(hit.id)
    }
  }, [codeParam, accounts.data, reveal, select])

  function openAdd() {
    const parent = !selected
      ? null
      : selected.isDetail
        ? selected.parentId
          ? accounts.byId.get(selected.parentId) ?? null
          : null
        : selected
    setDialog({ mode: 'add', parent })
  }
  const openEdit = (a: Account | null) => {
    if (a) setDialog({ mode: 'edit', account: a })
  }
  const closeDialog = () => {
    setDialog(null)
    focusTable()
  }

  async function toggleActive(a: Account, active: boolean) {
    try {
      await setAccountActive.mutateAsync({ id: a.id, active })
      setConfirm(null)
      focusTable()
    } catch {
      // The error stays visible in the confirm dialog or the alert below.
    }
  }

  function searchEnter() {
    const first = view.rows[0]
    if (first && (!selected || !view.rows.includes(selected))) select(first.id)
    tableRef.current?.focus()
  }

  return (
    <div>
      <h1 className="hidden text-lg font-semibold print:block">Catálogo de cuentas - {empresa.name}</h1>
      <PageHeader
        title="Catálogo de cuentas"
        subtitle={empresa.name}
        actions={
          <>
            {selected && !selected.isActive && can('supervise') && (
              <Button onClick={() => void toggleActive(selected, true)}>Reactivar</Button>
            )}
            <Button onClick={() => setGroupsOpen(true)}>Agrupaciones</Button>
          </>
        }
      />
      <div className="mb-3 print:hidden">
        <ActionToolbar
          shortcuts={!busy}
          actions={{
            agregar: can('capture') ? openAdd : undefined,
            buscar: () => searchRef.current?.focus(),
            modificar: can('capture') && selected ? () => openEdit(selected) : undefined,
            eliminar:
              can('supervise') && selected?.isActive
                ? () => {
                    setAccountActive.reset()
                    setConfirm(selected)
                  }
                : undefined,
            imprimir: () => window.print(),
          }}
        />
      </div>
      <CatalogFilters
        search={view.search}
        onSearch={view.setSearch}
        type={view.type}
        onType={view.setType}
        showInactive={view.showInactive}
        onShowInactive={view.setShowInactive}
        searchRef={searchRef}
        onSearchEnter={searchEnter}
      />
      {accounts.isLoading && <Loading />}
      {accounts.error && <Alert>{errorMessage(accounts.error)}</Alert>}
      {setAccountActive.error && !confirm && <Alert>{errorMessage(setAccountActive.error)}</Alert>}
      {accounts.data?.length === 0 && (
        <p className="py-6 text-sm text-gray-500">El catálogo está vacío. Use Agregar para crear la primera cuenta.</p>
      )}
      {!!accounts.data?.length && view.rows.length === 0 && (
        <p className="py-6 text-sm text-gray-500">Ninguna cuenta coincide con la búsqueda.</p>
      )}
      {view.rows.length > 0 && (
        <AccountsTable
          rows={view.rows}
          selectedId={selectedId}
          onSelect={select}
          onOpen={(a) => can('capture') && openEdit(a)}
          wrapRef={tableRef}
        />
      )}
      {dialog && (
        <AccountDialog
          key={dialog.mode === 'edit' ? dialog.account.id : 'add'}
          state={dialog}
          onClose={closeDialog}
          onSaved={(a) => {
            if (dialog.mode === 'add') reveal(a)
            select(a.id)
            closeDialog()
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        danger
        title="Eliminar cuenta"
        confirmLabel="Eliminar"
        message={
          <>
            ¿Desea eliminar la cuenta {confirm?.code} - {confirm?.name}? Quedará inactiva.
            {setAccountActive.error && (
              <span className="mt-2 block text-red-700">{errorMessage(setAccountActive.error)}</span>
            )}
          </>
        }
        onConfirm={() => confirm && void toggleActive(confirm, false)}
        onClose={() => {
          setConfirm(null)
          focusTable()
        }}
      />
      <BudgetGroupsDialog
        open={groupsOpen}
        onClose={() => {
          setGroupsOpen(false)
          focusTable()
        }}
      />
    </div>
  )
}
