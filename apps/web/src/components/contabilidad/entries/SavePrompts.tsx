'use client'

import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog } from '@/components/ui/feedback'
import { formatMoney } from '@/lib/format'
import { absMoney } from './draft'
import type { SavePrompt } from './use-entry-save'

// Questions asked while saving: lines without amounts, and an entry that does not balance.
export function SavePrompts({
  prompt, onAcceptZero, onSaveDraft, onClose,
}: {
  prompt: SavePrompt | null
  onAcceptZero: () => void
  onSaveDraft: () => void
  onClose: () => void
}) {
  if (!prompt) return null
  if (prompt.kind === 'zero') {
    const list = prompt.lines.join(', ')
    return (
      <ConfirmDialog
        open
        title="Líneas sin monto"
        confirmLabel="Grabar así"
        message={
          prompt.lines.length === 1
            ? `La línea ${list} no tiene cargo ni abono. ¿Desea grabarla de todas formas?`
            : `Las líneas ${list} no tienen cargo ni abono. ¿Desea grabarlas de todas formas?`
        }
        onConfirm={onAcceptZero}
        onClose={onClose}
      />
    )
  }
  return (
    <Dialog
      open
      title="Partida descuadrada"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} autoFocus>Seguir editando</Button>
          <Button variant="primary" onClick={onSaveDraft}>Guardar como borrador</Button>
        </>
      }
    >
      <p className="text-sm font-semibold text-red-700">La partida NO CUADRA por {formatMoney(absMoney(prompt.difference))}</p>
      <p className="mt-2 text-sm text-gray-700">
        Un borrador no afecta saldos ni reportes. Para aplicarlo, los cargos deben ser iguales a los abonos.
      </p>
    </Dialog>
  )
}
