import { useCallback, useSyncExternalStore } from 'react'

/** true mientras se cumple la consulta de medios (p. ej. '(min-width: 1024px)'). Sin `matchMedia` (tests), false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
