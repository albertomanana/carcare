/**
 * Taller 3D (chunk diferido): maqueta isométrica «de arcilla», como un juego de estrategia.
 *  - Cámara ortográfica de ángulo fijo (azimut 45°, elevación 35°): se desplaza arrastrando y se acerca con la rueda o
 *    pellizcando, pero no gira; al elegir un coche o un elevador la cámara se acerca con GSAP (0,8 s, `power3.out`).
 *  - Nave: entrada a la derecha → calzada → espera (órdenes sin elevador que no están «Listo») → elevadores numerados
 *    (uno por `bays[i]`) → entrega (órdenes «Listo» sin elevador).
 *  - Coches de bloques redondeados con el color real del vehículo en tono mate. Un coche solo se mueve cuando cambia
 *    el estado real de su orden (o al entrar en escena): recorre la calzada con GSAP por una CatmullRomCurve3.
 *  - Con `prefers-reduced-motion`: sin trayectos, sin entrada y sin vuelos de cámara (posición final directa).
 *  - Rótulos HTML accesibles (un botón por elevador y por coche aparcado) proyectados sobre la escena.
 * Un único <Canvas>, `frameloop="demand"` (no pinta nada en reposo) y sombras que solo se recalculan cuando algo se mueve.
 */
import { OrbitControls, useCursor } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import type { WorkshopSceneProps } from '../types'
import { resolveBody } from '../car/specs'
import { useInView, usePrefersReducedMotion, useThemeTokens, type ThemeTokens } from '../env'
import { toneColor } from '../markers/ZoneMarkerButton'
import { ReleaseOnUnmount, ResumeOnVisible } from './common'
import { canvasDpr } from './dpr'
import { fitOrtho, type FitInset } from './fit'
import { OverlayItem, OverlayLayer, OverlayProjector, type OverlayAnchor } from './overlay'
import { useOverlayStore, type OverlayStore } from './overlayStore'
import { useCanvasLabel } from './useCanvasLabel'
import { clayGlass, clayPaint, clayTrim, getClayCar } from './workshop/clayCar'
import { buildDecals, buildMarkings, buildStatic, dioramaPalette, liftCarriage, POST_X, selectionOutline, type DioramaPalette } from './workshop/diorama'
import { BayLabel, CarLabel } from './workshop/labels'
import {
  assignSpots,
  BAY_D,
  BAY_W,
  clayColor,
  computeFloorLayout,
  driveDuration,
  entrancePose,
  planRoute,
  polyLength,
  POST_H,
  sameSpot,
  SLAB_H,
  slotCapacity,
  spotKey,
  spotPose,
  STALL_D,
  STALL_W,
  WALL_H,
  WALL_T,
  type FloorLayout,
  type P2,
  type Pose,
  type Spot,
} from './workshop/layout'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ───────────────────────── Cámara isométrica ─────────────────────────

const AZIMUTH = THREE.MathUtils.degToRad(45)
const ELEVATION = THREE.MathUtils.degToRad(35)
/** Del objetivo a la cámara. */
const ISO_DIR = new THREE.Vector3(Math.cos(ELEVATION) * Math.sin(AZIMUTH), Math.sin(ELEVATION), Math.cos(ELEVATION) * Math.cos(AZIMUTH))
const CAM_DIST = 70
/** Sol: de la nave hacia la luz (arriba, a la izquierda y al frente): las sombras caen hacia el fondo a la derecha. */
const SUN_DIR = new THREE.Vector3(-0.5, 1, 0.42).normalize()

interface CamFocus {
  x: number
  z: number
  zoom: number
}

function boxPoints(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new THREE.Vector3(x, y, z))
  return out
}

function focusFrom(points: THREE.Vector3[], w: number, h: number, inset: FitInset, pad: number): CamFocus {
  const f = fitOrtho(points, ISO_DIR, w, h, inset, pad)
  return { x: f.target[0], z: f.target[2], zoom: f.zoom }
}

// ───────────────────────── Componente público ─────────────────────────

