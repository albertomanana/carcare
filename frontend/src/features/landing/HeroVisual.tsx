import { Pause, Rotate3d } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { readStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { HeroImage, HeroScene, useWebGLAvailable } from '@/three'
import {
  DESKTOP_QUERY,
  heroMode,
  prefersSavingData,
  REDUCED_MOTION_QUERY,
  useAfterFirstPaint,
  useCanvasState,
  useIdleAfterImage,
  useMediaQuery,
  useScrollProgress,
} from './hero'

interface HeroVisualProps {
  /** Sección cuyo scroll mueve la cámara de la escena (0 arriba, 1 al final). */
  stage: RefObject<HTMLElement | null>
  className?: string
}

/**
 * Coche del héroe. Primero la imagen fija (`HeroImage`: es el LCP de la portada y no descarga three.js) y, en
 * escritorio, cuando la imagen ya está y el navegador está en reposo, la escena 3D encima con un fundido. La escena
 * sigue el scroll de la sección (cámara, rayos X y puntos de zona de ejemplo). En móvil, tableta, con movimiento
 * reducido o con ahorro de datos se queda la imagen y "Ver en 3D" carga la escena a petición. "Detener animación" la
 * quita (WCAG 2.2.2) y se recuerda en este navegador. La escena es decorativa (aria-hidden): lo que cuenta está en
 * el texto de la sección.
 *
 * Si hay WebGL se comprueba después de la primera pintura (`WebGLProbe`): crear el contexto de prueba puede bloquear
 * el hilo principal más de 1 s si la GPU está ocupada, y la portada tiene que pintarse antes. Mientras tanto, solo la
 * imagen.
 */
export function HeroVisual({ stage, className }: HeroVisualProps) {
  const painted = useAfterFirstPaint()
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [saveData] = useState(prefersSavingData)
  const [stopped, setStopped] = useState(() => readStorage(STORAGE_KEYS.landing3d) === 'off')
  const [requested, setRequested] = useState(false)

  const mode = heroMode({ webgl: webgl === true, reducedMotion, desktop, saveData, stopped })
  const imageHolder = useRef<HTMLDivElement>(null)
  const sceneHolder = useRef<HTMLDivElement>(null)
  const idle = useIdleAfterImage(imageHolder, mode === 'auto')
  const mounted = mode !== 'none' && (requested || (mode === 'auto' && idle))
  const canvas = useCanvasState(sceneHolder, mounted)
  const shown = canvas === 'shown'
  const loading = requested && canvas === 'loading'
  const progress = useScrollProgress(stage, mounted)

  const start = () => {
    writeStorage(STORAGE_KEYS.landing3d, null)
    setStopped(false)
    setRequested(true)
  }
  const stop = () => {
    writeStorage(STORAGE_KEYS.landing3d, 'off')
    setStopped(true)
    setRequested(false)
  }

  return (
    // En escritorio, escenario fijo (sticky) a la derecha con los controles encima; en móvil, una caja 16:10 con los
    // controles debajo, para no tapar el coche.
    <div className={cn('relative min-w-0 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:min-h-[32rem]', className)}>
      <div id="portada-visual" className="relative aspect-[16/10] overflow-hidden sm:aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto">
        <div ref={imageHolder} className={cn('absolute inset-0 grid place-items-center transition-opacity duration-300 ease-out-soft', shown && 'opacity-0')}>
          <HeroImage priority sizes="(min-width: 1024px) 60vw, 100vw" className="h-auto w-[125%] max-w-none lg:w-[135%]" />
        </div>
        {mounted && (
          <div
            ref={sceneHolder}
            aria-hidden
            className={cn(
              'absolute inset-0 opacity-0 transition-opacity duration-300 ease-out-soft',
              // El suelo del estudio se funde con la página en los bordes (izquierda, derecha y abajo)
              '[mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,#000_9%,#000_91%,transparent),linear-gradient(to_bottom,#000_82%,transparent)]',
              shown && 'opacity-100',
            )}
          >
            <HeroScene progress={progress} className="h-full w-full" />
          </div>
        )}
      </div>
      {painted && webgl === null && <WebGLProbe onResult={setWebgl} />}
      {/* Alto reservado para el botón, que aparece tras comprobar WebGL: así no empuja el texto de debajo */}
      <div className="mt-2 flex min-h-11 flex-wrap items-center gap-2 md:min-h-9 lg:absolute lg:inset-x-4 lg:bottom-4 lg:mt-0 lg:min-h-0">
        {mode !== 'none' && canvas !== 'failed' && (
          <Button
            size="sm"
            icon={shown ? <Pause aria-hidden /> : loading ? <Spinner /> : <Rotate3d aria-hidden />}
            // Sin `disabled` mientras carga: el foco se quedaría en el aire. Se ignora el clic.
            onClick={shown ? stop : loading ? undefined : start}
            aria-busy={loading || undefined}
            aria-controls="portada-visual"
            // En automático, mientras llega la escena no hay nada que detener todavía
            className={cn(mode === 'auto' && !shown && !requested && 'hidden')}
          >
            {shown ? 'Detener animación' : loading ? 'Cargando 3D…' : 'Ver en 3D'}
          </Button>
        )}
        <p className="rounded-control bg-canvas px-2 py-1 text-xs text-fg-muted" aria-live="polite">
          {canvas === 'failed' ? 'No se ha podido cargar el 3D; se queda la imagen.' : 'Modelo genérico, sin marca.'}
        </p>
      </div>
    </div>
  )
}

/** Comprueba si hay WebGL con el hook público de `@/three` y lo comunica. Se monta solo tras la primera pintura. */
function WebGLProbe({ onResult }: { onResult: (ok: boolean) => void }) {
  const ok = useWebGLAvailable()
  useEffect(() => onResult(ok), [ok, onResult])
  return null
}
