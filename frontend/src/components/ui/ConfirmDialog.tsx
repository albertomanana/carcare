import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from './Dialog'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  /** Contenido adicional (p. ej. campo de contraseña). */
  children?: ReactNode
  confirmDisabled?: boolean
}

/** Confirmación accesible para acciones relevantes o destructivas. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent title={title} description={description} variant="center" size="sm" role="alertdialog">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm()
          }}
        >
          {children && <DialogBody>{children}</DialogBody>}
          <DialogFooter className={children ? undefined : 'border-t-0 pt-2'}>
            <DialogClose asChild>
              <Button disabled={loading}>{cancelLabel}</Button>
            </DialogClose>
            <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
