import { useMemo } from 'react'
import { useTheme } from '@/app/theme-context'

/**
 * Lee variables CSS del tema actual (para Recharts, que pinta SVG con atributos y no resuelve var()).
 * Se recalcula al cambiar de tema.
 */
export function useCssVars<T extends string>(names: readonly T[]): Record<T, string> {
  const { theme } = useTheme()
  const key = names.join('|')
  return useMemo(() => {
    const style = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null
    const out = {} as Record<T, string>
    for (const name of key.split('|') as T[]) out[name] = style?.getPropertyValue(`--${name}`).trim() || '#888888'
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, theme])
}
