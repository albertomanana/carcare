/**
 * Registro de los elementos DOM de la capa de rótulos (ver ./overlay.tsx). Va aparte de los componentes para que
 * Fast Refresh funcione con overlay.tsx (un archivo de componentes no debe exportar clases ni hooks sueltos).
 */
import { useMemo } from 'react'

export class OverlayStore {
  readonly els = new Map<string, HTMLElement>()
  readonly lines = new Map<string, SVGLineElement>()
  readonly dots = new Map<string, SVGCircleElement>()
  /** Desplazamiento elegido en el fotograma anterior (histéresis: evita saltos entre posiciones equivalentes). */
  readonly prev = new Map<string, [number, number]>()
  /** `invalidate` del lienzo que proyecta los rótulos: al montarse un rótulo hay que pintar un fotograma. */
  private invalidate: (() => void) | null = null

  /** Enlaza el lienzo; devuelve la función que lo desenlaza (solo si sigue siendo el mismo). */
  bind(invalidate: () => void) {
    this.invalidate = invalidate
    return () => {
      if (this.invalidate === invalidate) this.invalidate = null
    }
  }

  setEl(id: string, el: HTMLElement | null) {
    if (el) this.els.set(id, el)
    else this.els.delete(id)
    this.invalidate?.()
  }
  setLine(id: string, el: SVGLineElement | null) {
    if (el) this.lines.set(id, el)
    else this.lines.delete(id)
  }
  setDot(id: string, el: SVGCircleElement | null) {
    if (el) this.dots.set(id, el)
    else this.dots.delete(id)
  }
}

export function useOverlayStore() {
  return useMemo(() => new OverlayStore(), [])
}
