'use client'

import { errorMessage } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/feedback'
import { CopyDialog } from './CopyDialog'
import { SavePrompts } from './SavePrompts'
import { SearchDialog } from './SearchDialog'
import { UNSAVED_MESSAGE } from './use-unsaved-guard'
import type { EntryScreenState } from './use-entry-screen'

export type OpenDialog = 'search' | 'copy' | 'void' | null

// Every dialog of the entry screen. `close` returns focus to where it was.
export function EntryDialogs({
  s, dialog, close, dismiss, onPromptClose,
}: {
  s: EntryScreenState
  dialog: OpenDialog
  close: () => void
  // Closes without restoring focus (the copy opens in edición and focuses the grid).
  dismiss: () => void
  onPromptClose: () => void
}) {
  const { entry } = s
  return (
    <>
      {dialog === 'search' && (
        <SearchDialog
          period={s.period}
          types={s.types.data ?? []}
          currentId={entry?.id ?? null}
          onClose={close}
          onOpen={(id) => {
            close()
            s.open(id)
          }}
        />
      )}
      {dialog === 'copy' && entry && (
        <CopyDialog
          entry={entry}
          period={s.period}
          pending={s.copyMutation.isPending}
          error={s.copyMutation.error}
          onClose={close}
          onCopy={async (target) => {
            if (await s.copyTo(target)) dismiss()
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'void' && !!entry}
        danger
        title={`Eliminar partida ${entry?.entryTypeCode ?? ''}-${entry?.number ?? ''}`}
        confirmLabel="Anular"
        message={
          <>
            La partida se anula y conserva su número.
            {s.voidMutation.error && (
              <span className="mt-2 block text-red-700">{errorMessage(s.voidMutation.error)}</span>
            )}
          </>
        }
        onConfirm={async () => {
          if (await s.voidCurrent()) close()
        }}
        onClose={close}
      />
      <ConfirmDialog
        open={s.discard !== null}
        danger
        title="Cambios sin grabar"
        confirmLabel="Descartar"
        message={UNSAVED_MESSAGE}
        onConfirm={() => {
          const fn = s.discard
          s.setDiscard(null)
          fn?.()
        }}
        onClose={() => s.setDiscard(null)}
      />
      <SavePrompts
        prompt={s.saver.prompt}
        onAcceptZero={s.saver.acceptZero}
        onSaveDraft={s.saver.saveAsDraft}
        onClose={() => {
          s.saver.closePrompt()
          onPromptClose()
        }}
      />
    </>
  )
}
