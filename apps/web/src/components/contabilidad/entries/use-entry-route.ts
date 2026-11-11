'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useWorkPeriod } from '@/lib/work-period'
import { useEntry, useEntryList } from './use-entries'

// The open entry lives in the URL (?id=…) so reloads and links from reports work.
// - An entry from another month moves the working month to it (once per entry).
// - With no id, the last entry of the working month is shown (unless `editing`).
export function useEntryRoute(editing: boolean) {
  const router = useRouter()
  const pathname = usePathname()
  const urlId = useSearchParams().get('id')
  const [period, setPeriod] = useWorkPeriod()

  // router.replace lands a few renders later; until then the requested id wins, so the
  // "show the last entry" default cannot race a just-saved or just-opened entry.
  const [wanted, setWanted] = useState<{ id: string | null } | null>(null)
  useEffect(() => {
    if (wanted && wanted.id === urlId) setWanted(null)
  }, [wanted, urlId])
  const id = wanted ? wanted.id : urlId

  const setId = useCallback(
    (next: string | null) => {
      setWanted({ id: next })
      router.replace(next ? `${pathname}?id=${encodeURIComponent(next)}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  const entryQuery = useEntry(id)
  const entry = entryQuery.data && entryQuery.data.id === id ? entryQuery.data : null
  const list = useEntryList(period, false, !id)

  const synced = useRef<string | null>(null)
  useEffect(() => {
    if (!entry || synced.current === entry.id) return
    synced.current = entry.id
    if (entry.period !== period) setPeriod(entry.period)
  }, [entry, period, setPeriod])

  const last = list.data?.length ? list.data[list.data.length - 1].id : null
  useEffect(() => {
    if (!id && !editing && last) setId(last)
  }, [id, editing, last, setId])

  // The user picked another month: the open entry no longer applies.
  const changePeriod = useCallback(
    (next: string) => {
      setPeriod(next)
      setId(null)
    },
    [setPeriod, setId],
  )

  return {
    id,
    setId,
    period,
    changePeriod,
    entry,
    entryQuery,
    // True while the default entry of the month is still being looked up.
    resolving: !id && list.isLoading,
    monthEmpty: !id && list.data?.length === 0,
    listError: !id ? list.error : null,
  }
}