export default function WorkshopCanvas({
  bays,
  waiting = [],
  selectedBay = null,
  selectedOrderId = null,
  onSelectBay,
  onSelectOrder,
  className,
  focusInset,
}: WorkshopSceneProps) {
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  const overlay = useOverlayStore()
  const size = useSize(wrap)

  const sorted = useMemo(() => [...bays].sort((a, b) => a.number - b.number), [bays])
  const bayKey = sorted.map((b) => b.number).join(',')
  const layout = useMemo(() => computeFloorLayout(bayKey ? bayKey.split(',').map(Number) : []), [bayKey])
  const cap = useMemo(() => slotCapacity(sorted.length), [sorted.length])

  // Plazas estables: se conservan entre actualizaciones (la asignación es pura y se guarda tras pintar; al guardarla
  // se vuelve a calcular y da lo mismo, así que no hay bucle)
  const [prevSlots, setPrevSlots] = useState(() => new Map<number, Spot>())
  const assignment = useMemo(() => assignSpots(sorted, waiting, cap, prevSlots), [sorted, waiting, cap, prevSlots])
  if (!sameSlots(prevSlots, assignment.slots)) setPrevSlots(assignment.slots)
  const cars = assignment.cars

  // Coches que aparecen en esta actualización: entran por la entrada escalonados. Los retardos se guardan con el
  // conjunto de coches conocidos (estado ajustado durante el render) y cada coche solo los lee al montarse.
  const [entry, setEntry] = useState(() => ({ known: new Set<number>(), delays: new Map<number, number>() }))
  const fresh = cars.filter((c) => !entry.known.has(c.order.id))
  if (fresh.length > 0 || entry.known.size !== cars.length) {
    const delays = new Map<number, number>()
    fresh.forEach((c, k) => delays.set(c.order.id, Math.min(1.6, k * 0.14)))
    setEntry({ known: new Set(cars.map((c) => c.order.id)), delays: fresh.length > 0 ? delays : entry.delays })
  }
  const enterDelay = entry.delays

  // Selección: un coche (de cualquier zona) o un elevador
  const selCar = selectedOrderId != null ? (cars.find((c) => c.order.id === selectedOrderId) ?? null) : null
  const focusBay = selCar ? (selCar.spot.kind === 'bay' ? selCar.spot.bay : null) : selectedBay
  const focusStall = selCar && selCar.spot.kind !== 'bay' ? selCar.spot : null
  const hasSelection = selCar != null || selectedBay != null

  // Encuadres (px del lienzo): general y del elemento elegido, dejando libre lo que tapen los paneles de la página
  const [recenter, setRecenter] = useState(0)
  const [userMoved, setUserMoved] = useState(false)
  const insetR = focusInset?.right ?? 0
  const insetT = focusInset?.top ?? 0
  const insetB = focusInset?.bottom ?? 0
  const overview = useMemo<CamFocus | null>(() => {
    if (size.w < 40 || size.h < 40) return null
    const pts = boxPoints(layout.minX - WALL_T, layout.apronX, -SLAB_H, WALL_H, layout.backZ - WALL_T, layout.frontZ)
    return focusFrom(pts, size.w, size.h, { right: insetR, top: insetT + 40, bottom: insetB + 30 }, size.w < 520 ? 10 : 20)
  }, [layout, size.w, size.h, insetR, insetT, insetB])
  const focus = useMemo<CamFocus | null>(() => {
    if (!overview) return null
    const inset = { right: insetR, top: insetT + 70, bottom: insetB + 30 }
    let pts: THREE.Vector3[] | null = null
    if (focusBay != null) {
      const b = layout.bays.find((x) => x.number === focusBay)
      if (b) pts = boxPoints(b.x - BAY_W / 2 - 2, b.x + BAY_W / 2 + 2, 0, POST_H + 0.5, b.z - BAY_D / 2 - 0.5, b.z + BAY_D / 2 + 2.2)
    } else if (focusStall) {
      const s = spotPose(layout, focusStall, 'received')
      if (s) pts = boxPoints(s.x - STALL_W / 2 - 3, s.x + STALL_W / 2 + 3, 0, 2.2, s.z - STALL_D / 2 - 2.4, s.z + STALL_D / 2 + 1.2)
    }
    if (!pts) return overview
    const f = focusFrom(pts, size.w, size.h, inset, 30)
    return { ...f, zoom: Math.min(f.zoom, overview.zoom * 3.2) }
  }, [overview, layout, focusBay, focusStall, size.w, size.h, insetR, insetT, insetB])
  const selKey = `${selCar ? `o${selCar.order.id}` : ''}|${selectedBay ?? ''}|${recenter}`

  const deselect = useCallback(() => {
    onSelectBay?.(null)
    setUserMoved(false)
    setRecenter((r) => r + 1)
  }, [onSelectBay])
  const selectOrder = useCallback(
    (id: number | null) => {
      if (id == null) deselect()
      else onSelectOrder?.(id)
    },
    [deselect, onSelectOrder],
  )
  const selectBay = useCallback(
    (n: number | null) => {
      if (n == null) deselect()
      else onSelectBay?.(n)
    },
    [deselect, onSelectBay],
  )

  // Escape: vuelve al encuadre general (salvo que lo use un diálogo, un menú o un campo)
  const canReset = hasSelection || userMoved
  useEffect(() => {
    if (!canReset) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return
      deselect()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canReset, deselect])

  // Rótulos compactos si los elevadores quedan a menos de ~175 px en pantalla
  const compact = !!focus && focus.zoom * BAY_W * Math.SQRT1_2 < 175

  const occupied = sorted.filter((b) => b.work_order).length
  const nPark = cars.filter((c) => c.spot.kind === 'park').length + assignment.overflow.park
  const nReady = cars.filter((c) => c.spot.kind === 'ready').length + assignment.overflow.ready
  const label =
    `Taller 3D, maqueta isométrica: ${sorted.length} ${sorted.length === 1 ? 'elevador' : 'elevadores'} (${occupied} ${occupied === 1 ? 'ocupado' : 'ocupados'}, ` +
    `${sorted.length - occupied} ${sorted.length - occupied === 1 ? 'libre' : 'libres'})` +
    (nPark ? `, ${nPark} ${nPark === 1 ? 'orden' : 'órdenes'} en espera` : '') +
    (nReady ? `, ${nReady} ${nReady === 1 ? 'lista' : 'listas'} para entregar` : '')

  const statuses = useMemo(() => {
    const set = new Set<WorkOrderStatus>()
    for (const c of cars) set.add(c.order.status)
    return (Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).filter((s) => set.has(s))
  }, [cars])

  const parked = cars.filter((c) => c.spot.kind !== 'bay')
  const ids = useMemo(() => [...sorted.map((b) => `bay-${b.number}`), ...parked.map((c) => `car-${c.order.id}`)], [sorted, parked])
  const inset = useMemo(() => ({ right: insetR, top: insetT, bottom: insetB }), [insetR, insetT, insetB])

  return (
    <div ref={wrap} className={cx('relative isolate overflow-hidden', className)}>
      <Canvas
        orthographic
        shadows="percentage"
        frameloop={inView ? 'demand' : 'never'}
        dpr={canvasDpr()}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [CAM_DIST * ISO_DIR.x, CAM_DIST * ISO_DIR.y, CAM_DIST * ISO_DIR.z], zoom: 20, near: 0.1, far: 400 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping
          gl.toneMappingExposure = 1
          gl.shadowMap.autoUpdate = false
          gl.shadowMap.needsUpdate = true
        }}
        onPointerMissed={(e) => {
          if (e.type === 'click' && (hasSelection || userMoved)) deselect()
        }}
        style={{ touchAction: 'none', cursor: 'grab' }}
      >
        <ResumeOnVisible visible={inView} />
        {focus && overview && (
          <WorkshopWorld
            bays={sorted}
            cars={cars}
            layout={layout}
            tokens={tokens}
            reduced={reduced}
            enterDelay={enterDelay}
            focusBay={focusBay}
            focusStall={focusStall}
            selectedOrderId={selCar?.order.id ?? null}
            onSelectBay={selectBay}
            onSelectOrder={selectOrder}
            label={label}
            overlay={overlay}
            focus={focus}
            overview={overview}
            selKey={selKey}
            onUserMove={() => setUserMoved(true)}
            inset={inset}
          />
        )}
      </Canvas>

      <OverlayLayer store={overlay} ids={ids} label="Elevadores y coches del taller">
        {sorted.map((b) => (
          <OverlayItem key={b.number} store={overlay} id={`bay-${b.number}`}>
            <BayLabel bay={b} selected={focusBay === b.number} compact={compact} onSelect={selectBay} />
          </OverlayItem>
        ))}
        {parked.map((c) => (
          <OverlayItem key={c.order.id} store={overlay} id={`car-${c.order.id}`}>
            <CarLabel order={c.order} zone={c.spot.kind === 'ready' ? 'ready' : 'park'} selected={selCar?.order.id === c.order.id} compact={compact} onSelect={selectOrder} />
          </OverlayItem>
        ))}
      </OverlayLayer>

      <div className="pointer-events-none absolute left-3 flex items-end gap-2" style={{ bottom: insetB + 8, right: insetR + 12 }}>
        <p className="mr-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/80 px-2 py-1 text-[11px] text-fg-muted backdrop-blur-sm">
          {statuses.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className={cx('size-2 rounded-full', TONE_CLASSES[WORK_ORDER_STATUS[s].tone].dot)} aria-hidden />
              {WORK_ORDER_STATUS[s].label}
            </span>
          ))}
          {assignment.overflow.park > 0 && <span className="text-fg-subtle">· Espera: se ven {cap.park} de {cap.park + assignment.overflow.park}</span>}
          {assignment.overflow.ready > 0 && <span className="text-fg-subtle">· Entrega: se ven {cap.ready} de {cap.ready + assignment.overflow.ready}</span>}
          <span className="hidden text-fg-subtle sm:inline">· Arrastra para desplazarte; rueda o pellizco para acercar</span>
        </p>
        {canReset && (
          <button
            type="button"
            onClick={deselect}
            className="pointer-events-auto shrink-0 rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-md hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ver toda la nave
          </button>
        )}
      </div>
    </div>
  )
}

