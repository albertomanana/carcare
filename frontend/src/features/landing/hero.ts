/**
 * Lógica del héroe de la portada (tarea 36), sin three.js: decide si el coche 3D se monta solo, cuándo y con qué
 * progreso de scroll. La escena (`HeroScene` de `@/three`) es un chunk diferido: hasta que esto no dice "monta",
 * la portada no descarga three.js (R11).
 */
import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react'

/**
 * 'auto': imagen fija primero y, en reposo, el 3D encima con un fundido.
 * 'manual': se queda la imagen y hay un botón "Ver en 3D" (móvil, tableta, movimiento reducido, ahorro de datos o
 * porque la persona detuvo la animación).
 * 'none': sin WebGL. Solo la imagen, sin botón.
 */
export type HeroMode = 'auto' | 'manual' | 'none'

export interface HeroEnv {
  webgl: boolean
  reducedMotion: boolean
  /** Pantalla ancha con ratón o trackpad (ver DESKTOP_QUERY). */
  desktop: boolean
  /** "Ahorro de datos" activado o red lenta (2G/3G) según `navigator.connection`. */
  saveData: boolean
  /** La persona pulsó "Detener animación" en una visita anterior. */
  stopped: boolean
}

export function heroMode({ webgl, reducedMotion, desktop, saveData, stopped }: HeroEnv): HeroMode {
  if (!webgl) return 'none'
  if (reducedMotion || !desktop || saveData || stopped) return 'manual'
  return 'auto'
}

/** Escritorio: ≥ 1024 px con puntero fino. En móvil y tableta el 3D (≈ 270 KB comprimidos y la GPU) es opcional. */
export const DESKTOP_QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Alto de la cabecera fija de la portada (h-16). */
export const HEADER_PX = 64

/**
 * Progreso 0..1 del recorrido de una sección con un escenario fijo (`sticky`) de alto `viewport - header`:
 * 0 con la sección arriba del todo y 1 cuando su final llega al borde inferior.
 */
export function scrollProgress(top: number, height: number, viewport: number, header = HEADER_PX): number {
  const stage = Math.max(1, viewport - header)
  const total = height - stage
  if (!(total > 0)) return 0
  const p = (header - top) / total
  return Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0))
}

/** true si el navegador pide ahorrar datos o la red es lenta. Sin la API (Safari, Firefox) ⇒ false. */
export function prefersSavingData(): boolean {
  if (typeof navigator === 'undefined') return false
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (!c) return false
  return !!c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? '')
}

/**
 * true a partir del segundo fotograma tras montar, cuando el navegador ya ha pintado al menos una vez. Sirve para
 * dejar fuera de la primera pintura lo que puede bloquear el hilo principal: crear un contexto WebGL para saber si
 * hay 3D tarda unos ms con la GPU libre, pero más de 1 s si está ocupada (visto al medir la portada el 03/11; esa
 * cifra no quedó guardada en el informe).
 * En una pestaña oculta no hay fotogramas: espera a que se vea.
 */
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])
  return ready
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * true cuando ya se puede montar el 3D sin estorbar a la primera pintura: la imagen del héroe ha cargado (o ha
 * fallado), el hilo principal está en reposo (`requestIdleCallback`, como mucho 3 s; sin la API, 1 s) y la pestaña
 * está visible. Si la pestaña está oculta, espera a que vuelva.
 */
export function useIdleAfterImage(imageHolder: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!enabled || ready) return
    let cancelled = false
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const img = imageHolder.current?.querySelector('img') ?? null

    const go = () => {
      if (cancelled) return
      if (document.hidden) document.addEventListener('visibilitychange', onVisible)
      else setReady(true)
    }
    const onVisible = () => {
      if (document.hidden) return
      document.removeEventListener('visibilitychange', onVisible)
      schedule()
    }
    const schedule = () => {
      if (cancelled) return
      if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(go, { timeout: 3000 })
      else timer = setTimeout(go, 1000)
    }

    if (!img || img.complete) schedule()
    else {
      img.addEventListener('load', schedule, { once: true })
      img.addEventListener('error', schedule, { once: true })
    }
    return () => {
      cancelled = true
      img?.removeEventListener('load', schedule)
      img?.removeEventListener('error', schedule)
      document.removeEventListener('visibilitychange', onVisible)
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId)
      if (timer) clearTimeout(timer)
    }
  }, [imageHolder, enabled, ready])
  return ready
}

/**
 * Estado del lienzo montado dentro de `holder`: 'shown' cuando hay un <canvas> y ya ha pasado un par de fotogramas
 * (el primero ya está pintado, así el fundido no enseña un lienzo vacío); 'failed' si a los `timeoutMs` no ha
 * aparecido (sin conexión, error de WebGL: el envoltorio de `@/three` enseña entonces su respaldo).
 */
export function useCanvasState(holder: RefObject<HTMLElement | null>, active: boolean, timeoutMs = 20000): 'idle' | 'loading' | 'shown' | 'failed' {
  const [state, setState] = useState<{ for: boolean; value: 'loading' | 'shown' | 'failed' }>({ for: false, value: 'loading' })
  useEffect(() => {
    const el = holder.current
    if (!active || !el) return
    let raf1 = 0
    let raf2 = 0
    let seen = false
    const check = () => {
      const canvas = el.querySelector('canvas')
      if (canvas && !seen) {
        seen = true
        raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => setState({ for: true, value: 'shown' }))
        })
      } else if (!canvas && seen) {
        // El lienzo ha desaparecido (error dentro de la escena): vuelve la imagen
        seen = false
        setState({ for: true, value: 'failed' })
      }
    }
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true, subtree: true })
    check()
    const timer = setTimeout(() => {
      if (!seen) setState({ for: true, value: 'failed' })
    }, timeoutMs)
    return () => {
      mo.disconnect()
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(timer)
      setState({ for: false, value: 'loading' })
    }
  }, [holder, active, timeoutMs])
  if (!active) return 'idle'
  return state.for ? state.value : 'loading'
}

/** Progreso del scroll a lo largo de `section` (ver `scrollProgress`). Solo escucha el scroll mientras `active`. */
export function useScrollProgress(section: RefObject<HTMLElement | null>, active: boolean): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!active) return
    let frame = 0
    const update = () => {
      frame = 0
      const el = section.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setProgress(scrollProgress(r.top, r.height, window.innerHeight))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [section, active])
  return progress
}
