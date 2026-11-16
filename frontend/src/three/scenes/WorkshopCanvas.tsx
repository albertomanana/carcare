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
 *  - Equipo: una figura por persona del espacio, nunca repetida (`workshop/crew.ts`): junto a su orden en curso o en
 *    la zona del equipo; los elevadores con coche y sin técnico llevan una baliza.
 *  - Lateral del fondo: almacén (se enciende con las órdenes «Esperando piezas») y terminal de diagnóstico.
 *  - Encuadres: general, elevadores, lateral y lo elegido (`view`).
 *  - Bloom selectivo y viñeta (`workshop/Effects.tsx`) en pantallas grandes sin movimiento reducido.
 * Un único <Canvas>, `frameloop="demand"` (no pinta nada en reposo) y sombras que solo se recalculan cuando algo se mueve.
 */
import { MeshReflectorMaterial, useCursor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { isBeingWorked, overallColor } from '@/lib/mechanic'
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
import { buildDecals, selectionOutline } from './workshop/diorama'
import { boxPoints, CAM_DIST, focusFrom, ISO_DIR, useCompileGate, useDevHook, useEscape, useRedraw, useSize, useTrafficController, type CamFocus } from './workshop/iso'
import { clayVertex } from './workshop/clayCar'
import { CarMesh, IsoRig, StudioLights } from './workshop/IsoParts'
import { buildFloorPaint, buildGlow, buildWorkshopStatic, DIAG_SCREEN_TILT, DIAG_SCREEN_Y, haloTexture, poolTexture, workshopCarriage, workshopPalette, type WorkshopPalette } from './workshop/kit'
import { assignCrew, type BayBeacon, type CrewAssignment } from './workshop/crew'
import { BayLabel, CarLabel, CrewLabel, DiagLabel, StoreLabel } from './workshop/labels'
import { Mechanic } from './workshop/Mechanic'
import {
  assignSpots,
  BAY_D,
  BAY_W,
  clayColor,
  computeFloorLayout,
  CREW_GAP,
  entrancePose,
  floorObstacles,
  LANE_GAP,
  mechanicSpot,
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

/** Bloom y viñeta en un chunk aparte: no se descarga si no se usa (pantalla pequeña o movimiento reducido). */
const WorkshopEffects = lazy(() => import('./workshop/Effects').then((m) => ({ default: m.WorkshopEffects })))
/** Factor por el que se multiplican los colores que deben florecer cuando hay bloom (sin él se quedan como están). */
const BLOOM_BOOST = 2.4

/** Si el posprocesado falla (driver, memoria), la escena sigue sin él: quedan los halos pintados. */
class EffectsBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Dónde está la figura de cada persona: junto a su elevador o en la zona del equipo (por orden de la lista). */
type CrewSpot = { x: number; z: number; heading: number }
function crewSpots(layout: FloorLayout, crew: CrewAssignment): Map<number, CrewSpot> {
  const out = new Map<number, CrewSpot>()
  const spots = layout.side.crew
  let k = 0
  for (const p of crew.people) {
    const bay = p.bay != null ? layout.bays.find((b) => b.number === p.bay) : null
    if (bay) {
      out.set(p.member.id, mechanicSpot(bay))
      continue
    }
    // Primera fila delante del banco; si no caben, una segunda fila un poco más adelante y desplazada
    const row = Math.floor(k / spots.length)
    const s = spots[k % spots.length]
    out.set(p.member.id, { x: s.x + (row % 2) * (CREW_GAP / 2), z: s.z + row * 0.7, heading: 0 })
    k++
  }
  return out
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
  crew = null,
  selectedMemberId = null,
  onSelectMember,
  view = 'selected',
  onViewChange,
  highlight = null,
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

  // Equipo: una figura por persona, en un solo sitio
  const crewAssign = useMemo(() => assignCrew(crew, sorted, waiting), [crew, sorted, waiting])
  const spots = useMemo(() => crewSpots(layout, crewAssign), [layout, crewAssign])
  const selMember = selectedMemberId != null ? (crewAssign.people.find((p) => p.member.id === selectedMemberId) ?? null) : null
  const selMemberSpot = selMember ? (spots.get(selMember.member.id) ?? null) : null

  // Órdenes del almacén y del terminal (todas las abiertas, también las que no caben en las plazas)
  const openOrders = useMemo(() => [...sorted.flatMap((b) => (b.work_order ? [b.work_order] : [])), ...waiting], [sorted, waiting])
  const storeOrders = useMemo(() => openOrders.filter((o) => o.status === 'waiting_parts'), [openOrders])
  const diagOrders = useMemo(() => openOrders.filter((o) => o.status === 'diagnosing'), [openOrders])

  // Selección: un coche (de cualquier zona), un elevador o una persona
  const selCar = selectedOrderId != null ? (cars.find((c) => c.order.id === selectedOrderId) ?? null) : null
  const focusBay = selCar ? (selCar.spot.kind === 'bay' ? selCar.spot.bay : null) : selMember ? null : selectedBay
  const focusStall = selCar && selCar.spot.kind !== 'bay' ? selCar.spot : null
  const hasSelection = selCar != null || selectedBay != null || selMember != null

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
  const smx = selMemberSpot?.x ?? null
  const smz = selMemberSpot?.z ?? null
  const focus = useMemo<CamFocus | null>(() => {
    if (!overview) return null
    const inset = { right: insetR, top: insetT + 36, bottom: insetB + 16 }
    let pts: THREE.Vector3[] | null = null
    let near = true
    if (view === 'bays' && layout.bays.length) {
      const b0 = layout.bays[0]
      const b1 = layout.bays[layout.bays.length - 1]
      pts = boxPoints(b0.x - BAY_W / 2 - 0.4, b1.x + BAY_W / 2 + 0.4, 0, POST_H + 0.5, layout.backZ, layout.bayZ + BAY_D / 2 + 1.2)
      near = false
    } else if (view === 'side') {
      pts = boxPoints(layout.side.x0 - WALL_T, layout.side.x1 + 0.6, 0, WALL_H, layout.backZ - WALL_T, layout.bayZ + BAY_D / 2 + 0.8)
      near = false
    } else if (view === 'selected') {
      if (focusBay != null) {
        const b = layout.bays.find((x) => x.number === focusBay)
        if (b) pts = boxPoints(b.x - BAY_W / 2 - 2, b.x + BAY_W / 2 + 2, 0, POST_H + 0.5, b.z - BAY_D / 2 - 0.5, b.z + BAY_D / 2 + 2.2)
      } else if (focusStall) {
        const s = spotPose(layout, focusStall, 'received')
        if (s) pts = boxPoints(s.x - STALL_W / 2 - 3, s.x + STALL_W / 2 + 3, 0, 2.2, s.z - STALL_D / 2 - 2.4, s.z + STALL_D / 2 + 1.2)
      } else if (smx != null && smz != null) {
        pts = boxPoints(smx - 2.6, smx + 2.6, 0, 2, smz - 2.6, smz + 2)
      }
    }
    if (!pts) return overview
    const f = focusFrom(pts, size.w, size.h, inset, 30)
    // lo elegido, siempre más cerca que la vista general (aunque el hueco libre sea pequeño, como con la hoja de detalle a 768 px)
    if (!near) return { ...f, zoom: Math.min(Math.max(f.zoom, overview.zoom), overview.zoom * 2.6) }
    return { ...f, zoom: Math.min(Math.max(f.zoom, overview.zoom * 1.3), overview.zoom * 2.6) }
  }, [overview, layout, view, focusBay, focusStall, smx, smz, size.w, size.h, insetR, insetT, insetB])
  const selKey = `${view}|${selCar ? `o${selCar.order.id}` : ''}|${selectedBay ?? ''}|${selMember ? `m${selMember.member.id}` : ''}|${recenter}`

  const deselect = useCallback(() => {
    onSelectBay?.(null)
    onViewChange?.('general')
    setUserMoved(false)
    setRecenter((r) => r + 1)
  }, [onSelectBay, onViewChange])
  const selectMember = useCallback(
    (id: number | null) => {
      if (id == null) deselect()
      else onSelectMember?.(id)
    },
    [deselect, onSelectMember],
  )
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

  const canReset = hasSelection || userMoved || view === 'bays' || view === 'side'
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
    (nReady ? `, ${nReady} ${nReady === 1 ? 'lista' : 'listas'} para entregar` : '') +
    crewSentence(crewAssign) +
    (storeOrders.length ? `; almacén: ${storeOrders.length} ${storeOrders.length === 1 ? 'orden espera' : 'órdenes esperan'} piezas` : '')

  const statuses = useMemo(() => {
    const set = new Set<WorkOrderStatus>()
    for (const c of cars) set.add(c.order.status)
    return (Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).filter((s) => set.has(s))
  }, [cars])

  const parked = cars.filter((c) => c.spot.kind !== 'bay')
  // Rótulo propio solo para quien no está en un elevador (el del elevador ya dice quién trabaja) y para la persona elegida
  const labelled = crewAssign.people.filter((p) => p.bay == null || p.member.id === selectedMemberId)
  const ids = useMemo(
    () => ['side-store', 'side-diag', ...sorted.map((b) => `bay-${b.number}`), ...parked.map((c) => `car-${c.order.id}`), ...labelled.map((p) => `crew-${p.member.id}`)],
    [sorted, parked, labelled],
  )
  const inset = useMemo(() => ({ right: insetR, top: insetT, bottom: insetB }), [insetR, insetT, insetB])

  // Bloom: pantallas grandes y sin movimiento reducido; si falla al compilar, se queda apagado
  const [bloomFailed, setBloomFailed] = useState(false)
  const bloom = !reduced && !bloomFailed && size.w >= 640

  const hl = useMemo(() => (highlight ? { orders: new Set(highlight.orders), members: new Set(highlight.members) } : null), [highlight])

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
        style={{ touchAction: 'none', cursor: 'grab', filter: 'saturate(1.12) contrast(1.04)' }}
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
            crew={crewAssign}
            crewSpots={spots}
            selectedMemberId={selMember?.member.id ?? null}
            onSelectMember={selectMember}
            storeActive={storeOrders.length > 0}
            diagActive={diagOrders.length > 0}
            highlight={hl}
            bloom={bloom}
          />
        )}
        {focus && overview && bloom && (
          <EffectsBoundary onError={() => setBloomFailed(true)}>
            <Suspense fallback={null}>
              <WorkshopEffects dark={!tokens.light} />
            </Suspense>
          </EffectsBoundary>
        )}
      </Canvas>

      {/* Desenfoque de maqueta (tilt-shift): se difuminan el fondo y el primer plano, el centro queda nítido */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[24%] backdrop-blur-[2.5px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black,transparent)]" />

      <OverlayLayer store={overlay} ids={ids} label="Elevadores, coches y equipo del taller">
        <OverlayItem store={overlay} id="side-store">
          <StoreLabel orders={storeOrders} compact={compact && view !== 'side'} selectedOrderId={selCar?.order.id ?? null} onSelect={selectOrder} />
        </OverlayItem>
        <OverlayItem store={overlay} id="side-diag">
          <DiagLabel orders={diagOrders} compact={compact && view !== 'side'} selectedOrderId={selCar?.order.id ?? null} onSelect={selectOrder} />
        </OverlayItem>
        {sorted.map((b) => (
          <OverlayItem key={b.number} store={overlay} id={`bay-${b.number}`}>
            <BayLabel bay={b} selected={focusBay === b.number} compact={compact} beacon={crewAssign.beacons.get(b.number) ?? null} onSelect={selectBay} />
          </OverlayItem>
        ))}
        {parked.map((c) => (
          <OverlayItem key={c.order.id} store={overlay} id={`car-${c.order.id}`}>
            <CarLabel order={c.order} zone={c.spot.kind === 'ready' ? 'ready' : 'park'} selected={selCar?.order.id === c.order.id} compact={compact} dot={dots} onSelect={selectOrder} />
          </OverlayItem>
        ))}
        {labelled.map((p) => (
          <OverlayItem key={p.member.id} store={overlay} id={`crew-${p.member.id}`}>
            <CrewLabel person={p} selected={selMember?.member.id === p.member.id} dot={dots && view !== 'side'} onSelect={selectMember} />
          </OverlayItem>
        ))}
      </OverlayLayer>

      <FloorLegend statuses={statuses} overflowPark={assignment.overflow.park} overflowReady={assignment.overflow.ready} cap={cap} insetB={insetB} />
      {canReset && (
        <button
          type="button"
          onClick={deselect}
          style={{ bottom: insetB + 8, right: insetR + 12 }}
          className="absolute rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-md hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
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
          <p className="mt-1.5 text-fg-subtle">
            Luz ámbar intermitente en un elevador: coche sin técnico o con su técnico en otro elevador. Luz del almacén: hay órdenes esperando piezas.
            Las figuras son el equipo, una por persona, según sus órdenes (no hay fichaje).
          </p>
          <p className="mt-1.5 text-fg-subtle">Arrastra para desplazarte; rueda o pellizco para acercar. Teclas 1 a 4: vistas. Escape vuelve a la vista general.</p>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="leyenda-taller"
        onClick={() => setOpen((o) => !o)}
        className="rounded-control border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-fg-muted shadow-md backdrop-blur-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
      >
        Leyenda{note && !open ? ' · hay plazas ocultas' : ''}
      </button>
    </div>
  )
}

/** Resumen del equipo para el texto accesible del lienzo. */
function crewSentence(c: CrewAssignment): string {
  if (!c.people.length) return ''
  const working = c.people.filter((p) => p.status === 'working').length
  const idle = c.people.length - working
  const parts: string[] = []
  if (working) parts.push(`${working} ${working === 1 ? 'persona trabajando' : 'personas trabajando'}`)
  if (idle) parts.push(`${idle} sin orden en curso`)
  const waitingTech = [...c.beacons.values()].filter((b) => b.kind === 'awaiting_tech').length
  if (waitingTech) parts.push(`${waitingTech} ${waitingTech === 1 ? 'coche espera' : 'coches esperan'} técnico`)
  return `; equipo: ${parts.join(', ')}`
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
  crew: CrewAssignment
  crewSpots: Map<number, CrewSpot>
  selectedMemberId: number | null
  onSelectMember: (id: number | null) => void
  storeActive: boolean
  diagActive: boolean
  highlight: { orders: Set<number>; members: Set<number> } | null
  bloom: boolean
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
  crew,
  crewSpots,
  selectedMemberId,
  onSelectMember,
  storeActive,
  diagActive,
  highlight,
  bloom,
}: WorldProps) {
  useCanvasLabel(label)
  const pal = useMemo(() => workshopPalette(tokens), [tokens])
  const gl = useThree((s) => s.gl)
  const markShadows = useRedraw()

  // Objetos que mueve el controlador de tráfico: los coches y los carros de los elevadores
  const [handles] = useState(() => new Map<number, CarHandle>())
  const [carriages] = useState(() => new Map<number, THREE.Object3D>())
  // Figuras del equipo, por persona (para que los rótulos las sigan mientras caminan)
  const [figures] = useState(() => new Map<number, THREE.Object3D>())
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
      /** Figuras del equipo que hay en la escena (una por persona): id, posición y si se ven. */
      crew: () => [...figures.entries()].map(([id, o]) => ({ id, x: o.position.x, z: o.position.z, visible: o.visible })),
    }),
    [markShadows, layout, handles, desired, figures],
  )
  useDevHook('__workshop3d', devExtra)

  const [hover, setHover] = useState<string | null>(null)
  useCursor(!!hover, 'pointer', '', gl.domElement)

  const anyFocus = focusBay != null || focusStall != null || selectedMemberId != null
  const anchors: OverlayAnchor[] = useMemo(() => {
    const outOfFilter = (orderId: number | null | undefined) => !!highlight && (orderId == null || !highlight.orders.has(orderId))
    const list: OverlayAnchor[] = [
      {
        id: 'side-store',
        position: [layout.side.store.x, 2.25, layout.side.store.z],
        pivot: 'bottom',
        priority: storeActive ? 4 : 1,
        dim: anyFocus || !!highlight,
      },
      {
        id: 'side-diag',
        position: [layout.side.diag.x, 1.85, layout.side.diag.z],
        pivot: 'bottom',
        priority: diagActive ? 3 : 1,
        dim: anyFocus || !!highlight,
      },
    ]
    for (const b of layout.bays) {
      const bay = bays.find((x) => x.number === b.number)
      const sel = focusBay === b.number
      list.push({
        id: `bay-${b.number}`,
        position: [b.x - POST_X * 0.2, POST_H + 0.45, b.z],
        pivot: 'bottom',
        priority: sel ? 10 : bay?.work_order ? 3 : 2,
        fixed: sel,
        dim: (anyFocus && !sel) || (!sel && outOfFilter(bay?.work_order?.id)),
      })
    }
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
        dim: (anyFocus && !sel) || (!sel && outOfFilter(id)),
      })
    }
    for (const p of crew.people) {
      const id = p.member.id
      const sel = selectedMemberId === id
      if (p.bay != null && !sel) continue
      list.push({
        id: `crew-${id}`,
        position: [0, 1.95, 0],
        track: () => figures.get(id),
        pivot: 'bottom',
        priority: sel ? 9 : 1,
        fixed: sel,
        dim: (anyFocus && !sel) || (!!highlight && !sel && !highlight.members.has(id)),
      })
    }
    return list
  }, [layout, bays, cars, focusBay, selectedOrderId, handles, crew, selectedMemberId, figures, anyFocus, highlight, storeActive, diagActive])

  const selStallPose = focusStall ? spotPose(layout, focusStall, 'received') : null
  const selBayPos = focusBay != null ? layout.bays.find((b) => b.number === focusBay) : null

  // Realce al pasar el puntero: el contorno de la plaza de lo que se señala (coche, mecánico, elevador), salvo si ya está elegido
  const hoverSpot = useMemo<Spot | null>(() => {
    if (!hover) return null
    const [kind, raw] = hover.split('-')
    const n = Number(raw)
    if (kind === 'bay') return { kind: 'bay', bay: n }
    if (kind !== 'car') return null
    return cars.find((c) => c.order.id === n)?.spot ?? null
  }, [hover, cars])
  const hoverBay = hoverSpot?.kind === 'bay' && hoverSpot.bay !== focusBay ? layout.bays.find((b) => b.number === hoverSpot.bay) : null
  const hoverStall = hoverSpot && hoverSpot.kind !== 'bay' && !sameSpot(hoverSpot, focusStall) ? spotPose(layout, hoverSpot, 'received') : null

  const aisleZ = layout.bayZ + BAY_D / 2 + LANE_GAP / 2
  const boost = bloom ? BLOOM_BOOST : 1
  const lightBox = useMemo(
    () => ({ x0: layout.minX - 2, x1: layout.apronX + 3, z0: layout.backZ - 3, z1: layout.frontZ + 1, y0: -SLAB_H, y1: WALL_H + 1.6 }),
    [layout],
  )
  const bounds = useMemo(() => ({ x0: layout.minX - 6, x1: layout.apronX + 6, z0: layout.backZ - 6, z1: layout.frontZ + 8 }), [layout])

  return (
    <>
      <color attach="background" args={[pal.background]} />
      <StudioLights box={lightBox} pal={pal} small={gl.domElement.clientWidth < 640} />
      <Diorama layout={layout} pal={pal} boost={boost} />
      <SideZone layout={layout} pal={pal} tokens={tokens} storeActive={storeActive} diagActive={diagActive} reduced={reduced} boost={boost} />
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
            glow={st ? boost : 1}
            beacon={crew.beacons.get(b.number) ?? null}
            reduced={reduced}
            register={(o) => {
              if (o) carriages.set(b.number, o)
              else carriages.delete(b.number)
            }}
            onSelect={() => onSelectBay(focusBay === b.number ? null : b.number)}
            onHover={(on) => setHover(on ? `bay-${b.number}` : null)}
          />
        )
      })}
      {cars.map((c) => {
        const color = clayColor(c.order.vehicle.color_hex, c.order.vehicle.id)
        const dimmed = !!highlight && !highlight.orders.has(c.order.id) && selectedOrderId !== c.order.id
        return (
          <CarMesh
            key={c.order.id}
            id={c.order.id}
            body={resolveBody(c.order.vehicle.body_type)}
            color={dimmed ? dimColor(color, pal.background) : color}
            register={registerCar}
            onSelect={() => onSelectOrder(selectedOrderId === c.order.id ? null : c.order.id)}
            onHover={(on) => setHover(on ? `car-${c.order.id}` : null)}
          />
        )
      })}
      <BayLights layout={layout} bays={bays} pal={pal} />
      {crew.people.map((p) => {
        const id = p.member.id
        const spot = crewSpots.get(id)
        if (!spot) return null
        const bay = p.bay != null ? layout.bays.find((b) => b.number === p.bay) : null
        const orderId = p.orderId
        return (
          <Mechanic
            key={id}
            x={spot.x}
            z={spot.z}
            heading={spot.heading}
            color={overallColor(id)}
            task={bay ? (p.task ?? 'idle') : 'idle'}
            reduced={reduced}
            hovered={hover === `mech-${id}`}
            selected={selectedMemberId === id}
            selectColor={tokens.accent}
            dim={!!highlight && !highlight.members.has(id)}
            aisleZ={aisleZ}
            phaseSeed={id}
            register={(o) => {
              if (o) figures.set(id, o)
              else figures.delete(id)
            }}
            ready={
              bay && orderId != null
                ? () => {
                    const o = handles.get(orderId)?.root
                    return !!o && o.visible && Math.abs(o.position.x - bay.x) < 0.08 && Math.abs(o.position.z - bay.z) < 0.08
                  }
                : undefined
            }
            onSelect={() => onSelectMember(selectedMemberId === id ? null : id)}
            onHover={(on) => setHover(on ? `mech-${id}` : null)}
          />
        )
      })}
      {hoverBay && <SelectionOutline kind="bay" x={hoverBay.x} z={hoverBay.z} color="#ffffff" opacity={0.5} />}
      {hoverStall && <SelectionOutline kind="stall" x={hoverStall.x} z={hoverStall.z} color="#ffffff" opacity={0.5} />}
      {selBayPos && <SelectionOutline kind="bay" x={selBayPos.x} z={selBayPos.z} color={tokens.accent} />}
      {selStallPose && <SelectionOutline kind="stall" x={selStallPose.x} z={selStallPose.z} color={tokens.accent} />}
      <IsoRig focus={focus} overview={overview} selKey={selKey} reduced={reduced} bounds={bounds} onUserMove={onUserMove} />
      <OverlayProjector store={overlay} anchors={anchors} inset={inset} />
      <ReleaseOnUnmount />
    </>
  )
}