function sameSlots(a: Map<number, Spot>, b: Map<number, Spot>) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (!sameSpot(v, b.get(k) ?? null)) return false
  return true
}

function useSize(ref: React.RefObject<HTMLElement | null>) {
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

// ───────────────────────── Escena ─────────────────────────

interface WorldProps {
  bays: Bay[]
  cars: { order: WorkOrder; spot: Spot }[]
  layout: FloorLayout
  tokens: ThemeTokens
  reduced: boolean
  enterDelay: Map<number, number>
  focusBay: number | null
  focusStall: Spot | null
  selectedOrderId: number | null
  onSelectBay: (n: number | null) => void
  onSelectOrder: (id: number | null) => void
  label: string
  overlay: OverlayStore
  focus: CamFocus
  overview: CamFocus
  selKey: string
  onUserMove: () => void
  inset: { right: number; top: number; bottom: number }
}

/** Material de arcilla con color por vértice (nave, marcas, elevadores): uno para toda la escena. */
let vertexClay: THREE.MeshStandardMaterial | null = null
function clayVertex() {
  vertexClay ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 })
  return vertexClay
}

function WorkshopWorld({
  bays,
  cars,
  layout,
  tokens,
  reduced,
  enterDelay,
  focusBay,
  focusStall,
  selectedOrderId,
  onSelectBay,
  onSelectOrder,
  label,
  overlay,
  focus,
  overview,
  selKey,
  onUserMove,
  inset,
}: WorldProps) {
  useCanvasLabel(label)
  const pal = useMemo(() => dioramaPalette(tokens), [tokens])
  const get = useThree((s) => s.get)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  // Sombras: el mapa solo se recalcula cuando algo cambia o se mueve (mover la cámara no lo necesita)
  const markShadows = useCallback(() => {
    get().gl.shadowMap.needsUpdate = true
    invalidate()
  }, [get, invalidate])
  useEffect(() => {
    markShadows()
  })



  const carriages = useMemo(() => new Map<number, THREE.Object3D>(), [])
  const carObjects = useMemo(() => new Map<number, THREE.Object3D>(), [])
  // La entrada de los coches espera a que los shaders estén compilados: si no, en equipos lentos la animación
  // transcurre mientras el hilo está bloqueado compilando y no se ve. Se compila con los coches visibles un instante
  // (compile() solo recorre lo visible) para que sus materiales entren también.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    let alive = true
    const { gl: r, scene, camera } = get()
    const objs = [...carObjects.values()]
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
  }, [get, carObjects])

  // Medición (solo en desarrollo): window.__workshop3d.info.render → draw calls y triángulos del último fotograma
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __workshop3d?: unknown }
    // project(x, y, z) → px del lienzo; car(id) → px del centro del coche (para apuntar en las pruebas)
    const project = (x: number, y: number, z: number) => {
      const { camera, size } = get()
      const v = new THREE.Vector3(x, y, z).project(camera)
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height }
    }
    const car = (id: number) => {
      const o = carObjects.get(id)
      if (!o) return null
      const p = o.getWorldPosition(new THREE.Vector3())
      return project(p.x, p.y + 0.35, p.z)
    }
    w.__workshop3d = { info: gl.info, invalidate, shadows: markShadows, project, car, layout }
    return () => {
      delete w.__workshop3d
    }
  }, [gl, invalidate, markShadows, get, carObjects, layout])

  const [hover, setHover] = useState<string | null>(null)
  useCursor(!!hover, 'pointer', '', gl.domElement)

  const anchors: OverlayAnchor[] = useMemo(() => {
    const list: OverlayAnchor[] = layout.bays.map((b) => {
      const bay = bays.find((x) => x.number === b.number)
      const sel = focusBay === b.number
      return {
        id: `bay-${b.number}`,
        position: [b.x - POST_X * 0.2, POST_H + 0.45, b.z],
        pivot: 'bottom',
        priority: sel ? 10 : bay?.work_order ? 3 : 2,
        fixed: sel,
        dim: (focusBay != null || focusStall != null) && !sel,
      }
    })
    for (const c of cars) {
      if (c.spot.kind === 'bay') continue
      const id = c.order.id
      const h = getClayCar(resolveBody(c.order.vehicle.body_type)).size.height
      const sel = selectedOrderId === id
      list.push({
        id: `car-${id}`,
        position: [0, h + 0.3, 0],
        track: () => carObjects.get(id),
        pivot: 'bottom',
        priority: sel ? 9 : 1,
        fixed: sel,
        dim: (focusBay != null || focusStall != null) && !sel,
      })
    }
    return list
  }, [layout, bays, cars, focusBay, focusStall, selectedOrderId, carObjects])

  const selStallPose = focusStall ? spotPose(layout, focusStall, 'received') : null
  const selBayPos = focusBay != null ? layout.bays.find((b) => b.number === focusBay) : null

  return (
    <>
      <color attach="background" args={[pal.background]} />
      <Lights layout={layout} pal={pal} small={gl.domElement.clientWidth < 640} />
      <Diorama layout={layout} pal={pal} />
      {layout.bays.map((b) => {
        const bay = bays.find((x) => x.number === b.number)
        const st = bay?.work_order ? WORK_ORDER_STATUS[bay.work_order.status] : null
        return (
          <Lift
            key={b.number}
            number={b.number}
            x={b.x}
            z={b.z}
            pal={pal}
            lamp={st ? toneColor(st.tone, tokens) : pal.postDark}
            register={(o) => {
              if (o) carriages.set(b.number, o)
              else carriages.delete(b.number)
            }}
            onSelect={() => onSelectBay(focusBay === b.number ? null : b.number)}
            onHover={(on) => setHover(on ? `bay-${b.number}` : null)}
          />
        )
      })}
      {cars.map((c) => (
        <ClayCarActor
          key={c.order.id}
          order={c.order}
          spot={c.spot}
          layout={layout}
          pal={pal}
          reduced={reduced}
          armed={armed}
          enterDelay={enterDelay.get(c.order.id) ?? 0}
          carriages={carriages}
          register={(o) => {
            if (o) carObjects.set(c.order.id, o)
            else carObjects.delete(c.order.id)
          }}
          markShadows={markShadows}
          onSelect={() => onSelectOrder(selectedOrderId === c.order.id ? null : c.order.id)}
          onHover={(on) => setHover(on ? `car-${c.order.id}` : null)}
        />
      ))}
      {selBayPos && <SelectionOutline kind="bay" x={selBayPos.x} z={selBayPos.z} color={tokens.accent} />}
      {selStallPose && <SelectionOutline kind="stall" x={selStallPose.x} z={selStallPose.z} color={tokens.accent} />}
      <IsoRig focus={focus} overview={overview} selKey={selKey} reduced={reduced} layout={layout} onUserMove={onUserMove} />
      <OverlayProjector store={overlay} anchors={anchors} inset={inset} />
      <ReleaseOnUnmount />
    </>
  )
}

