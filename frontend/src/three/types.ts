/**
 * Interfaz pública del módulo 3D (propiedad del agente `experto-3d`).
 * El resto de la app solo importa desde '@/three' (index.ts) y solo usa estos props.
 * Cambiar esta interfaz requiere avisar al agente `frontend-react` y anotarlo en docs/equipo/TABLERO.md.
 */
import type { Bay, BodyType, WorkOrder, Zone, ZoneStatus } from '@/api/types'

export interface CarAppearance {
  /** null ⇒ se usa 'hatchback'. */
  bodyType: BodyType | null
  /** null ⇒ gris grafito neutro. */
  colorHex: string | null
}

export interface CarViewerProps {
  appearance: CarAppearance
  /**
   * 'showcase': coche protagonista, autorrotación lenta, sin puntos de zona.
   * 'inspect': controles de órbita + puntos de zona clicables (requiere `zones`).
   */
  mode?: 'showcase' | 'inspect'
  zones?: ZoneStatus[]
  selectedZone?: Zone | null
  onSelectZone?: (zone: Zone | null) => void
  /** Vista "rayos X" ilustrativa: carrocería translúcida y componentes internos simplificados. */
  xray?: boolean
  lighting?: 'studio' | 'night'
  className?: string
  /** Texto alternativo del lienzo para lectores de pantalla. */
  ariaLabel?: string
}

/** Vista previa ligera para formularios (cambia de carrocería/color en vivo). Sin controles. */
export interface CarPreviewProps {
  appearance: CarAppearance
  className?: string
}

/** Imagen estática del coche (render cacheado o silueta SVG). Para listados: no crea un WebGL por tarjeta. */
export interface CarThumbnailProps {
  appearance: CarAppearance
  alt: string
  className?: string
}

/** Silueta SVG 2D, sin WebGL: fallback universal y para reduced-motion/sin GPU. */
export interface CarSilhouetteProps {
  appearance: CarAppearance
  className?: string
  title?: string
}

export interface WorkshopSceneProps {
  bays: Bay[]
  /** Órdenes abiertas sin elevador: se aparcan en la zona de espera (máx. 8 visibles). */
  waiting?: WorkOrder[]
  selectedBay?: number | null
  onSelectBay?: (bay: number | null) => void
  onSelectOrder?: (workOrderId: number) => void
  className?: string
}

/**
 * Imagen fija de la portada: render propio del coche procedural (berlina azul, sin marca) en WebP con transparencia,
 * 1280×720 y 640×360. No descarga three.js. La sombra está dentro de la imagen y funciona en tema claro y oscuro.
 */
export interface HeroImageProps {
  className?: string
  /** Texto alternativo. Pasa '' si la imagen acompaña a un titular que ya lo dice (decorativa). */
  alt?: string
  /** true si está en la primera pantalla: carga prioritaria (`fetchpriority="high"`), sin `loading="lazy"`. */
  priority?: boolean
  /** Atributo `sizes`: ancho con el que se muestra, para que el navegador elija la de 640 o la de 1280. */
  sizes?: string
}

export interface HeroSceneProps {
  /** Progreso de scroll 0..1 para coreografiar cámara y color. */
  progress?: number
  className?: string
}
