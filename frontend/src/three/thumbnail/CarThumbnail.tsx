/**
 * Miniatura estática para listados y cabeceras: la silueta SVG propia por carrocería, teñida con el color del vehículo.
 *
 * Decisión 5.7 / regla R11 del informe de UX (24/10/2026): las miniaturas NO descargan three.js en tiempo de ejecución.
 * Antes se pintaba cada (carrocería, color) con un WebGLRenderer compartido; costaba un contexto WebGL extra, compilar
 * todos los sombreadores otra vez y ~1 MB de three.js en 12 pantallas que no tienen ningún <canvas>.
 * Ahora es SVG puro: 0 bytes de three.js, sin WebGL, nítido a cualquier tamaño y con el mismo aspecto en claro y oscuro.
 */
import type { CarThumbnailProps } from '../types'
import { CarSilhouette } from '../silhouette/CarSilhouette'

export function CarThumbnailImpl({ appearance, alt, className }: CarThumbnailProps) {
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      {/* alt="" ⇒ decorativa (la tarjeta ya nombra el vehículo): la silueta se oculta a los lectores de pantalla */}
      <CarSilhouette appearance={appearance} title={alt} className="h-full w-full" />
    </div>
  )
}