// ───────────────────────── Luz de estudio ─────────────────────────

function Lights({ layout, pal, small }: { layout: FloorLayout; pal: DioramaPalette; small: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const center = useMemo(
    () => new THREE.Vector3((layout.minX + layout.apronX) / 2, 0, (layout.backZ + layout.frontZ) / 2),
    [layout],
  )
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)

  useLayoutEffect(() => {
    const l = light.current
    if (!l) return
    l.position.copy(center).addScaledVector(SUN_DIR, 40)
    target.position.copy(center)
    target.updateMatrixWorld()
    l.target = target
    // Cámara de sombra ajustada a la nave (y a la sombra de la losa sobre la mesa), proyectando sus esquinas
    const cam = new THREE.OrthographicCamera()
    cam.position.copy(l.position)
    cam.lookAt(center)
    cam.updateMatrixWorld()
    const inv = cam.matrixWorldInverse
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    let z0 = Infinity
    let z1 = -Infinity
    for (const p of boxPoints(layout.minX - 2, layout.apronX + 3, -SLAB_H, WALL_H + 1.6, layout.backZ - 3, layout.frontZ + 1)) {
      p.applyMatrix4(inv)
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      y0 = Math.min(y0, p.y)
      y1 = Math.max(y1, p.y)
      z0 = Math.min(z0, p.z)
      z1 = Math.max(z1, p.z)
    }
    const sc = l.shadow.camera
    sc.left = x0
    sc.right = x1
    sc.bottom = y0
    sc.top = y1
    sc.near = Math.max(0.5, -z1 - 1)
    sc.far = -z0 + 1
    sc.updateProjectionMatrix()
    l.shadow.needsUpdate = true
    get().gl.shadowMap.needsUpdate = true
    invalidate()
  }, [center, layout, target, get, invalidate])

  const map = small ? 1024 : 2048
  return (
    <>
      <hemisphereLight args={[pal.hemiSky, pal.hemiGround, pal.hemi]} />
      <directionalLight
        ref={light}
        color="#fff5e8"
        intensity={pal.sun}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <primitive object={target} />
    </>
  )
}

