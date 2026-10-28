import { createContext, useContext, useEffect } from 'react'

/**
 * Regla R1 del informe de UX: una sola acción primaria (relleno de acento) a la vista, contando la barra
 * inferior del móvil. Cada botón primario montado en la pantalla lo "reclama"; mientras haya alguno, el "+"
 * de la barra inferior se pinta como botón normal. Fuera del AppShell (entrar, registro…) no hace nada.
 */
export const PrimaryActionContext = createContext<{ claim: () => () => void }>({ claim: () => () => {} })

export function useClaimPrimaryAction(active: boolean) {
  const { claim } = useContext(PrimaryActionContext)
  useEffect(() => (active ? claim() : undefined), [active, claim])
}