// ───────────────────────── Nave ─────────────────────────

/** Luces de puesto reales (las demás plazas solo llevan el charco de luz): acota el coste por píxel. */
const MAX_BAY_LIGHTS = 6

const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

/**
 * Luz cálida de cada puesto: un charco de luz en el suelo y, en los primeros elevadores, un punto de luz real que
 * saca brillo al epoxi y al coche. Plena si hay alguien trabajando, tenue si el coche solo espera y apagada si el
 * elevador está libre. Las luces existen siempre (apagadas valen 0) para no recompilar sombreadores al cambiar.
 */
function BayLights({ layout, bays, pal }: { layout: FloorLayout; bays: Bay[]; pal: WorkshopPalette }) {
  const poolMat = useMemo(() => {
    const map = poolTexture()
    return map ? new THREE.MeshBasicMaterial({ map, color: pal.pool, transparent: true, opacity: pal.poolOpacity, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }) : null
  }, [pal.pool, pal.poolOpacity])
  const dimMat = useMemo(() => {
    const map = poolTexture()
    return map ? new THREE.MeshBasicMaterial({ map, color: pal.pool, transparent: true, opacity: pal.poolOpacity * 0.4, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }) : null
  }, [pal.pool, pal.poolOpacity])
  useEffect(() => () => poolMat?.dispose(), [poolMat])
  useEffect(() => () => dimMat?.dispose(), [dimMat])
  return (
    <>
      {layout.bays.map((b, i) => {
        const o = bays.find((x) => x.number === b.number)?.work_order
        const level = !o ? 0 : isBeingWorked(o.status) ? 1 : 0.4
        const mat = level === 1 ? poolMat : dimMat
        return (
          <group key={b.number}>
            {level > 0 && mat && <mesh geometry={poolGeo} material={mat} position={[b.x, 0.011, b.z + 0.2]} scale={[BAY_W + 2.4, 1, BAY_D + 2]} renderOrder={1} />}
            {i < MAX_BAY_LIGHTS && <pointLight position={[b.x + 0.4, POST_H + 1.1, b.z + 1.4]} color={pal.lampColor} intensity={pal.lampIntensity * level} distance={11} decay={2} />}
          </group>
        )
      })}
    </>
  )
}