// ───────────────────────── Nave ─────────────────────────

function Diorama({ layout, pal }: { layout: FloorLayout; pal: DioramaPalette }) {
  const statics = useMemo(() => buildStatic(layout, pal), [layout, pal])
  const marks = useMemo(() => buildMarkings(layout, pal), [layout, pal])
  const [fontTick, setFontTick] = useState(0)
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts || fonts.status === 'loaded') return
    let alive = true
    void fonts.ready.then(() => alive && setFontTick((t) => t + 1))
    return () => {
      alive = false
    }
  }, [])
  const decals = useMemo(() => buildDecals(layout, pal.decal), [layout, pal.decal, fontTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const decalMat = useMemo(
    () =>
      decals
        ? new THREE.MeshStandardMaterial({ map: decals.texture, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })
        : null,
    [decals],
  )
  const catcher = useMemo(() => new THREE.ShadowMaterial({ opacity: pal.shadowOpacity, transparent: true, depthWrite: false }), [pal.shadowOpacity])
  useEffect(() => () => statics.dispose(), [statics])
  useEffect(() => () => marks.dispose(), [marks])
  useEffect(
    () => () => {
      decals?.geometry.dispose()
      decals?.texture.dispose()
      decalMat?.dispose()
    },
    [decals, decalMat],
  )
  useEffect(() => () => catcher.dispose(), [catcher])

  const w = layout.apronX - layout.minX
  const d = layout.frontZ - layout.backZ
  return (
    <group>
      {/* Mesa: solo recoge la sombra de la maqueta (el fondo es el color de la escena) */}
      <mesh rotation-x={-Math.PI / 2} position={[(layout.minX + layout.apronX) / 2, -SLAB_H - 0.002, (layout.backZ + layout.frontZ) / 2]} receiveShadow material={catcher}>
        <planeGeometry args={[w + 30, d + 30]} />
      </mesh>
      <mesh geometry={statics} material={clayVertex()} castShadow receiveShadow />
      <mesh geometry={marks} material={clayVertex()} receiveShadow />
      {decals && decalMat && <mesh geometry={decals.geometry} material={decalMat} receiveShadow renderOrder={1} />}
    </group>
  )
}

// ───────────────────────── Elevador ─────────────────────────

const lampGeo = new THREE.SphereGeometry(0.13, 16, 10)
const lampCache = new Map<string, THREE.MeshStandardMaterial>()
function lampMaterial(color: string) {
  let m = lampCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.5, metalness: 0 })
    lampCache.set(color, m)
  }
  return m
}
const PROXY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const unitBox = new THREE.BoxGeometry(1, 1, 1)

