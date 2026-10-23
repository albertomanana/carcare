import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Dialog = RD.Root
export const DialogTrigger = RD.Trigger
export const DialogClose = RD.Close

export type DialogVariant = 'center' | 'sheet' | 'drawer'

export interface DialogContentProps extends Omit<ComponentProps<typeof RD.Content>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /**
   * center: diálogo centrado · sheet: hoja inferior en móvil y diálogo en escritorio ·
   * drawer: hoja inferior en móvil y panel lateral derecho en escritorio.
   */
  variant?: DialogVariant
  size?: 'sm' | 'md' | 'lg' | 'xl'
  hideClose?: boolean
  /** Contenido a la derecha del título. */
  headerAside?: ReactNode
}

const SIZES = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }

export function DialogContent({
  title,
  description,
  variant = 'sheet',
  size = 'md',
  hideClose,
  headerAside,
  className,
  children,
  ...props
}: DialogContentProps) {
  const placement = {
    center:
      'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-hero data-[state=open]:animate-pop-in',
    sheet:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero data-[state=open]:animate-sheet-in ' +
      'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100vw-4rem)] md:max-h-[calc(100dvh-4rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-hero md:data-[state=open]:animate-pop-in',
    drawer:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero data-[state=open]:animate-sheet-in ' +
      'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:rounded-none md:rounded-l-hero md:data-[state=open]:animate-drawer-in',
  }[variant]

  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
      <RD.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border border-line bg-surface shadow-2xl shadow-black/40 outline-none data-[state=closed]:animate-fade-out',
          placement,
          variant === 'drawer' ? (size === 'xl' ? 'md:max-w-3xl' : size === 'lg' ? 'md:max-w-xl' : 'md:max-w-md') : SIZES[size],
          className,
        )}
        {...props}
      >
        {variant !== 'center' && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-4 md:px-6 md:pt-5">
          <div className="min-w-0">
            <RD.Title className="font-display text-lg font-semibold tracking-tight text-fg-warm">{title}</RD.Title>
            {description && <RD.Description className="mt-1 text-sm text-fg-muted">{description}</RD.Description>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerAside}
            {!hideClose && (
              <RD.Close
                className="-mr-2 -mt-1 grid size-11 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg md:size-9"
                aria-label="Cerrar"
              >
                <X aria-hidden className="size-5" />
              </RD.Close>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </RD.Content>
    </RD.Portal>
  )
}

export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-5 md:px-6', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'safe-bottom sticky bottom-0 flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6',
        className,
      )}
      {...props}
    />
  )
}