/** Color de un coche que no coincide con el filtro: se funde con el fondo. */
function dimColor(color: string, background: string): string {
  return `#${new THREE.Color(color).lerp(new THREE.Color(background), 0.62).getHexString()}`
}

function Diorama({ layout, pal, boost }: { layout: FloorLayout; pal: WorkshopPalette; boost: number }) {
  const statics = useMemo(() => buildWorkshopStatic(layout, pal), [layout, pal])
  const marks = useMemo(() => buildFloorPaint(layout, pal), [layout, pal])
  const glow = useMemo(() => buildGlow(layout, pal), [layout, pal])
  // Con bloom, el trazo pasa de 1 y florece; el halo pintado se queda a la mitad (el bloom ya da el resplandor)
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(boost, boost, boost) }), [boost])
  const haloMat = useMemo(() => {
    const map = haloTexture()
    const opacity = boost > 1 ? pal.halo * 0.5 : pal.halo
    return map ? new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, opacity, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }) : null
  }, [pal.halo, boost])
  useEffect(
    () => () => {
      glow.core.dispose()
      glow.halo.dispose()
    },
    [glow],
  )
  useEffect(() => () => glowMat.dispose(), [glowMat])
  useEffect(() => () => haloMat?.dispose(), [haloMat])
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
      {/* Suelo epoxi: un plano brillante sobre la losa que refleja coches, elevadores y luces */}
      <mesh rotation-x={-Math.PI / 2} position={[(layout.minX - WALL_T + layout.apronX) / 2, 0.001, (layout.backZ - WALL_T + layout.frontZ) / 2]} receiveShadow>
        <planeGeometry args={[w + WALL_T + 0.3, d + WALL_T + 0.3]} />
        <MeshReflectorMaterial
          color={pal.floor}
          roughness={pal.floorRoughness}
          metalness={0.05}
          mirror={pal.mirror}
          mixStrength={pal.mirror * 1.6}
          mixBlur={0.85}
          blur={[220, 70]}
          resolution={512}
          depthScale={0}
        />
      </mesh>
      <mesh geometry={marks} material={clayVertex()} receiveShadow />
      {haloMat && <mesh geometry={glow.halo} material={haloMat} renderOrder={1} />}
      <mesh geometry={glow.core} material={glowMat} renderOrder={2} />
      {decals && decalMat && <mesh geometry={decals.geometry} material={decalMat} receiveShadow renderOrder={1} />}
    </group>
  )
}