function Lift({
  number,
  x,
  z,
  pal,
  lamp,
  register,
  onSelect,
  onHover,
}: {
  number: number
  x: number
  z: number
  pal: DioramaPalette
  lamp: string
  register: (o: THREE.Object3D | null) => void
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const carriage = liftCarriage(pal)
  return (
    <group>
      <mesh ref={register} name={`elevador-${number}`} geometry={carriage} material={clayVertex()} position={[x, 0, z]} castShadow receiveShadow />
      <mesh geometry={lampGeo} material={lampMaterial(lamp)} position={[x - POST_X, POST_H + 0.22, z]} />
      {/* Zona de clic (invisible): la plaza del elevador */}
      <mesh
        geometry={unitBox}
        material={PROXY_MAT}
        visible={false}
        position={[x, 0.9, z]}
        scale={[BAY_W - 0.4, 1.8, BAY_D - 0.4]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (e.delta > 6) return
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(true)
        }}
        onPointerOut={() => onHover(false)}
      />
    </group>
  )
}

const outlineGeos: Partial<Record<'bay' | 'stall', THREE.BufferGeometry>> = {}
function SelectionOutline({ kind, x, z, color }: { kind: 'bay' | 'stall'; x: number; z: number; color: string }) {
  const geo = (outlineGeos[kind] ??= selectionOutline(kind))
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }), [color])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geo} material={mat} position={[x, 0, z]} renderOrder={2} />
}

// ───────────────────────── Coche ─────────────────────────

let blobTex: THREE.Texture | null = null
function blobTexture(): THREE.Texture | null {
  if (blobTex || typeof document === 'undefined') return blobTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.6)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.3)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  blobTex = new THREE.CanvasTexture(c)
  return blobTex
}
let blobMat: THREE.MeshBasicMaterial | null = null
function blobMaterial() {
  blobMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.55 })
  return blobMat
}
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

const _p = new THREE.Vector3()
const _t = new THREE.Vector3()

function curveOf(pts: P2[]) {
  return new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal',
  )
}

