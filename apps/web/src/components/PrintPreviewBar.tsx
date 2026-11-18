'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Printer, X } from 'lucide-react'
import { closePrintPreview, usePrintPreview } from '@/lib/print'
import { Button } from '@/components/ui/button'

// Bar shown on top of the print preview: Imprimir (F9) opens the browser's
// print dialog, Cerrar (Esc) returns to the screen. Never printed itself.
export default function PrintPreviewBar() {
  const open = usePrintPreview()
  const pathname = usePathname()

  useEffect(() => closePrintPreview, [pathname])

  useEffect(() => {
    if (!open) return
    // Capture phase: the screen's own shortcuts (F2, F8, F10…) stay off while previewing.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePrintPreview()
      else if (e.key === 'F9') window.print()
      else if (!/^F\d+$|^Page(Up|Down)$/.test(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) return null
  return (
    <div className="print-preview-bar fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 border-b border-gray-300 bg-white px-6 py-2 shadow-sm">
      <span className="text-sm font-semibold text-gray-700">Vista previa de impresión</span>
      <div className="flex gap-2">
        <Button onClick={closePrintPreview}>
          <X size={14} /> Cerrar (Esc)
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={14} /> Imprimir (F9)
        </Button>
      </div>
    </div>
  )
}
