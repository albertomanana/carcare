import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { type Theme, ThemeContext } from './theme-context'

function initialTheme(): Theme {
  const stored = readStorage(STORAGE_KEYS.theme)
  if (stored === 'light' || stored === 'dark') return stored
  // Claro por defecto: la cabina de igualación se usa de día (PRODUCT.md). El oscuro es la cabina con la luz apagada.
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  return attr === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e1a30' : '#e9f0fa')
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    writeStorage(STORAGE_KEYS.theme, next)
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }),
    [theme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
