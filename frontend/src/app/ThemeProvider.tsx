import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { type Theme, ThemeContext } from './theme-context'

function initialTheme(): Theme {
  const stored = readStorage(STORAGE_KEYS.theme)
  if (stored === 'light' || stored === 'dark') return stored
  // Oscuro por defecto (identidad de marca), salvo que index.html ya haya fijado otro
  const attr = typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined
  return attr === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#111518' : '#f6f5f1')
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
