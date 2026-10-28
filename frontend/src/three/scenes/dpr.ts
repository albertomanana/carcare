/** Utilidades de render sin componentes (aparte para no romper el refresco rápido de common.tsx). */

/**
 * Densidad de píxeles del lienzo: como mucho 1,5 (de 2 a 1,5 se pinta un 44 % menos de píxeles y apenas se nota con
 * antialias) y 1 en pantallas pequeñas (móvil), donde la GPU y la batería son más justas.
 */
export function canvasDpr(): number | [number, number] {
  if (typeof window === 'undefined') return 1
  const small = Math.min(window.innerWidth, window.innerHeight) < 640
  return small ? 1 : [1, 1.5]
}
