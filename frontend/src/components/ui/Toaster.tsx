import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/app/theme-context'

/** Avisos con aria-live (sonner anuncia cada toast en una región "polite"). */
export function Toaster() {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      richColors={false}
      offset={16}
      mobileOffset={{ bottom: 88 }}
      containerAriaLabel="Notificaciones"
      toastOptions={{
        classNames: {
          toast: '!rounded-card !border !border-line !bg-surface-2 !text-fg !shadow-2xl !font-sans',
          description: '!text-fg-muted',
          actionButton: '!bg-accent !text-on-accent !font-medium',
          cancelButton: '!bg-surface-3 !text-fg',
          closeButton: '!bg-surface-3 !border-line !text-fg-muted',
          success: '[&_[data-icon]]:!text-ok',
          error: '[&_[data-icon]]:!text-danger',
          warning: '[&_[data-icon]]:!text-warning',
        },
      }}
    />
  )
}
