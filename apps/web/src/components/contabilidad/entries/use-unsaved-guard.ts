'use client'

import { useEffect } from 'react'

export const UNSAVED_MESSAGE = 'Hay cambios sin grabar en la partida. ¿Desea descartarlos?'

// While `active`: warns on reload/close, and asks before following any link on the page
// (menu included), since client-side navigation does not fire `beforeunload`.
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (!link || e.defaultPrevented) return
      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])
}
