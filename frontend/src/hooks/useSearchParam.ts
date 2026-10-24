import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/** Estado guardado en la URL (?clave=valor): los filtros sobreviven a recargas y se pueden compartir. */
export function useSearchParam(key: string, fallback = ''): [string, (value: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? fallback
  const setValue = useCallback(
    (next: string | null) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === null || next === '' || next === fallback) p.delete(key)
          else p.set(key, next)
          return p
        },
        { replace: true },
      )
    },
    [key, fallback, setParams],
  )
  return [value, setValue]
}

/**
 * Cambia varios parámetros de la URL en una sola navegación (null o '' borra la clave).
 * Hace falta porque `setSearchParams` parte de los parámetros del render actual: dos llamadas
 * seguidas en el mismo evento se pisan y solo queda la última.
 */
export function useSearchParamsPatch(): (updates: Record<string, string | null>) => void {
  const [, setParams] = useSearchParams()
  return useCallback(
    (updates) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === '') p.delete(key)
            else p.set(key, value)
          }
          return p
        },
        { replace: true },
      )
    },
    [setParams],
  )
}
