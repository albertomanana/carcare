/**
 * Taller 3D (chunk diferido): maqueta isométrica «de arcilla», como un juego de estrategia.
 *  - Cámara ortográfica de ángulo fijo (azimut 45°, elevación 35°): se desplaza arrastrando y se acerca con la rueda o
 *    pellizcando, pero no gira; al elegir un coche o un elevador la cámara se acerca con GSAP (0,8 s, `power3.out`).
 *  - Nave: entrada a la derecha → calzada de dos carriles → espera (órdenes sin elevador que no están «Listo») →
 *    elevadores numerados (uno por `bays[i]`) → entrega (órdenes «Listo» sin elevador).
 *  - Coches con la carrocería real de cada vehículo y su color real en tono mate (roughness 0,7, metalness 0,1, sin
 *    reflejos). Un coche solo se mueve cuando cambia el estado real de su orden (o al entrar en escena): el controlador
 *    de tráfico (`workshop/traffic.ts`) planifica las salidas para que nunca se toquen y las lleva con GSAP.
 *  - Con `prefers-reduced-motion`: sin trayectos, sin entrada y sin vuelos de cámara (posición final directa).
 *  - Rótulos HTML accesibles (un botón por elevador y por coche aparcado) proyectados sobre la escena.
 * Un único <Canvas>, `frameloop="demand"` (no pinta nada en reposo) y sombras que solo se recalculan cuando algo se mueve.
 */
import { useCursor } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import type { WorkshopSceneProps } from '../types'
import { resolveBody } from '../car/specs'
import { useInView, usePrefersReducedMotion, useThemeTokens, type ThemeTokens } from '../env'
import { toneColor } from '../markers/ZoneMarkerButton'
import { ReleaseOnUnmount, ResumeOnVisible } from './common'
import { canvasDpr } from './dpr'
import { OverlayItem, OverlayLayer, OverlayProjector, type OverlayAnchor } from './overlay'
import { useOverlayStore, type OverlayStore } from './overlayStore'
import { useCanvasLabel } from './useCanvasLabel'
import { carDims, getClayModel } from './workshop/clayReal'
import { buildDecals, buildMarkings, buildStatic, dioramaPalette, liftCarriage, selectionOutline, type DioramaPalette } from './workshop/diorama'
import { boxPoints, CAM_DIST, focusFrom, ISO_DIR, useCompileGate, useDevHook, useEscape, useRedraw, useSize, useTrafficController, type CamFocus } from './workshop/iso'
import { clayVertex } from './workshop/clayCar'
import { CarMesh, IsoRig, StudioLights } from './workshop/IsoParts'
import { BayLabel, CarLabel } from './workshop/labels'
import {
  assignSpots,
  BAY_D,
  BAY_W,
  clayColor,
  computeFloorLayout,
  entrancePose,
  floorObstacles,
  planRoute,
  POST_H,
  POST_X,
  sameSpot,
  SLAB_H,
  slotCapacity,
  spotFromKey,
  spotKey,
  spotPose,
  STALL_D,
  STALL_W,
  WALL_H,
  WALL_T,
  type FloorLayout,
  type Spot,
} from './workshop/layout'
import type { CarHandle, Desired, TrafficWorld } from './workshop/traffic'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

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
    // La nave entera (el borde de la losa y el extremo de la explanada incluidos) en el hueco que dejan los paneles; solo
    // se reserva arriba lo que sobresalen los rótulos de los elevadores y abajo un respiro.
    const pts = boxPoints(layout.minX - WALL_T, layout.apronX - 0.4, -0.3, WALL_H, layout.backZ - WALL_T, layout.frontZ)
    return focusFrom(pts, size.w, size.h, { left: 6, right: insetR + 6, top: insetT + 10, bottom: insetB + 4 }, size.w < 520 ? 4 : 6)
  }, [layout, size.w, size.h, insetR, insetT, insetB])
  const focus = useMemo<CamFocus | null>(() => {
    if (!overview) return null
    const inset = { right: insetR, top: insetT + 36, bottom: insetB + 16 }
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
    // siempre más cerca que la vista general (aunque el hueco libre sea pequeño, como con la hoja de detalle a 768 px)
    return { ...f, zoom: Math.min(Math.max(f.zoom, overview.zoom * 1.3), overview.zoom * 2.6) }
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
  const onUserMove = useCallback(() => setUserMoved(true), [])

  const canReset = hasSelection || userMoved
  useEscape(canReset, deselect)

  // Rótulos compactos si los elevadores quedan a menos de ~175 px en pantalla, y los coches en espera, solo un punto
  // (con el número al pasar el puntero) cuando no hay sitio para tantos rótulos: la vista general
  const bayPx = focus ? focus.zoom * BAY_W * Math.SQRT1_2 : 0
  const compact = bayPx < 175
  const dots = bayPx < 105

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
            onUserMove={onUserMove}
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
            <CarLabel order={c.order} zone={c.spot.kind === 'ready' ? 'ready' : 'park'} selected={selCar?.order.id === c.order.id} compact={compact} dot={dots} onSelect={selectOrder} />
          </OverlayItem>
        ))}
      </OverlayLayer>

      <FloorLegend statuses={statuses} overflowPark={assignment.overflow.park} overflowReady={assignment.overflow.ready} cap={cap} insetB={insetB} />
      {canReset && (
        <button
          type="button"
          onClick={deselect}
          style={{ bottom: insetB + 8, right: insetR + 12 }}
          className="absolute rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-md hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ver toda la nave
        </button>
      )}
    </div>
  )
}

