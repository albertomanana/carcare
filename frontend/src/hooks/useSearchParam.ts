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
