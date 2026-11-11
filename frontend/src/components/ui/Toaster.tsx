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
      mobileOffset={{ bottom: 104 }}
      containerAriaLabel="Notificaciones"
      toastOptions={{
        classNames: {
          toast: '!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-pop !font-sans !font-semibold',
          description: '!text-fg-muted',
          actionButton: '!rounded-xl !bg-accent !text-on-accent !font-bold',
          cancelButton: '!rounded-xl !bg-surface-3 !text-fg',
          closeButton: '!bg-surface !border-line !text-fg-muted',
          success: '[&_[data-icon]]:!text-ok',
          error: '[&_[data-icon]]:!text-danger',
          warning: '[&_[data-icon]]:!text-warning',
        },
      }}
    />
  )
}
