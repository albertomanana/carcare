import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useCanvasBleed } from './canvas-context'

export interface CanvasBleedProps {
  /** La escena (p. ej. el lienzo 3D con su respaldo 2D). Ocupa toda la ventana, fija detrás de los paneles. */
  scene: ReactNode
  /** Los paneles del HUD. Se desplazan sobre la escena; solo ellos reciben el puntero (el resto atraviesa a la escena). */
  children: ReactNode
  className?: string
  /** Clases de la capa de paneles (rejilla, alineación…). */
  hudClassName?: string
}

/**
 * Pantalla con la escena 3D a sangre: el diorama ocupa toda la ventana (también bajo la barra de navegación y la
 * cabecera, que flotan encima) y los paneles flotan sobre él. El fondo de la escena debe ser `--base` para que se funda
 * con la página. Un solo `<Canvas>` por pantalla; la alternativa 2D y el HTML accesible van dentro de `scene` o de los paneles.
 *
 * Uso:
 *   <CanvasBleed scene={<TallerScene … />} hudClassName="grid gap-4 lg:grid-cols-[22rem_1fr]">
 *     <aside className="hud-panel p-4">…</aside>
 *   </CanvasBleed>
 */
export function CanvasBleed({ scene, children, className, hudClassName }: CanvasBleedProps) {
  useCanvasBleed()
  return (
    <div className={cn('canvas-bleed', className)}>
      <div className="canvas-layer">{scene}</div>
      <div className={cn('canvas-hud', hudClassName)}>{children}</div>
    </div>
  )
}