function ClayCarActor({
  order,
  spot,
  layout,
  pal,
  reduced,
  armed,
  enterDelay,
  carriages,
  register,
  markShadows,
  onSelect,
  onHover,
}: {
  order: WorkOrder
  spot: Spot
  layout: FloorLayout
  pal: DioramaPalette
  reduced: boolean
  /** false hasta que la escena está compilada: los coches que entran esperan ocultos en la entrada. */
  armed: boolean
  enterDelay: number
  carriages: Map<number, THREE.Object3D>
  register: (o: THREE.Object3D | null) => void
  markShadows: () => void
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const body = resolveBody(order.vehicle.body_type)
  const geo = getClayCar(body)
  const paint = clayPaint(clayColor(order.vehicle.color_hex, order.vehicle.id))
  const glass = clayGlass(pal.glass)
  const group = useRef<THREE.Group>(null)
  const blob = useRef<THREE.Mesh>(null)
  /** Pose actual, plaza en la que está parado (null: de camino) y elevador cuyo carro le acompaña en altura. */
  const pose = useRef<Pose | null>(null)
  const at = useRef<Spot | 'entrance' | null>(null)
  const bayAt = useRef<number | null>(null)

  const target = spotPose(layout, spot, order.status)
  const tx = target?.x ?? 0
  const tz = target?.z ?? 0
  const ty = target?.y ?? 0
  const th = target?.heading ?? 0
  const key = `${spotKey(spot)}|${tx.toFixed(2)}|${tz.toFixed(2)}|${ty}`

  useLayoutEffect(() => {
    const g = group.current
    if (!g || !target) return
    const final: Pose = { x: tx, z: tz, y: ty, heading: th }
    const apply = (p: Pose) => {
      g.position.set(p.x, p.y, p.z)
      g.rotation.y = p.heading
      pose.current = p
      const c = bayAt.current != null ? carriages.get(bayAt.current) : null
      if (c) c.position.y = p.y
      if (blob.current) {
        blob.current.position.y = 0.012 - p.y
        ;(blob.current.material as THREE.MeshBasicMaterial).opacity = 0.55
      }
      markShadows()
    }
    const toSpot = spot

    if (reduced) {
      // Movimiento reducido: posición final directa (también al entrar)
      if (bayAt.current != null && (toSpot.kind !== 'bay' || toSpot.bay !== bayAt.current)) {
        const old = carriages.get(bayAt.current)
        if (old) old.position.y = 0
      }
      bayAt.current = toSpot.kind === 'bay' ? toSpot.bay : null
      at.current = toSpot
      g.visible = true
      g.scale.setScalar(1)
      apply(final)
      return
    }

    if (pose.current == null || at.current === 'entrance') {
      // Primera vez: aparece en la entrada y espera su turno
      bayAt.current = null
      at.current = 'entrance'
      g.visible = false
      apply(entrancePose(layout))
    }
    const cur = pose.current!
    const from = at.current
    const entering = from === 'entrance'
    if (entering && !armed) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: entering ? enterDelay : 0 })
      if (from && from !== 'entrance' && sameSpot(from, toSpot)) {
        // Misma plaza: solo cambia la altura del elevador
        if (Math.abs(cur.y - final.y) > 0.001) {
          const h = { y: cur.y }
          tl.to(h, { y: final.y, duration: 0.8, ease: 'power2.inOut', onUpdate: () => apply({ ...pose.current!, y: h.y }) })
        }
        return
      }
      if (entering) {
        tl.call(() => {
          g.visible = true
          markShadows()
        })
        tl.fromTo(g.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2)', onUpdate: markShadows })
      }
      if (cur.y > 0.001) {
        const h = { y: cur.y }
        tl.to(h, { y: 0, duration: 0.55, ease: 'power2.inOut', onUpdate: () => apply({ ...pose.current!, y: h.y }) })
      }
      tl.call(() => {
        at.current = null
        bayAt.current = null
      })
      const route = planRoute(layout, { ...cur, y: 0 }, from, toSpot, final)
      const follow = (curve: THREE.CatmullRomCurve3, u: number, backwards: boolean) => {
        curve.getPointAt(u, _p)
        curve.getTangentAt(u, _t)
        const heading = backwards ? Math.atan2(-_t.x, -_t.z) : Math.atan2(_t.x, _t.z)
        apply({ x: _p.x, z: _p.z, y: 0, heading })
      }
      if (route.reverse) {
        const curve = curveOf(route.reverse)
        const prog = { u: 0 }
        tl.to(prog, { u: 1, duration: Math.min(1.4, Math.max(0.8, polyLength(route.reverse) / 3.5)), ease: 'power1.inOut', onUpdate: () => follow(curve, prog.u, true) })
      }
      const curve = curveOf(route.forward)
      const prog = { u: 0 }
      tl.to(
        prog,
        { u: 1, duration: driveDuration(polyLength(route.forward)), ease: 'power2.inOut', onUpdate: () => follow(curve, prog.u, false) },
        '>',
      )
      tl.call(() => {
        at.current = toSpot
        bayAt.current = toSpot.kind === 'bay' ? toSpot.bay : null
        apply({ ...final, y: 0 })
      })
      if (final.y > 0.001) {
        const h = { y: 0 }
        tl.to(h, { y: final.y, duration: 0.75, ease: 'power2.out', onUpdate: () => apply({ ...pose.current!, y: h.y }) })
      }
    })
    return () => ctx.kill()
    // la clave resume la plaza y la altura de destino; el resto se lee de refs
  }, [key, reduced, armed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al desaparecer (orden entregada o cancelada), el elevador que ocupaba vuelve al suelo
  useEffect(
    () => () => {
      const c = bayAt.current != null ? carriages.get(bayAt.current) : null
      if (c) c.position.y = 0
    },
    [carriages],
  )

  const { length, width, height } = geo.size
  return (
    <group
      ref={(o) => {
        group.current = o
        register(o)
      }}
      name={`coche-${order.id}`}
    >
      <mesh ref={blob} geometry={blobGeo} material={blobMaterial()} scale={[width * 1.5, 1, length * 1.22]} position={[0, 0.012, 0]} renderOrder={-1} />
      <mesh geometry={geo.paint} material={paint} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={glass} castShadow />
      {/* ruedas y pilotos sin sombra propia (la mancha de oclusión ya asienta el coche): 13 draw calls menos en la pasada de sombras */}
      <mesh geometry={geo.trim} material={clayTrim()} receiveShadow />
      {/* Zona de clic (invisible) */}
      <mesh
        geometry={unitBox}
        material={PROXY_MAT}
        visible={false}
        position={[0, height / 2, 0]}
        scale={[width + 0.2, height + 0.2, length + 0.2]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (e.delta > 6) return
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(true)
        }}
        onPointerOut={() => onHover(false)}
      />
    </group>
  )
}

