import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Id numérico de un enlace del tipo `#gasto-12` (prefijo `gasto`); null si el hash no es de ese tipo. */
export function useHashTarget(prefix: string): string | null {
  const { hash } = useLocation()
  return new RegExp(`^#${prefix}-(\\d+)$`).exec(hash)?.[1] ?? null
}

interface RevealOptions {
  id: string | null
  prefix: string
  /** La lista ya ha cargado (no está en `isPending`). */
  ready: boolean
  /** El elemento está en la lista cargada. */
  found: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => unknown
}

/**
 * Lleva hasta el elemento enlazado (`#prefijo-id`): si aún no está en la lista paginada, pide la página
 * siguiente; cuando aparece, se desplaza hasta él y le pasa el foco (para quien navega con teclado).
 */
export function useRevealHashTarget({ id, prefix, ready, found, hasNextPage, isFetchingNextPage, fetchNextPage }: RevealOptions) {
  useEffect(() => {
    if (!id || !ready) return
    if (found) {
      const el = document.getElementById(`${prefix}-${id}`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.focus({ preventScroll: true })
      return
    }
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage?.()
  }, [id, prefix, ready, found, hasNextPage, isFetchingNextPage, fetchNextPage])
}