/**
 * Leyenda plegable en la esquina inferior izquierda (la esquina vacía de la maqueta isométrica): un chip «Leyenda» que
 * despliega los estados que hay en la nave, las plazas que no caben y cómo moverse. Cerrada, apenas tapa nada.
 */
function FloorLegend({
  statuses,
  overflowPark,
  overflowReady,
  cap,
  insetB,
}: {
  statuses: WorkOrderStatus[]
  overflowPark: number
  overflowReady: number
  cap: { park: number; ready: number }
  insetB: number
}) {
  const [open, setOpen] = useState(false)
  const note = overflowPark > 0 || overflowReady > 0
  return (
    <div className="absolute left-3 flex flex-col items-start gap-1" style={{ bottom: insetB + 8 }}>
      {open && (
        <div id="leyenda-taller" className="max-w-64 rounded-card border border-line bg-surface/95 p-2.5 text-[11px] text-fg-muted shadow-lg backdrop-blur-sm">
          <ul className="grid gap-1">
            {statuses.map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <span className={cx('size-2 rounded-full', TONE_CLASSES[WORK_ORDER_STATUS[s].tone].dot)} aria-hidden />
                {WORK_ORDER_STATUS[s].label}
              </li>
            ))}
          </ul>
          {note && (
            <p className="mt-1.5 text-fg-subtle">
              {overflowPark > 0 && <>Espera: se ven {cap.park} de {cap.park + overflowPark}. </>}
              {overflowReady > 0 && <>Entrega: se ven {cap.ready} de {cap.ready + overflowReady}.</>}
            </p>
          )}
          <p className="mt-1.5 text-fg-subtle">Arrastra para desplazarte; rueda o pellizco para acercar. Escape vuelve a la vista general.</p>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="leyenda-taller"
        onClick={() => setOpen((o) => !o)}
        className="rounded-control border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-fg-muted shadow-md backdrop-blur-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Leyenda{note && !open ? ' · hay plazas ocultas' : ''}
      </button>
    </div>
  )
}

function sameSlots(a: Map<number, Spot>, b: Map<number, Spot>) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (!sameSpot(v, b.get(k) ?? null)) return false
  return true
}

// ───────────────────────── Escena ─────────────────────────

