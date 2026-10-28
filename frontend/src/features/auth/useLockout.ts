import { useEffect, useState } from 'react'

/**
 * Cuenta atrás tras un 429. Devuelve los segundos que faltan y la función para empezarla.
 * Se usa en entrar y en las dos pantallas de la contraseña (5 peticiones por minuto).
 */
export function useLockout() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])
  return [seconds, setSeconds] as const
}
