'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Account, AccountType } from '@accounting/shared'
import { filterAccounts } from './search'

// Client-side filters for the catalog table.
export function useCatalogView(accounts: Account[] | undefined) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<AccountType | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  const rows = useMemo(
    () => (accounts ? filterAccounts(accounts, search, type, showInactive) : []),
    [accounts, search, type, showInactive],
  )
  // Makes sure an account is not hidden by the current filters.
  const reveal = useCallback((a: Account) => {
    setSearch('')
    setType('')
    if (!a.isActive) setShowInactive(true)
  }, [])
  return { search, setSearch, type, setType, showInactive, setShowInactive, rows, reveal }
}
