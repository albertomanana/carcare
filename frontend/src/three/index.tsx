/**
 * Punto de entrada público del módulo 3D (propiedad del agente `experto-3d`).
 *
 * LIGERO (sin three.js, se puede importar desde cualquier pantalla): `CarThumbnail`, `CarSilhouette`,
 * `useWebGLAvailable`, los respaldos 2D y los envoltorios de abajo. Este módulo y lo que importa NO deben importar
 * 'three', '@react-three/*' ni nada de ./scenes o ./car/{build,geometry,materials,...} de forma estática.
 *
 * PESADO (three.js + R3F + drei, chunk diferido): las escenas de ./scenes, que solo se piden con `lazy()` cuando un
 * envoltorio decide montarlas. Mientras cargan, si fallan o si no hay WebGL, se muestra el respaldo 2D.
 * Los nombres exportados y sus props (./types.ts) son el contrato con `frontend-react`.
 */
import { lazy, Suspense } from 'react'
import type { CarPreviewProps, CarSilhouetteProps, CarThumbnailProps, CarViewerProps, HeroSceneProps, WorkshopSceneProps } from './types'
import { useWebGLAvailable } from './env'
import { SilhouetteBox, ThreeBoundary, Workshop2D, ZoneMap2D } from './fallbacks'
import { CarSilhouette as Silhouette } from './silhouette/CarSilhouette'
import { CarThumbnailImpl } from './thumbnail/CarThumbnail'

export type * from './types'

const CarViewerCanvas = lazy(() => import('./scenes/CarViewerCanvas'))
const CarPreviewCanvas = lazy(() => import('./scenes/CarPreviewCanvas'))
const WorkshopCanvas = lazy(() => import('./scenes/WorkshopCanvas'))
const HeroCanvas = lazy(() => import('./scenes/HeroCanvas'))
const ThreeLabImpl = lazy(() => import('./lab/ThreeLab'))

export { useWebGLAvailable } from './env'

/** Coche 3D principal (ficha del vehículo, dashboard). */
export function CarViewer(props: CarViewerProps) {
  const webgl = useWebGLAvailable()
  const inspect = props.mode === 'inspect'
  const fallback = inspect ? <ZoneMap2D {...props} /> : <SilhouetteBox appearance={props.appearance} className={props.className} title={props.ariaLabel} />
  if (!webgl) return fallback
  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={inspect ? fallback : <SilhouetteBox appearance={props.appearance} className={props.className} title={props.ariaLabel} loading />}>
        <CarViewerCanvas {...props} />
      </Suspense>
    </ThreeBoundary>
  )
}

/** Vista previa ligera para formularios: cambia de carrocería y color en vivo. */
export function CarPreview(props: CarPreviewProps) {
  const webgl = useWebGLAvailable()
  const fallback = <SilhouetteBox appearance={props.appearance} className={props.className} />
  if (!webgl) return fallback
  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={<SilhouetteBox appearance={props.appearance} className={props.className} loading />}>
        <CarPreviewCanvas {...props} />
      </Suspense>
    </ThreeBoundary>
  )
}

/** Imagen estática para listados y cabeceras: silueta SVG teñida. No descarga three.js ni crea contextos WebGL. */
export function CarThumbnail(props: CarThumbnailProps) {
  return <CarThumbnailImpl {...props} />
}

/** Silueta SVG 2D, sin WebGL. */
export function CarSilhouette(props: CarSilhouetteProps) {
  return <Silhouette {...props} />
}

/** Taller 3D: nave con elevadores numerados, coches de las órdenes y zona de espera. */
export function WorkshopScene(props: WorkshopSceneProps) {
  const webgl = useWebGLAvailable()
  const fallback = <Workshop2D {...props} />
  if (!webgl) return fallback
  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={<div className={['grid min-h-64 place-items-center rounded-card bg-surface-2 text-sm text-fg-subtle', props.className].filter(Boolean).join(' ')} aria-busy="true">Cargando taller 3D…</div>}>
        <WorkshopCanvas {...props} />
      </Suspense>
    </ThreeBoundary>
  )
}

/** Escena de portada coreografiada por el scroll (`progress` 0..1). Decorativa: aria-hidden. */
export function HeroScene(props: HeroSceneProps) {
  const webgl = useWebGLAvailable()
  const fallback = (
    <div className={props.className} aria-hidden>
      <SilhouetteBox appearance={{ bodyType: 'coupe', colorHex: null }} className="h-full w-full" />
    </div>
  )
  if (!webgl) return fallback
  return (
    <ThreeBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <HeroCanvas {...props} />
      </Suspense>
    </ThreeBoundary>
  )
}

/** Laboratorio de revisión visual (solo desarrollo, ruta /dev/3d): todas las carrocerías, estados y escenas. */
export function ThreeLab() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-fg-subtle">Cargando laboratorio 3D…</p>}>
      <ThreeLabImpl />
    </Suspense>
  )
}
