import { createContext, useContext } from 'react'

export type Theme = 'dark' | 'light'

/** Cómo se elige el tema: siguiendo al sol (por defecto) o fijo, para quien necesita siempre el mismo. */
export type ThemeMode = 'sun' | Theme

export interface ThemeContextValue {
  /** El tema que se está viendo ahora. */
  theme: Theme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  /** Pasa al modo siguiente: según el sol → claro → oscuro → según el sol. */
  cycleMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  mode: 'sun',
  setMode: () => {},
  cycleMode: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

const NEXT: Record<ThemeMode, ThemeMode> = { sun: 'light', light: 'dark', dark: 'sun' }

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return NEXT[mode]
}

/** Lo que hace el control de tema si se pulsa ahora (el texto dice la acción, no el estado). */
export const THEME_MODE_ACTION: Record<ThemeMode, string> = {
  sun: 'Tema según el sol',
  light: 'Usar tema claro',
  dark: 'Usar tema oscuro',
}
