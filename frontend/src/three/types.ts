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
/**
 * Señal luminosa del coche para guiar al usuario. `hazard`: intermitentes ámbar unos segundos («mira aquí»).
 * `flash`: dos destellos blancos («hecho»). Un `token` nuevo la repite. Se ignora con movimiento reducido.
 */
export interface CarSignal {
  kind: 'hazard' | 'flash'
  token: number
}

export interface CarPreviewProps {
  appearance: CarAppearance
  className?: string
  signal?: CarSignal | null
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
  /**
   * Órdenes abiertas sin elevador. Las «Listo» van a la zona de entrega y el resto a la de espera (las plazas dependen
   * del número de elevadores; las que no caben se cuentan en la leyenda).
   */
  waiting?: WorkOrder[]
  selectedBay?: number | null
  /** Orden elegida (de un elevador, de la espera o de la entrega): la cámara enfoca su coche. Tiene prioridad sobre `selectedBay`. */
  selectedOrderId?: number | null
  /** Elegir un elevador; `null` = deseleccionar (clic en el vacío, Escape o «Ver toda la nave»). */
  onSelectBay?: (bay: number | null) => void
  /** Elegir el coche de una orden (clic en el coche o en su rótulo). */
  onSelectOrder?: (workOrderId: number) => void
  className?: string
  /**
   * Márgenes en px tapados por paneles HTML encima del lienzo: los encuadres y los rótulos se ajustan a la parte libre
   * (el coche enfocado no queda debajo del panel derecho). El lienzo va a sangre, sin borde propio.
   */
  focusInset?: { right?: number; top?: number; bottom?: number }
}

/** Un vehículo del garaje isométrico. Todo opcional salvo `id` y `name`: sin carrocería ⇒ 'hatchback'; sin color ⇒ azul, amarillo, blanco o rojo de maqueta según el id. */
export interface GarageVehicle {
  id: number
  /** Nombre para mostrar (apodo o «marca modelo»). */
  name: string
  plate?: string | null
  /** `color_hex` del vehículo. */
  color?: string | null
  /** `body_type` del vehículo. */
  body?: BodyType | null
}

export interface GarageSceneProps {
  /** Vehículos del garaje: una plaza por vehículo, máximo 6 visibles (los demás se cuentan en la leyenda). */
  vehicles: GarageVehicle[]
  /** Vehículo elegido: la cámara lo enfoca y su coche sube a una plataforma giratoria suave. */
  selectedId?: number | null
  /** Elegir un vehículo (clic en el coche o en su rótulo); `null` = deseleccionar (clic en el vacío, Escape o «Ver todo el garaje»). */
  onSelect?: (id: number | null) => void
  /** Márgenes en px tapados por paneles HTML encima del lienzo (como en `WorkshopSceneProps`). */
  focusInset?: { right?: number; top?: number; bottom?: number }
  /**
   * Cabecera pequeña (alto ~260 px): el garaje entero siempre a la vista (sin paneo, zoom ni vuelos de cámara),
   * rótulos cortos y sin leyenda. Sin `compact`: pantalla completa con paneo, zoom y foco.
   */
  compact?: boolean
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
