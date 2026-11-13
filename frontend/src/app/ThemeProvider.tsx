import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { CANVAS, canvasColor, sunTheme } from '@/lib/sun'
import { nextThemeMode, type Theme, ThemeContext, type ThemeMode } from './theme-context'

/** Pasos del temple del lienzo: de 0 (pleno día o noche cerrada) a 10 (el sol en el horizonte). */
const WARMTH_STEPS = 10
/** Cada cuánto se vuelve a mirar el sol. El lienzo cambia un paso cada varios minutos. */
const SUN_REFRESH_MS = 60_000
/** Lo que dura el fundido al cambiar de tema (el bloque de movimiento reducido de index.css lo anula). */
const SHIFT_MS = 900

interface Look {
  theme: Theme
  /** Paso del temple; en los modos fijos, 0. */
  step: number
}

function initialMode(): ThemeMode {
  const stored = readStorage(STORAGE_KEYS.themeMode)
  return stored === 'light' || stored === 'dark' ? stored : 'sun'
}

function lookFor(mode: ThemeMode): Look {
  if (mode !== 'sun') return { theme: mode, step: 0 }
  const sun = sunTheme()
  return { theme: sun.theme, step: Math.round(sun.warmth * WARMTH_STEPS) }
}

/**
 * Tema de la app. Por defecto sigue al sol (`lib/sun.ts`): claro de día, oscuro de noche y el lienzo (`--base`, que es
 * también el fondo de las escenas 3D) templado cerca del amanecer y del atardecer. En Ajustes se puede fijar en claro u
 * oscuro. El tema va en `data-theme` de <html> y el paso del temple en `data-sun`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode)
  const [look, setLook] = useState<Look>(() => lookFor(initialMode()))
  const painted = useRef<Theme | null>(null)

  // Según el sol: se vuelve a mirar cada minuto y al volver a la pestaña
  useEffect(() => {
    if (mode !== 'sun') return
    const refresh = () => {
      const next = lookFor('sun')
      setLook((prev) => (prev.theme === next.theme && prev.step === next.step ? prev : next))
    }
    const timer = window.setInterval(refresh, SUN_REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    const base = mode === 'sun' ? canvasColor(look.theme, look.step / WARMTH_STEPS) : CANVAS[look.theme].core
    let timer: number | undefined
    if (painted.current && painted.current !== look.theme) {
      root.classList.add('theme-shift')
      timer = window.setTimeout(() => root.classList.remove('theme-shift'), SHIFT_MS)
    }
    painted.current = look.theme
    root.dataset.theme = look.theme
    root.dataset.sun = String(look.step)
    if (mode === 'sun') root.style.setProperty('--base', base)
    else root.style.removeProperty('--base')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base)
    // El último tema visto: index.html lo aplica antes de pintar en la siguiente visita
    writeStorage(STORAGE_KEYS.theme, look.theme)
    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        root.classList.remove('theme-shift')
      }
    }
  }, [look, mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    setLook(lookFor(next))
    writeStorage(STORAGE_KEYS.themeMode, next === 'sun' ? null : next)
  }, [])

  const value = useMemo(() => ({ theme: look.theme, mode, setMode, cycleMode: () => setMode(nextThemeMode(mode)) }), [look.theme, mode, setMode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