// ───────────────────────── Cámara ─────────────────────────

function IsoRig({
  focus,
  overview,
  selKey,
  reduced,
  layout,
  onUserMove,
}: {
  focus: CamFocus
  overview: CamFocus
  selKey: string
  reduced: boolean
  layout: FloorLayout
  onUserMove: () => void
}) {
  const controls = useRef<OrbitControlsImpl>(null)
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const lastSel = useRef<string | null>(null)
  const tween = useRef<gsap.core.Tween | null>(null)

  const fx = Math.round(focus.x * 100) / 100
  const fz = Math.round(focus.z * 100) / 100
  const fzoom = Math.round(focus.zoom * 100) / 100

  useLayoutEffect(() => {
    const c = controls.current
    if (!c) return
    const camera = get().camera as THREE.OrthographicCamera
    const apply = (x: number, z: number, zoom: number) => {
      c.target.set(x, 0, z)
      camera.position.set(x + ISO_DIR.x * CAM_DIST, ISO_DIR.y * CAM_DIST, z + ISO_DIR.z * CAM_DIST)
      camera.zoom = zoom
      camera.updateProjectionMatrix()
      c.update()
      invalidate()
    }
    // Vuela si cambia la selección o si ya había un vuelo en marcha (p. ej. el panel de la página cambia el margen
    // justo después de elegir): se reencamina sin saltos. Un cambio de tamaño en reposo se aplica directamente.
    const flying = !!tween.current?.isActive()
    tween.current?.kill()
    const animate = !reduced && lastSel.current !== null && (lastSel.current !== selKey || flying)
    lastSel.current = selKey
    if (!animate) {
      apply(fx, fz, fzoom)
      return
    }
    const s = { x: c.target.x, z: c.target.z, zoom: camera.zoom }
    tween.current = gsap.to(s, { x: fx, z: fz, zoom: fzoom, duration: 0.8, ease: 'power3.out', onUpdate: () => apply(s.x, s.z, s.zoom) })
    return () => {
      tween.current?.kill()
    }
  }, [fx, fz, fzoom, selKey, reduced, get, invalidate])

  // Paneo acotado a la maqueta (con algo de holgura)
  const bounds = useMemo(
    () => ({ x0: layout.minX - 6, x1: layout.apronX + 6, z0: layout.backZ - 6, z1: layout.frontZ + 8 }),
    [layout],
  )
  const onChange = () => {
    const c = controls.current
    if (!c) return
    const t = c.target
    const nx = Math.min(bounds.x1, Math.max(bounds.x0, t.x))
    const nz = Math.min(bounds.z1, Math.max(bounds.z0, t.z))
    if (nx !== t.x || nz !== t.z) {
      const camera = get().camera
      camera.position.x += nx - t.x
      camera.position.z += nz - t.z
      t.x = nx
      t.z = nz
    }
  }

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enablePan
      screenSpacePanning={false}
      enableZoom
      enableDamping
      dampingFactor={0.14}
      zoomSpeed={0.9}
      minZoom={overview.zoom * 0.7}
      maxZoom={overview.zoom * 5}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
      onStart={() => {
        tween.current?.kill()
        onUserMove()
      }}
      onChange={onChange}
    />
  )
}
