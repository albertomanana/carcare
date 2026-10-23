import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { isGuardSkipped } from '@/lib/navigation'

/**
 * Avisa antes de salir de un formulario con cambios sin guardar
 * (navegación interna con un diálogo accesible; recarga/cierre con el aviso del navegador).
 *
 * Tras guardar, navega con `navigate(ruta, { state: AFTER_SAVE })` (lib/navigation): esa navegación
 * no se bloquea aunque el formulario siga «sucio» en ese instante.
 */
export function useUnsavedChanges(when: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => when && !isGuardSkipped(nextLocation.state) && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en este formulario. Si sales ahora, se perderán."
      confirmLabel="Salir sin guardar"
      cancelLabel="Seguir editando"
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
    />
  )
}