interface WorldProps {
  bays: Bay[]
  cars: { order: WorkOrder; spot: Spot }[]
  layout: FloorLayout
  tokens: ThemeTokens
  reduced: boolean
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

function WorkshopWorld({
  bays,
  cars,
  layout,
  tokens,
  reduced,
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
  const gl = useThree((s) => s.gl)
  const markShadows = useRedraw()

  // Objetos que mueve el controlador de tráfico: los coches y los carros de los elevadores
  const [handles] = useState(() => new Map<number, CarHandle>())
  const [carriages] = useState(() => new Map<number, THREE.Object3D>())
  const [registerCar] = useState(() => (id: number, h: CarHandle | null) => {
    if (h) handles.set(id, h)
    else handles.delete(id)
  })
  const traffic = useTrafficController(handles, carriages, markShadows)
  const armed = useCompileGate(handles)

  // Plan de la nave para el controlador: dónde aparecen los coches, qué obstáculos hay y cómo se va de una plaza a otra
  const world = useMemo<TrafficWorld>(
    () => ({
      entrance: (d) => entrancePose(layout, spotFromKey(d.key)!),
      obstacles: floorObstacles(layout),
      route: (from, fromKey, to) => {
        const toSpot = spotFromKey(to.key)
        const fromSpot = fromKey === 'entrance' ? 'entrance' : spotFromKey(fromKey)
        return toSpot && fromSpot ? planRoute(layout, from, fromSpot, toSpot, to.pose) : null
      },
    }),
    [layout],
  )
  const desired = useMemo<Desired[]>(
    () =>
      cars.flatMap((c) => {
        const pose = spotPose(layout, c.spot, c.order.status)
        if (!pose) return []
        return [{ id: c.order.id, dims: carDims(resolveBody(c.order.vehicle.body_type)), key: spotKey(c.spot), pose, bay: c.spot.kind === 'bay' ? c.spot.bay : null }]
      }),
    [cars, layout],
  )
  useLayoutEffect(() => {
    traffic.sync(world, desired, { reduced, armed })
  }, [traffic, world, desired, reduced, armed])

  const devExtra = useCallback(
    (api: { project: (x: number, y: number, z: number) => { x: number; y: number } }) => ({
      shadows: markShadows,
      layout,
      /** px del lienzo del centro de un coche (para apuntar en las pruebas) y si está visible. */
      car: (id: number) => {
        const o = handles.get(id)?.root
        if (!o) return null
        const p = o.getWorldPosition(new THREE.Vector3())
        return { ...api.project(p.x, p.y + 0.35, p.z), visible: o.visible }
      },
      /** Posición real (en este instante) de todos los coches, con sus medidas: para medir distancias en pruebas. */
      poses: () =>
        desired.flatMap((d) => {
          const o = handles.get(d.id)?.root
          return o ? [{ id: d.id, x: o.position.x, z: o.position.z, heading: o.rotation.y, visible: o.visible, length: d.dims.length, width: d.dims.width }] : []
        }),
    }),
    [markShadows, layout, handles, desired],
  )
  useDevHook('__workshop3d', devExtra)

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
      const h = getClayModel(resolveBody(c.order.vehicle.body_type)).size.height
      const sel = selectedOrderId === id
      list.push({
        id: `car-${id}`,
        position: [0, h + 0.3, 0],
        track: () => handles.get(id)?.root,
        pivot: 'bottom',
        priority: sel ? 9 : 1,
        fixed: sel,
        dim: (focusBay != null || focusStall != null) && !sel,
      })
    }
    return list
  }, [layout, bays, cars, focusBay, focusStall, selectedOrderId, handles])

  const selStallPose = focusStall ? spotPose(layout, focusStall, 'received') : null
  const selBayPos = focusBay != null ? layout.bays.find((b) => b.number === focusBay) : null
  const lightBox = useMemo(
    () => ({ x0: layout.minX - 2, x1: layout.apronX + 3, z0: layout.backZ - 3, z1: layout.frontZ + 1, y0: -SLAB_H, y1: WALL_H + 1.6 }),
    [layout],
  )
  const bounds = useMemo(() => ({ x0: layout.minX - 6, x1: layout.apronX + 6, z0: layout.backZ - 6, z1: layout.frontZ + 8 }), [layout])

  return (
    <>
      <color attach="background" args={[pal.background]} />
      <StudioLights box={lightBox} pal={pal} small={gl.domElement.clientWidth < 640} />
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
        <CarMesh
          key={c.order.id}
          id={c.order.id}
          body={resolveBody(c.order.vehicle.body_type)}
          color={clayColor(c.order.vehicle.color_hex, c.order.vehicle.id)}
          register={registerCar}
          onSelect={() => onSelectOrder(selectedOrderId === c.order.id ? null : c.order.id)}
          onHover={(on) => setHover(on ? `car-${c.order.id}` : null)}
        />
      ))}
      {selBayPos && <SelectionOutline kind="bay" x={selBayPos.x} z={selBayPos.z} color={tokens.accent} />}
      {selStallPose && <SelectionOutline kind="stall" x={selStallPose.x} z={selStallPose.z} color={tokens.accent} />}
      <IsoRig focus={focus} overview={overview} selKey={selKey} reduced={reduced} bounds={bounds} onUserMove={onUserMove} />
      <OverlayProjector store={overlay} anchors={anchors} inset={inset} />
      <ReleaseOnUnmount />
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
