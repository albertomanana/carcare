/**
 * "Saltar al contenido" (WCAG 2.4.1): primera parada del tabulador en la app y en la portada. Está fijo arriba a la
 * izquierda, por encima de la cabecera (z-70), y fuera de la pantalla hasta que recibe el foco; entonces baja con un
 * desplazamiento de 150 ms (sin movimiento con `prefers-reduced-motion`, ver index.css).
 *
 * No usa `sr-only focus:not-sr-only`: `not-sr-only` pone `padding: 0` al recibir el foco y el enlace salía apretado,
 * sin su relleno, encima del logo (revisión de la portada, tarea 36, 04/11).
 */
export function SkipLink({ href = '#contenido' }: { href?: string }) {
  return (
    <a
      href={href}
      className="fixed left-4 top-3 z-[70] -translate-y-[calc(100%+1rem)] rounded-control bg-accent px-4 py-2 text-sm font-semibold whitespace-nowrap text-on-accent transition-transform duration-150 ease-out-soft focus:translate-y-0"
    >
      Saltar al contenido
    </a>
  )
}
