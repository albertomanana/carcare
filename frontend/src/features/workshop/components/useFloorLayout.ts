/**
 * Medidas de la pantalla Taller 3D: qué disposición toca según el ancho (paneles flotando o apilados) y cuánto tapa
 * cada panel flotante del lienzo, para que la escena enfoque el coche elegido en la parte que se ve (`focusInset`).
 */
import { useCallback, useState, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches),
    () => false,
  )
}

export interface BoxSize {
  width: number
  height: number
}

/**
 * Tamaño en px de un elemento, al día con ResizeObserver. Devuelve `[ref, tamaño]`; el ref es de callback, así
 * vuelve a medir aunque el elemento se monte y desmonte (el panel de detalle aparece y desaparece).
 */
export function useBoxSize() {
  const [size, setSize] = useState<BoxSize>({ width: 0, height: 0 })

  // React 19: el ref de callback devuelve su limpieza, que se llama al desmontar en lugar de ref(null).
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const reset = () => setSize({ width: 0, height: 0 })
    if (typeof ResizeObserver === 'undefined') {
      const r = el.getBoundingClientRect()
      setSize({ width: Math.round(r.width), height: Math.round(r.height) })
      return reset
    }
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0]
      const width = Math.round(box ? box.inlineSize : entry.contentRect.width)
      const height = Math.round(box ? box.blockSize : entry.contentRect.height)
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      reset()
    }
  }, [])

  return [ref, size] as const
}
