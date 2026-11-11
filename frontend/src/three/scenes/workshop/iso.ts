/**
 * Piezas comunes de las maquetas isométricas (taller y garaje) sin JSX: constantes de cámara y luz, encuadres,
 * tamaño del contenedor, Escape para deseleccionar, compilación previa de shaders y enlace con el controlador de
 * tráfico. Los componentes (`IsoParts.tsx`) usan esto.
 */
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { fitOrtho, type FitInset } from '../fit'
import { Traffic, type CarHandle } from './traffic'

const AZIMUTH = THREE.MathUtils.degToRad(45)
const ELEVATION = THREE.MathUtils.degToRad(35)
/** Del objetivo a la cámara (azimut 45°, elevación 35°). */
export const ISO_DIR = new THREE.Vector3(Math.cos(ELEVATION) * Math.sin(AZIMUTH), Math.sin(ELEVATION), Math.cos(ELEVATION) * Math.cos(AZIMUTH))
export const CAM_DIST = 70
/** Sol: de la maqueta hacia la luz (arriba, a la izquierda y al frente): las sombras caen hacia el fondo a la derecha. */
export const SUN_DIR = new THREE.Vector3(-0.5, 1, 0.42).normalize()

export interface CamFocus {
  x: number
  z: number
  zoom: number
}

export interface Bounds {
  x0: number
  x1: number
  z0: number
  z1: number
}

export function boxPoints(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new THREE.Vector3(x, y, z))
  return out
}

export function focusFrom(points: THREE.Vector3[], w: number, h: number, inset: FitInset, pad: number): CamFocus {
  const f = fitOrtho(points, ISO_DIR, w, h, inset, pad)
  return { x: f.target[0], z: f.target[2], zoom: f.zoom }
}

/** Tamaño en px del contenedor (se actualiza al redimensionar). */
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [s, setS] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setS({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) })
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setS({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return s
}

/** Escape deseleccionar y volver al encuadre general (salvo que lo use un diálogo, un menú o un campo de texto). */
export function useEscape(active: boolean, onReset: () => void) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      onReset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onReset])
}

/**
 * Sombras y fotogramas: el mapa de sombras solo se recalcula cuando algo cambia o se mueve (mover la cámara no lo
 * necesita). Devuelve la función que lo pide y pinta un fotograma.
 */
export function useRedraw() {
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const markShadows = useCallback(() => {
    get().gl.shadowMap.needsUpdate = true
    invalidate()
  }, [get, invalidate])
  useEffect(() => {
    markShadows()
  })
  return markShadows
}

/**
 * La entrada de los coches espera a que los shaders estén compilados: si no, en equipos lentos la animación
 * transcurre mientras el hilo está bloqueado compilando y no se ve. Se compila con los coches visibles un instante
 * (compile() solo recorre lo visible) para que sus materiales entren también.
 */
export function useCompileGate(handles: Map<number, CarHandle>): boolean {
  const get = useThree((s) => s.get)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    let alive = true
    const { gl: r, scene, camera } = get()
    const objs = [...handles.values()].map((h) => h.root)
    const was = objs.map((o) => o.visible)
    for (const o of objs) o.visible = true
    const done = () => {
      if (alive) setArmed(true)
    }
    r.compileAsync(scene, camera).then(done, done)
    objs.forEach((o, i) => (o.visible = was[i]))
    return () => {
      alive = false
    }
  }, [get, handles])
  return armed
}

/** Controlador de tráfico ligado al ciclo de vida del lienzo (se limpia al desmontar). */
export function useTrafficController(handles: Map<number, CarHandle>, carriages: Map<number, THREE.Object3D>, redraw: () => void): Traffic {
  const traffic = useMemo(() => new Traffic(handles, carriages, redraw), [handles, carriages, redraw])
  useEffect(() => () => traffic.dispose(), [traffic])
  return traffic
}

/** Medición (solo en desarrollo): `window.__diorama3d` con `renderer.info`, proyección y posición de coches. */
export function useDevHook(name: string, extra: (api: { project: (x: number, y: number, z: number) => { x: number; y: number } }) => Record<string, unknown>) {
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    const project = (x: number, y: number, z: number) => {
      const { camera, size } = get()
      const v = new THREE.Vector3(x, y, z).project(camera)
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height }
    }
    w[name] = { info: get().gl.info, invalidate, project, ...extra({ project }) }
    return () => {
      delete w[name]
    }
  }, [get, invalidate, name, extra])
}