// ───────────────────────── Elevador ─────────────────────────

const lampGeo = new THREE.SphereGeometry(0.13, 16, 10)
const lampCache = new Map<string, THREE.MeshStandardMaterial>()
/** Lámpara de estado del elevador; con `glow` > 1 (bloom activo) brilla por encima del umbral y florece. */
function lampMaterial(color: string, glow = 1) {
  const key = `${color}|${glow}`
  let m = lampCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55 * glow, roughness: 0.5, metalness: 0 })
    lampCache.set(key, m)
  }
  return m
}
const PROXY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
const unitBox = new THREE.BoxGeometry(1, 1, 1)

// ───────────────────────── Balizas (coche sin técnico) y lateral ─────────────────────────

const BEACON = '#f5a70b'
const beaconGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.24, 16)
const beaconCapGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16)

/**
 * Luz intermitente ámbar (se apaga y se enciende 1 vez por segundo). Pide fotogramas solo mientras existe y no hay
 * movimiento reducido (entonces queda encendida fija). `strength` > 1 la hace florecer con el bloom.
 */
function BlinkLight({ position, strength, reduced, geometry = beaconGeo, color = BEACON }: { position: [number, number, number]; strength: number; reduced: boolean; geometry?: THREE.BufferGeometry; color?: string }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false }), [color, strength])
  useEffect(() => () => mat.dispose(), [mat])
  const base = useMemo(() => new THREE.Color(color).multiplyScalar(strength), [color, strength])
  const off = useMemo(() => new THREE.Color(color).multiplyScalar(0.25), [color])
  useFrame((state) => {
    if (reduced) {
      mat.color.copy(base)
      return
    }
    const k = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * Math.PI * 2)
    mat.color.copy(off).lerp(base, k * k)
    state.invalidate()
  })
  return <mesh geometry={geometry} material={mat} position={position} renderOrder={2} />
}

