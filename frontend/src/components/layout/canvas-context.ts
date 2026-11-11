import { createContext, useContext, useLayoutEffect } from 'react'

/**
 * Lienzo a sangre: una pantalla con escena 3D de fondo pide a `AppShell` que quite el margen del contenido y flote la
 * cabecera sobre la escena. Mismo patrón que `primary-action.ts`: la pantalla «reclama» el lienzo mientras está montada.
 */
export const CanvasContext = createContext<{ claim: () => () => void } | null>(null)

/** Marca la pantalla como lienzo a sangre. Normalmente se usa a través de `<CanvasBleed>`. */
export function useCanvasBleed(enabled = true) {
  const ctx = useContext(CanvasContext)
  useLayoutEffect(() => (enabled ? ctx?.claim() : undefined), [ctx, enabled])
}
