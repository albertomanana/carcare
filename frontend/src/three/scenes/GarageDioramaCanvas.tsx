/**
 * Garaje 3D (chunk diferido): diorama isométrico «de arcilla» para el modo particular, con el mismo estilo, cámara,
 * luz, materiales y sistema de movimiento que el taller.
 *  - Una plaza por vehículo (máx. 6 visibles), de morro hacia el espectador; los coches entran por la calzada en cola
 *    y giran hacia su plaza sin tocarse (`workshop/traffic.ts`), con el color real del vehículo en tono mate.
 *  - El vehículo seleccionado sube a una plataforma giratoria suave (parada con movimiento reducido) y la cámara lo
 *    enfoca con GSAP; Escape, clic en el vacío o «Ver todo el garaje» deseleccionan.
 *  - `compact`: cabecera pequeña (~260 px) con el garaje entero a la vista, sin paneo ni zoom y con rótulos cortos.
 *  - Rótulos HTML accesibles (un botón por vehículo) y `aria-label` en el lienzo.
 * Un único <Canvas>, `frameloop="demand"` (no pinta nada en reposo; mientras gira la plataforma, un fotograma por vez).
 */
import { useCursor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { resolveBody } from '../car/specs'
import { useInView, usePrefersReducedMotion, useThemeTokens } from '../env'
import type { GarageSceneProps, GarageVehicle } from '../types'
import { ReleaseOnUnmount, ResumeOnVisible } from './common'
import { canvasDpr } from './dpr'
import { buildGarageDecals, buildGarageMarkings, buildGarageStatic, buildPad } from './garage/diorama'
import { VehicleLabel } from './garage/labels'
import {
  assignGarageSlots,
  computeGarageLayout,
  entrancePose,
  garageObstacles,
  garageRoute,
  MAX_SLOTS,
  PAD_H,
  SLAB_H,
  SLOT_D,
  SLOT_PITCH,
  sameGarageSlots,
  slotFromKey,
  slotKey,
  slotPose,
  vehicleAria,
  WALL_H,
  WALL_T,
  type GarageLayout,
} from './garage/layout'
import { OverlayItem, OverlayLayer, OverlayProjector, type OverlayAnchor } from './overlay'
import { useOverlayStore, type OverlayStore } from './overlayStore'
import { useCanvasLabel } from './useCanvasLabel'
import { clayVertex } from './workshop/clayCar'
import { carDims, getClayModel } from './workshop/clayReal'
import { dioramaPalette, type DioramaPalette } from './workshop/diorama'
import { boxPoints, CAM_DIST, focusFrom, ISO_DIR, useCompileGate, useDevHook, useEscape, useRedraw, useSize, useTrafficController, type CamFocus } from './workshop/iso'
import { CarMesh, IsoRig, StudioLights } from './workshop/IsoParts'
import { clayColor } from './workshop/layout'
import type { CarHandle, Desired, TrafficWorld } from './workshop/traffic'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Encuadre del vehículo elegido (o el general si no hay, o en la cabecera pequeña, donde no hay vuelos). */
function garageFocus(layout: GarageLayout, selSlot: number | null, compact: boolean, overview: CamFocus, w: number, h: number, insetR: number, insetT: number, insetB: number): CamFocus {
  if (compact || selSlot == null) return overview
  const s = slotPose(layout, selSlot)
  if (!s) return overview
  const pts = boxPoints(s.x - SLOT_PITCH / 2 - 1.8, s.x + SLOT_PITCH / 2 + 1.8, 0, 2.2, s.z - SLOT_D / 2 - 2.6, s.z + SLOT_D / 2 + 1.4)
  const f = focusFrom(pts, w, h, { right: insetR, top: insetT + 70, bottom: insetB + 30 }, 30)
  return { ...f, zoom: Math.min(Math.max(f.zoom, overview.zoom * 1.3), overview.zoom * 3) }
}

// ───────────────────────── Componente público ─────────────────────────

export default function GarageDioramaCanvas({ vehicles, selectedId = null, onSelect, focusInset, compact = false, className }: GarageSceneProps) {
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  const overlay = useOverlayStore()
  const size = useSize(wrap)

  // Plazas estables (cada vehículo conserva la suya; los nuevos, la libre más baja) y vehículos visibles
  const ids = useMemo(() => vehicles.map((v) => v.id), [vehicles])
  const [prevSlots, setPrevSlots] = useState(() => new Map<number, number>())
  const assignment = useMemo(() => assignGarageSlots(ids, prevSlots), [ids, prevSlots])
  if (!sameGarageSlots(prevSlots, assignment.slots)) setPrevSlots(assignment.slots)
  const slotOf = assignment.slots
  const byId = new Map(vehicles.map((v) => [v.id, v]))
  const shown = assignment.shown.map((id) => byId.get(id)!)
  const nSlots = shown.length ? Math.max(...shown.map((v) => slotOf.get(v.id)!)) + 1 : 1
  const layout = useMemo(() => computeGarageLayout(nSlots), [nSlots])

  const selected = selectedId != null ? (shown.find((v) => v.id === selectedId) ?? null) : null
  const selSlot = selected ? slotOf.get(selected.id)! : null

  // Encuadres: general y del vehículo elegido, dejando libre lo que tapen los paneles de la página
  const [recenter, setRecenter] = useState(0)
  const [userMoved, setUserMoved] = useState(false)
  const insetR = focusInset?.right ?? 0
  const insetT = focusInset?.top ?? 0
  const insetB = focusInset?.bottom ?? 0
  const padTop = compact ? 14 : 26
  const padBottom = compact ? 4 : 20
  const overview = useMemo<CamFocus | null>(() => {
    if (size.w < 40 || size.h < 40) return null
    // cabecera pequeña: solo la fila de plazas y la calzada (el muro del fondo queda recortado por arriba)
    const pts = compact
      ? boxPoints(layout.minX, layout.maxX + 1.5, 0, 2.2, layout.laneZ - 1.2, layout.frontZ - 1.4)
      : boxPoints(layout.minX - WALL_T, layout.apronX, -SLAB_H, WALL_H, layout.backZ - WALL_T, layout.frontZ)
    return focusFrom(pts, size.w, size.h, { right: insetR, top: insetT + padTop, bottom: insetB + padBottom }, compact || size.w < 520 ? 6 : 14)
  }, [layout, size.w, size.h, insetR, insetT, insetB, padTop, padBottom, compact])
  const focus = useMemo(
    () => (overview ? garageFocus(layout, selSlot, compact, overview, size.w, size.h, insetR, insetT, insetB) : null),
    [overview, layout, selSlot, compact, size.w, size.h, insetR, insetT, insetB],
  )
  const selKey = `${selected ? selected.id : ''}|${recenter}`

  const deselect = useCallback(() => {
    onSelect?.(null)
    setUserMoved(false)
    setRecenter((r) => r + 1)
  }, [onSelect])
  const select = useCallback(
    (id: number | null) => {
      if (id == null) deselect()
      else onSelect?.(id)
    },
    [deselect, onSelect],
  )
  const onUserMove = useCallback(() => setUserMoved(true), [])
  const canReset = selected != null || userMoved
  useEscape(canReset, deselect)

  const label =
    `Garaje 3D, diorama isométrico: ${shown.length} ${shown.length === 1 ? 'vehículo' : 'vehículos'}` +
    (assignment.hidden ? ` (se muestran ${MAX_SLOTS} de ${vehicles.length})` : '') +
    (selected ? `. Seleccionado: ${vehicleAria(selected)}` : '')

  const labelIds = useMemo(() => shown.map((v) => `veh-${v.id}`), [shown])
  const inset = useMemo(() => ({ right: insetR, top: insetT, bottom: insetB }), [insetR, insetT, insetB])
  const labelCompact = compact || (!!focus && focus.zoom * SLOT_PITCH * Math.SQRT1_2 < 150)

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
          if (e.type === 'click' && (selected || userMoved)) deselect()
        }}
        style={{ touchAction: compact ? 'pan-y' : 'none', cursor: compact ? 'default' : 'grab' }}
      >
        <ResumeOnVisible visible={inView} />
        {focus && overview && (
          <GarageWorld
            vehicles={shown}
            slotOf={slotOf}
            layout={layout}
            reduced={reduced}
            selectedId={selected?.id ?? null}
            onSelect={select}
            label={label}
            overlay={overlay}
            focus={focus}
            overview={overview}
            selKey={selKey}
            onUserMove={onUserMove}
            inset={inset}
            compact={compact}
            palSource={tokens}
          />
        )}
      </Canvas>

      <OverlayLayer store={overlay} ids={labelIds} label="Vehículos del garaje">
        {shown.map((v) => (
          <OverlayItem key={v.id} store={overlay} id={`veh-${v.id}`}>
            <VehicleLabel vehicle={v} slot={slotOf.get(v.id)!} selected={selected?.id === v.id} compact={labelCompact} onSelect={select} />
          </OverlayItem>
        ))}
      </OverlayLayer>

      {!compact && (
        <div className="pointer-events-none absolute left-3 flex items-end gap-2" style={{ bottom: insetB + 8, right: insetR + 12 }}>
          <p className="mr-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/80 px-2 py-1 text-[11px] text-fg-muted backdrop-blur-sm">
            {assignment.hidden > 0 && (
              <span className="text-fg-subtle">
                Se ven {MAX_SLOTS} de {vehicles.length} vehículos
              </span>
            )}
            <span className="hidden text-fg-subtle sm:inline">Arrastra para desplazarte; rueda o pellizco para acercar</span>
          </p>
          {canReset && (
            <button
              type="button"
              onClick={deselect}
              className="pointer-events-auto shrink-0 rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-md hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ver todo el garaje
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Escena ─────────────────────────

interface WorldProps {
  vehicles: GarageVehicle[]
  slotOf: Map<number, number>
  layout: GarageLayout
  reduced: boolean
  selectedId: number | null
  onSelect: (id: number | null) => void
  label: string
  overlay: OverlayStore
  focus: CamFocus
  overview: CamFocus
  selKey: string
  onUserMove: () => void
  inset: { right: number; top: number; bottom: number }
  compact: boolean
  palSource: Parameters<typeof dioramaPalette>[0]
}

function GarageWorld({ vehicles, slotOf, layout, reduced, selectedId, onSelect, label, overlay, focus, overview, selKey, onUserMove, inset, compact, palSource }: WorldProps) {
  useCanvasLabel(label)
  const pal = useMemo(() => dioramaPalette(palSource), [palSource])
  const gl = useThree((s) => s.gl)
  const markShadows = useRedraw()

  const [handles] = useState(() => new Map<number, CarHandle>())
  const [carriages] = useState(() => new Map<number, THREE.Object3D>())
  const [spins] = useState(() => new Map<number, THREE.Object3D>())
  const [registerCar] = useState(() => (id: number, h: CarHandle | null) => {
    if (h) handles.set(id, h)
    else handles.delete(id)
  })
  const [registerSpin] = useState(() => (id: number, g: THREE.Object3D | null) => {
    if (g) spins.set(id, g)
    else spins.delete(id)
  })
  const traffic = useTrafficController(handles, carriages, markShadows)
  const armed = useCompileGate(handles)

  const world = useMemo<TrafficWorld>(
    () => ({
      entrance: () => entrancePose(layout),
      obstacles: garageObstacles(layout),
      route: (_from, fromKey, to) => {
        const slot = slotFromKey(to.key)
        return fromKey === 'entrance' && slot !== null ? garageRoute(layout, slot) : null
      },
    }),
    [layout],
  )
  const desired = useMemo<Desired[]>(
    () =>
      vehicles.flatMap((v) => {
        const slot = slotOf.get(v.id)
        const pose = slot === undefined ? null : slotPose(layout, slot)
        return pose ? [{ id: v.id, dims: carDims(resolveBody(v.body)), key: slotKey(slot!), pose, bay: null }] : []
      }),
    [vehicles, slotOf, layout],
  )
  useLayoutEffect(() => {
    traffic.sync(world, desired, { reduced, armed })
  }, [traffic, world, desired, reduced, armed])

  const devExtra = useCallback(
    (api: { project: (x: number, y: number, z: number) => { x: number; y: number } }) => ({
      shadows: markShadows,
      layout,
      car: (id: number) => {
        const o = handles.get(id)?.root
        if (!o) return null
        const p = o.getWorldPosition(new THREE.Vector3())
        return { ...api.project(p.x, p.y + 0.35, p.z), visible: o.visible }
      },
      poses: () =>
        desired.flatMap((d) => {
          const o = handles.get(d.id)?.root
          return o ? [{ id: d.id, x: o.position.x, z: o.position.z, heading: o.rotation.y, visible: o.visible, length: d.dims.length, width: d.dims.width }] : []
        }),
    }),
    [markShadows, layout, handles, desired],
  )
  useDevHook('__garage3d', devExtra)

  const [hover, setHover] = useState<string | null>(null)
  useCursor(!!hover, 'pointer', '', gl.domElement)

  const anchors: OverlayAnchor[] = useMemo(
    () =>
      vehicles.map((v) => {
        const h = getClayModel(resolveBody(v.body)).size.height
        const sel = selectedId === v.id
        return {
          id: `veh-${v.id}`,
          position: [0, h + 0.35 + (sel ? PAD_H : 0), 0] as [number, number, number],
          track: () => handles.get(v.id)?.root,
          pivot: 'bottom' as const,
          priority: sel ? 9 : 1,
          fixed: sel,
          dim: selectedId != null && !sel,
        }
      }),
    [vehicles, selectedId, handles],
  )

  const lightBox = useMemo(
    () => ({ x0: layout.minX - 2, x1: layout.apronX + 3, z0: layout.backZ - 3, z1: layout.frontZ + 1, y0: -SLAB_H, y1: WALL_H + 1.6 }),
    [layout],
  )
  const bounds = useMemo(() => ({ x0: layout.minX - 6, x1: layout.apronX + 6, z0: layout.backZ - 6, z1: layout.frontZ + 8 }), [layout])
  const padGeo = useMemo(() => buildPad(pal), [pal])
  useEffect(() => () => padGeo.dispose(), [padGeo])

  return (
    <>
      <color attach="background" args={[pal.background]} />
      <StudioLights box={lightBox} pal={pal} small={gl.domElement.clientWidth < 640} />
      <GarageFloor layout={layout} pal={pal} />
      {vehicles.map((v) => {
        const slot = slotOf.get(v.id)!
        const s = layout.slots[slot]
        return (
          <SlotPad key={`pad-${v.id}`} x={s.x} z={s.z} carId={v.id} geometry={padGeo} selected={selectedId === v.id} reduced={reduced} spins={spins} redraw={markShadows} />
        )
      })}
      {vehicles.map((v) => (
        <CarMesh
          key={v.id}
          id={v.id}
          body={resolveBody(v.body)}
          color={clayColor(v.color, v.id)}
          register={registerCar}
          registerSpin={registerSpin}
          onSelect={() => onSelect(selectedId === v.id ? null : v.id)}
          onHover={(on) => setHover(on ? `veh-${v.id}` : null)}
        />
      ))}
      <IsoRig focus={focus} overview={overview} selKey={selKey} reduced={reduced} bounds={bounds} interactive={!compact} onUserMove={onUserMove} />
      <OverlayProjector store={overlay} anchors={anchors} inset={inset} />
      <ReleaseOnUnmount />
    </>
  )
}

// ───────────────────────── Suelo y paredes ─────────────────────────

function GarageFloor({ layout, pal }: { layout: GarageLayout; pal: DioramaPalette }) {
  const statics = useMemo(() => buildGarageStatic(layout, pal), [layout, pal])
  const marks = useMemo(() => buildGarageMarkings(layout, pal), [layout, pal])
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
  const decals = useMemo(() => buildGarageDecals(layout, pal.decal), [layout, pal.decal, fontTick]) // eslint-disable-line react-hooks/exhaustive-deps
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

// ───────────────────────── Plataforma giratoria ─────────────────────────

const SPIN_SPEED = 0.35

/**
 * Plataforma bajo el coche seleccionado: sube (0,5 s) con el coche encima y gira despacio (0,35 rad/s). Al soltarla,
 * vuelve al giro más cercano a 0 y baja. Con movimiento reducido: sube y baja sin girar. Solo pinta fotogramas mientras
 * gira o se anima (el lienzo está en `demand`).
 */
function SlotPad({
  x,
  z,
  carId,
  geometry,
  selected,
  reduced,
  spins,
  redraw,
}: {
  x: number
  z: number
  carId: number
  geometry: THREE.BufferGeometry
  selected: boolean
  reduced: boolean
  spins: Map<number, THREE.Object3D>
  redraw: () => void
}) {
  const pad = useRef<THREE.Group>(null)
  const state = useRef({ raise: 0, angle: 0 })
  const tween = useRef<gsap.core.Tween | null>(null)
  const invalidate = useThree((s) => s.invalidate)

  const apply = useCallback(() => {
    const st = state.current
    const g = pad.current
    if (g) {
      g.visible = st.raise > 0.01
      g.scale.y = Math.max(st.raise, 0.001)
      g.rotation.y = st.angle
    }
    const car = spins.get(carId)
    if (car) {
      car.position.y = PAD_H * st.raise
      car.rotation.y = st.angle
    }
    redraw()
  }, [spins, carId, redraw])

  useLayoutEffect(() => {
    const st = state.current
    tween.current?.kill()
    if (reduced) {
      st.raise = selected ? 1 : 0
      st.angle = 0
      apply()
      return
    }
    if (selected) {
      tween.current = gsap.to(st, { raise: 1, duration: 0.5, ease: 'power2.out', onUpdate: apply })
    } else if (st.raise > 0 || st.angle !== 0) {
      const turns = Math.round(st.angle / (Math.PI * 2))
      tween.current = gsap.to(st, { raise: 0, angle: turns * Math.PI * 2, duration: 0.7, ease: 'power2.inOut', onUpdate: apply, onComplete: () => { st.angle = 0; apply() } })
    }
    return () => {
      tween.current?.kill()
    }
  }, [selected, reduced, apply])

  // el coche puede montarse después (entrada animada): reaplica la altura y el giro al llegar
  useFrame((_, dt) => {
    if (!selected || reduced) return
    const st = state.current
    if (st.raise < 0.5) return
    st.angle += Math.min(dt, 0.05) * SPIN_SPEED
    apply()
    invalidate()
  })

  return <group ref={pad} position={[x, 0, z]} visible={false} scale={[1, 0.001, 1]}>
    <mesh geometry={geometry} material={clayVertex()} receiveShadow castShadow />
  </group>
}