const screenGeo = new THREE.PlaneGeometry(0.68, 0.42)

/**
 * Lateral del fondo: pantalla del terminal de diagnóstico (encendida si hay coches en diagnóstico, en reposo si no)
 * y luz del almacén (intermitente si alguna orden espera piezas; apagada si no). La estantería y el armario son
 * geometría estática de `kit.ts`.
 */
function SideZone({
  layout,
  pal,
  tokens,
  storeActive,
  diagActive,
  reduced,
  boost,
}: {
  layout: FloorLayout
  pal: WorkshopPalette
  tokens: ThemeTokens
  storeActive: boolean
  diagActive: boolean
  reduced: boolean
  boost: number
}) {
  const screenMat = useMemo(() => {
    const c = new THREE.Color(diagActive ? '#38bdf8' : '#1f3346')
    if (diagActive) c.multiplyScalar(boost * 0.9)
    return new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
  }, [diagActive, boost])
  useEffect(() => () => screenMat.dispose(), [screenMat])
  const d = layout.side.diag
  const s = layout.side.store
  return (
    <group>
      <mesh
        geometry={screenGeo}
        material={screenMat}
        position={[d.x, DIAG_SCREEN_Y + Math.sin(-DIAG_SCREEN_TILT) * 0.035, d.z - 0.04 + Math.cos(DIAG_SCREEN_TILT) * 0.035]}
        rotation-x={DIAG_SCREEN_TILT}
      />
      {storeActive ? (
        <BlinkLight position={[s.x, 2.17, s.z]} strength={boost * 1.1} reduced={reduced} />
      ) : (
        <mesh geometry={beaconGeo} material={lampMaterial(pal.postDark)} position={[s.x, 2.17, s.z]} />
      )}
      <mesh geometry={beaconCapGeo} material={lampMaterial(tokens.light ? '#3a3f4b' : '#20242c')} position={[s.x, 2.31, s.z]} />
    </group>
  )
}

