'use client'

import { useEffect } from 'react'
import {
  Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, Save, XCircle, Printer, Copy,
  type LucideIcon,
} from 'lucide-react'
import { cx } from './button'

// The legacy icon bar, in the same order the old screens used:
// Agregar, Buscar, Eliminar, Modificar, Anterior, Siguiente, Grabar, Cancelar, Imprimir.
export type ToolbarAction =
  | 'agregar' | 'buscar' | 'eliminar' | 'modificar' | 'anterior'
  | 'siguiente' | 'grabar' | 'cancelar' | 'imprimir' | 'copiar'

const ACTIONS: Record<ToolbarAction, { label: string; icon: LucideIcon; key: string; hint: string }> = {
  agregar: { label: 'Agregar', icon: Plus, key: 'F2', hint: 'F2' },
  buscar: { label: 'Buscar', icon: Search, key: 'F3', hint: 'F3' },
  eliminar: { label: 'Eliminar', icon: Trash2, key: 'F8', hint: 'F8' },
  modificar: { label: 'Modificar', icon: Pencil, key: 'F4', hint: 'F4' },
  anterior: { label: 'Anterior', icon: ChevronLeft, key: 'PageUp', hint: 'Re Pág' },
  siguiente: { label: 'Siguiente', icon: ChevronRight, key: 'PageDown', hint: 'Av Pág' },
  grabar: { label: 'Grabar', icon: Save, key: 'F10', hint: 'F10' },
  cancelar: { label: 'Cancelar', icon: XCircle, key: 'Escape', hint: 'Esc' },
  imprimir: { label: 'Imprimir', icon: Printer, key: 'F9', hint: 'F9' },
  copiar: { label: 'Copiar', icon: Copy, key: 'F6', hint: 'F6' },
}

const ORDER: ToolbarAction[] = [
  'agregar', 'buscar', 'eliminar', 'modificar', 'anterior', 'siguiente', 'grabar', 'cancelar', 'copiar', 'imprimir',
]

export type ToolbarHandlers = Partial<Record<ToolbarAction, (() => void) | undefined>>

// Renders the actions that have a handler key present; an `undefined` handler
// shows the button disabled. Function keys trigger the enabled actions.
export function ActionToolbar({ actions, shortcuts = true }: { actions: ToolbarHandlers; shortcuts?: boolean }) {
  useEffect(() => {
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const hit = ORDER.find((a) => ACTIONS[a].key === e.key && a in actions)
      const handler = hit && actions[hit]
      if (!handler) return
      e.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions, shortcuts])

  return (
    <div role="toolbar" aria-label="Acciones" className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 print:hidden">
      {ORDER.filter((a) => a in actions).map((a) => {
        const { label, icon: Icon, hint } = ACTIONS[a]
        const handler = actions[a]
        return (
          <button
            key={a}
            type="button"
            disabled={!handler}
            onClick={handler}
            title={`${label} (${hint})`}
            className={cx(
              'flex min-w-[68px] flex-col items-center gap-0.5 rounded px-2 py-1.5 text-[11px] font-medium text-gray-700',
              'hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              'disabled:pointer-events-none disabled:opacity-35',
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
