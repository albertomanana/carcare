/**
 * Imagen fija de la portada (regla R11 del informe de UX: la portada no descarga three.js al cargar).
 * Es un render del propio coche procedural (berlina, sin marca ni logotipos, D16), generado con el laboratorio 3D
 * (`/three-lab.html?tab=debug&still=1&body=sedan&color=%231f3a5f&az=34&el=8&dist=8.8&ty=0.6&tx=0.35`) a 2× y
 * reducido a 1280 y 640 px. Se regenera con el script descrito en el informe 2026-10-23-experto-3d-rendimiento.
 */
import type { HeroImageProps } from '../types'

const BASE = import.meta.env.BASE_URL ?? '/'
const HERO_IMAGE = {
  src1280: `${BASE}img/portada-coche-1280.webp`,
  src640: `${BASE}img/portada-coche-640.webp`,
  width: 1280,
  height: 720,
} as const

const DEFAULT_ALT = 'Ilustración 3D de una berlina azul genérica, sin marca'

export function HeroImageImpl({ className, alt = DEFAULT_ALT, priority = false, sizes = '(min-width: 1024px) 50vw, 100vw' }: HeroImageProps) {
  return (
    <img
      src={HERO_IMAGE.src1280}
      srcSet={`${HERO_IMAGE.src640} 640w, ${HERO_IMAGE.src1280} 1280w`}
      sizes={sizes}
      width={HERO_IMAGE.width}
      height={HERO_IMAGE.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
      className={className}
    />
  )
}