function Lift({
  number,
  x,
  z,
  pal,
  lamp,
  glow,
  beacon,
  reduced,
  register,
  onSelect,
  onHover,
}: {
  number: number
  x: number
  z: number
  pal: WorkshopPalette
  lamp: string
  /** Factor de brillo de la lámpara (bloom). */
  glow: number
  /** Coche sin técnico (o con su técnico en otro elevador): baliza ámbar sobre la columna derecha. */
  beacon: BayBeacon | null
  reduced: boolean
  register: (o: THREE.Object3D | null) => void
  onSelect: () => void
  onHover: (on: boolean) => void
}) {
  const carriage = workshopCarriage(pal)
  return (
    <group>
      <mesh ref={register} name={`elevador-${number}`} geometry={carriage} material={clayVertex()} position={[x, 0, z]} castShadow receiveShadow />
      <mesh geometry={lampGeo} material={lampMaterial(lamp, glow)} position={[x - POST_X, POST_H + 0.22, z]} />
      {beacon && <BlinkLight position={[x + POST_X, POST_H + 0.25, z]} strength={Math.max(glow, 1)} reduced={reduced} />}
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
function SelectionOutline({ kind, x, z, color, opacity = 0.95 }: { kind: 'bay' | 'stall'; x: number; z: number; color: string; opacity?: number }) {
  const geo = (outlineGeos[kind] ??= selectionOutline(kind))
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity, depthWrite: false }), [color, opacity])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh geometry={geo} material={mat} position={[x, 0.004, z]} renderOrder={3} />
}
