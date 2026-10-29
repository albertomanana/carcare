/**
 * Taller 3D (chunk diferido). Maqueta de la nave con:
 *  - un elevador de dos columnas por cada `bays[i]` (numerados), con el coche de la orden (carrocería y color reales
 *    del vehículo) elevado según el estado de la orden, tira LED y baliza con el color del estado;
 *  - zona de espera con las órdenes sin elevador (máx. 8 visibles);
 *  - rótulos HTML accesibles (un botón por elevador y por orden en espera) proyectados sobre la escena.
 * Seleccionar un elevador acerca la cámara (instantáneo con movimiento reducido). Un único <Canvas>.
 */
import { useCursor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Bay, WorkOrder, WorkOrderStatus } from '@/api/types'
import { LATE, TONE_CLASSES, WORK_ORDER_STATUS } from '@/lib/status'
import type { WorkshopSceneProps } from '../types'
import { getCarBuild } from '../car/build'
import { CarModel } from '../car/CarModel'
import { BODY_SPECS, resolveBody, resolveColor } from '../car/specs'
import { mixHex } from '../color'
import { useInView, usePrefersReducedMotion, useThemeTokens, type ThemeTokens } from '../env'
import { toneColor } from '../markers/ZoneMarkerButton'
import { CameraRig, type Focus } from './CameraRig'
import { boxCorners, fitView } from './fit'
import { OverlayItem, OverlayLayer, OverlayProjector, type OverlayAnchor } from './overlay'
import { useOverlayStore, type OverlayStore } from './overlayStore'
import { StudioEnvironment } from './Stage'
import { useCanvasLabel } from './useCanvasLabel'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ───────────────────────── Distribución de la nave ─────────────────────────

const BAY_W = 4.7
const BAY_D = 7
const ROW_GAP = 1.6
const STALL_W = 2.95
const MAX_WAITING = 8
const POST_X = 1.68
const LIFT_TOP = 3.45
const WALL_H = 4.6

/** Altura del coche (m) según el estado: en reparación o esperando piezas, arriba; en diagnóstico, a media altura. */
const LIFT_HEIGHT: Record<WorkOrderStatus, number> = {
  received: 0,
  diagnosing: 0.62,
  waiting_parts: 1.4,
  in_progress: 1.4,
  ready: 0,
  delivered: 0,
  cancelled: 0,
}

interface Layout {
  bays: { number: number; x: number; z: number }[]
  stalls: { x: number; z: number; rot: number }[]
  width: number
  backZ: number
  frontZ: number
  waitingZ: number
  center: [number, number, number]
}

function computeLayout(bayNumbers: number[], nWaiting: number): Layout {
  const n = bayNumbers.length
  const cols = n <= 6 ? Math.max(1, n) : Math.ceil(n / 2)
  const rows = n <= 6 ? 1 : 2
  const bays = bayNumbers.map((number, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    return { number, x: (c - (cols - 1) / 2) * BAY_W, z: -r * (BAY_D + ROW_GAP) }
  })
  const nVis = Math.min(MAX_WAITING, nWaiting)
  const waitingZ = BAY_D / 2 + 4.5
  const stalls = Array.from({ length: nVis }, (_, k) => ({ x: (k - (nVis - 1) / 2) * STALL_W, z: waitingZ, rot: -Math.PI / 2 + 0.3 }))
  const width = Math.max(cols * BAY_W, nVis * STALL_W, 2 * BAY_W) + 2.6
  const backZ = -(rows - 1) * (BAY_D + ROW_GAP) - BAY_D / 2 - 1.1
  const frontZ = nVis ? waitingZ + 3.4 : BAY_D / 2 + 2.4
  return { bays, stalls, width, backZ, frontZ, waitingZ, center: [0, 0.9, (backZ + frontZ) / 2] }
}

// ───────────────────────── Componente público ─────────────────────────

export default function WorkshopCanvas({ bays, waiting = [], selectedBay = null, onSelectBay, onSelectOrder, className }: WorkshopSceneProps) {
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  const overlay = useOverlayStore()
  const width = useWidth(wrap)

  const sorted = useMemo(() => [...bays].sort((a, b) => a.number - b.number), [bays])
  const shown = useMemo(() => waiting.slice(0, MAX_WAITING), [waiting])
  const layout = useMemo(
    () =>
      computeLayout(
        sorted.map((b) => b.number),
        shown.length,
      ),
    [sorted, shown.length],
  )
  // Rótulos compactos si no caben ~200 px por elevador (la información completa sigue en aria-label y al seleccionar)
  const cols = sorted.length <= 6 ? Math.max(1, sorted.length) : Math.ceil(sorted.length / 2)
  const compact = width > 0 && width < Math.max(720, cols * 205)
  const spinning = !reduced && inView && sorted.some((b) => b.work_order?.status === 'in_progress')

  const occupied = sorted.filter((b) => b.work_order).length
  const label =
    `Taller 3D: ${sorted.length} ${sorted.length === 1 ? 'elevador' : 'elevadores'} (${occupied} ${occupied === 1 ? 'ocupado' : 'ocupados'}, ` +
    `${sorted.length - occupied} ${sorted.length - occupied === 1 ? 'libre' : 'libres'})` +
    (waiting.length ? ` y ${waiting.length} ${waiting.length === 1 ? 'orden' : 'órdenes'} en espera` : '')

  const selectBay = (n: number | null) => onSelectBay?.(n)
  const statuses = useMemo(() => {
    const set = new Set<WorkOrderStatus>()
    for (const b of sorted) if (b.work_order) set.add(b.work_order.status)
    for (const o of shown) set.add(o.status)
    return (Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).filter((s) => set.has(s))
  }, [sorted, shown])

  const ids = useMemo(() => [...sorted.map((b) => `bay-${b.number}`), ...shown.map((o) => `wait-${o.id}`)], [sorted, shown])

  return (
    <div ref={wrap} className={cx('relative isolate overflow-hidden', className)}>
      <Canvas
        frameloop={spinning ? 'always' : 'demand'}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, near: 0.5, far: 260, position: [10, 14, 26] }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.05
        }}
        onPointerMissed={() => {
          if (selectedBay != null) selectBay(null)
        }}
        style={{ touchAction: 'none' }}
      >
        <WorkshopWorld
          bays={sorted}
          waiting={shown}
          layout={layout}
          tokens={tokens}
          reduced={reduced}
          spinning={spinning}
          selectedBay={selectedBay}
          onSelectBay={selectBay}
          onSelectOrder={(id) => onSelectOrder?.(id)}
          label={label}
          overlay={overlay}
        />
      </Canvas>

      <OverlayLayer store={overlay} ids={ids} label="Elevadores y órdenes en espera">
        {sorted.map((b) => (
          <OverlayItem key={b.number} store={overlay} id={`bay-${b.number}`}>
            <BayLabel bay={b} selected={selectedBay === b.number} compact={compact} onSelect={selectBay} onOpen={(id) => onSelectOrder?.(id)} />
          </OverlayItem>
        ))}
        {shown.map((o) => (
          <OverlayItem key={o.id} store={overlay} id={`wait-${o.id}`}>
            <WaitingLabel order={o} compact={compact} onOpen={(id) => onSelectOrder?.(id)} />
          </OverlayItem>
        ))}
      </OverlayLayer>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        {statuses.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={cx('size-2 rounded-full', TONE_CLASSES[WORK_ORDER_STATUS[s].tone].dot)} aria-hidden />
            {WORK_ORDER_STATUS[s].label}
          </span>
        ))}
        {waiting.length > MAX_WAITING && <span className="text-fg-subtle">· En espera: se muestran {MAX_WAITING} de {waiting.length}</span>}
      </div>
    </div>
  )
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// ───────────────────────── Rótulos HTML ─────────────────────────

function vehicleText(o: WorkOrder) {
  return o.vehicle.plate ? `${o.vehicle.display_name} (${o.vehicle.plate})` : o.vehicle.display_name
}

function BayLabel({
  bay,
  selected,
  compact,
  onSelect,
  onOpen,
}: {
  bay: Bay
  selected: boolean
  compact: boolean
  onSelect: (n: number | null) => void
  onOpen: (id: number) => void
}) {
  const o = bay.work_order
  const st = o ? WORK_ORDER_STATUS[o.status] : null
  const tone = st ? TONE_CLASSES[st.tone] : null
  const Icon = st?.icon
  const aria = o
    ? `Elevador ${bay.number}: orden ${o.number}, ${vehicleText(o)}, ${st!.label}${o.is_late ? ', fuera de plazo' : ''}`
    : `Elevador ${bay.number}: libre`
  const full = !compact || selected
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={aria}
        title={aria}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(selected ? null : bay.number)
        }}
        className={cx(
          'flex flex-col items-start gap-0.5 rounded-card border px-2.5 py-1.5 text-left text-xs shadow-lg backdrop-blur-md',
          'transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          selected ? 'border-accent bg-surface text-fg ring-2 ring-accent/35' : 'border-line/70 bg-surface/85 text-fg hover:bg-surface',
        )}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-display text-xs font-semibold text-fg-subtle">{compact && !selected ? `E${bay.number}` : `Elevador ${bay.number}`}</span>
          {o ? (
            <>
              {tone && <span className={cx('size-2 rounded-full', tone.dot)} aria-hidden />}
              {full && <span className="font-medium tabular-nums">{o.number}</span>}
            </>
          ) : (
            <span className="text-fg-muted">Libre</span>
          )}
        </span>
        {o && full && (
          <span className="flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
            {st && tone && Icon && (
              <span className={cx('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium', tone.soft)}>
                <Icon className="size-3" aria-hidden strokeWidth={2.4} />
                {st.label}
              </span>
            )}
            {o.is_late && (
              <span className={cx('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium', TONE_CLASSES[LATE.tone].soft)}>
                <LATE.icon className="size-3" aria-hidden strokeWidth={2.4} />
                {LATE.label}
              </span>
            )}
            <span className="max-w-40 truncate">{o.vehicle.plate ?? o.vehicle.display_name}</span>
          </span>
        )}
        {o && selected && o.vehicle.plate && <span className="max-w-56 truncate text-fg-muted">{o.vehicle.display_name}</span>}
      </button>
      {o && selected && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen(o.id)
          }}
          className="mt-1 rounded-control bg-accent px-2.5 py-1 text-xs font-medium text-on-accent shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Abrir orden {o.number}
        </button>
      )}
      <span className="h-3 w-px bg-fg-subtle/70" aria-hidden />
    </div>
  )
}

function WaitingLabel({ order, compact, onOpen }: { order: WorkOrder; compact: boolean; onOpen: (id: number) => void }) {
  const st = WORK_ORDER_STATUS[order.status]
  const tone = TONE_CLASSES[st.tone]
  const short = order.number.split('-').pop() ?? order.number
  const aria = `En espera: orden ${order.number}, ${vehicleText(order)}, ${st.label}${order.is_late ? ', fuera de plazo' : ''}. Abrir orden`
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-label={aria}
        title={aria}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(order.id)
        }}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line/70 bg-surface/85 px-2 py-0.5 text-[11px] font-medium text-fg shadow-md backdrop-blur-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className={cx('size-1.5 rounded-full', tone.dot)} aria-hidden />
        <span className="tabular-nums">{compact ? short : order.number}</span>
        {order.is_late && <LATE.icon className="size-3 text-danger" aria-hidden />}
      </button>
      <span className="h-2 w-px bg-fg-subtle/60" aria-hidden />
    </div>
  )
}

// ───────────────────────── Escena ─────────────────────────

interface WorldProps {
  bays: Bay[]
  waiting: WorkOrder[]
  layout: Layout
  tokens: ThemeTokens
  reduced: boolean
  spinning: boolean
  selectedBay: number | null
  onSelectBay: (n: number | null) => void
  onSelectOrder: (id: number) => void
  label: string
  overlay: OverlayStore
}

interface Palette {
  slab: string
  slabEdge: string
  wall: string
  rib: string
  line: string
  post: string
  postDark: string
  windows: string
  decal: string
}

function palette(t: ThemeTokens): Palette {
  return t.light
    ? {
        slab: mixHex(t.surface3, '#b9b6ae', 0.25),
        slabEdge: mixHex(t.surface3, '#8c8a82', 0.5),
        wall: t.surface2,
        rib: mixHex(t.surface3, '#8c8a82', 0.3),
        line: t.lineStrong,
        post: '#4a5258',
        postDark: '#30363a',
        windows: '#fff7e6',
        decal: t.fgSubtle,
      }
    : {
        slab: mixHex(t.surface2, '#000000', 0.18),
        slabEdge: mixHex(t.surface, '#000000', 0.35),
        wall: mixHex(t.surface, '#000000', 0.12),
        rib: t.surface3,
        line: t.lineStrong,
        post: '#3a4247',
        postDark: '#22282c',
        windows: mixHex('#dfeaf2', t.info, 0.15),
        decal: t.fgSubtle,
      }
}

function WorkshopWorld({ bays, waiting, layout, tokens, reduced, spinning, selectedBay, onSelectBay, onSelectOrder, label, overlay }: WorldProps) {
  useCanvasLabel(label)
  const pal = useMemo(() => palette(tokens), [tokens])
  const shadowTex = useBlobTexture()

  // Encuadre calculado proyectando la caja de la nave (o del elevador elegido) con el tamaño real del lienzo
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const height = useThree((s) => s.size.height)
  const focus: Focus = useMemo(() => {
    const b = selectedBay != null ? layout.bays.find((x) => x.number === selectedBay) : null
    // margen superior para los rótulos (~70 px) e inferior para la leyenda (~30 px)
    const top = 1 - Math.min(0.5, 150 / Math.max(200, height))
    const bottom = -1 + Math.min(0.3, 64 / Math.max(200, height))
    if (b) {
      const dir: [number, number, number] = [0.42, 0.45, 1]
      const f = fitView(boxCorners([b.x - BAY_W / 2, 0, b.z - BAY_D / 2], [b.x + BAY_W / 2, LIFT_TOP + 0.5, b.z + BAY_D / 2]), dir, 30, aspect, {
        x: [-0.9, 0.9],
        y: [bottom, top],
      })
      return { target: f.target, direction: dir, distance: f.distance }
    }
    const dir: [number, number, number] = [0.5, 0.8, 1.2]
    const f = fitView(
      boxCorners([-layout.width / 2, 0, layout.backZ], [layout.width / 2, LIFT_TOP + 0.5, layout.frontZ + 1.2]),
      dir,
      30,
      aspect,
      { x: [-0.96, 0.96], y: [bottom, top] },
    )
    return { target: f.target, direction: dir, distance: f.distance }
  }, [selectedBay, layout, aspect, height])

  const anchors: OverlayAnchor[] = useMemo(() => {
    const list: OverlayAnchor[] = layout.bays.map((b) => {
      const bay = bays.find((x) => x.number === b.number)
      const sel = selectedBay === b.number
      return {
        id: `bay-${b.number}`,
        position: [b.x, LIFT_TOP + 0.5, b.z],
        pivot: 'bottom',
        priority: sel ? 10 : bay?.work_order ? 3 : 2,
        fixed: sel,
        dim: selectedBay != null && !sel,
      }
    })
    waiting.forEach((o, k) => {
      const s = layout.stalls[k]
      const h = getCarBuild(resolveBody(o.vehicle.body_type), 'low').size.height
      list.push({ id: `wait-${o.id}`, position: [s.x, h + 0.35, s.z], pivot: 'bottom', priority: 1, dim: selectedBay != null })
    })
    return list
  }, [layout, bays, waiting, selectedBay])

  return (
    <>
      <StudioEnvironment />
      <directionalLight position={[8, 14, 10]} intensity={tokens.light ? 1.1 : 0.85} />
      <ambientLight intensity={tokens.light ? 0.35 : 0.18} />
      <Hall layout={layout} pal={pal} tokens={tokens} shadowTex={shadowTex} />
      {layout.bays.map((b) => {
        const bay = bays.find((x) => x.number === b.number)!
        return (
          <Lift
            key={b.number}
            x={b.x}
            z={b.z}
            bay={bay}
            pal={pal}
            tokens={tokens}
            reduced={reduced}
            spinning={spinning}
            selected={selectedBay === b.number}
            shadowTex={shadowTex}
            onSelect={() => onSelectBay(selectedBay === b.number ? null : b.number)}
          />
        )
      })}
      {waiting.map((o, k) => (
        <WaitingCar key={o.id} order={o} stall={layout.stalls[k]} tokens={tokens} shadowTex={shadowTex} onOpen={() => onSelectOrder(o.id)} />
      ))}
      <CameraRig
        focus={focus}
        reducedMotion={reduced}
        enableRotate
        enableZoom
        minDistance={5}
        maxDistance={Math.max(70, focus.distance * 1.6)}
      />
      <OverlayProjector store={overlay} anchors={anchors} />
    </>
  )
}

// ───────────────────────── Nave ─────────────────────────

function Hall({ layout, pal, tokens, shadowTex }: { layout: Layout; pal: Palette; tokens: ThemeTokens; shadowTex: THREE.Texture | null }) {
  const { width, backZ, frontZ } = layout
  const depth = frontZ - backZ + 1.2
  const midZ = (frontZ + backZ) / 2 + 0.6
  const slab = useMemo(() => {
    const g = new RoundedBoxGeometry(width, 0.24, depth, 3, 0.1)
    g.translate(0, -0.12, midZ - 0.6 + 0.6)
    return g
  }, [width, depth, midZ])
  useEffect(() => () => slab.dispose(), [slab])

  const ribCount = Math.max(2, Math.floor(width / 1.25))
  const ribs = useMemo(() => {
    const m = new THREE.Matrix4()
    const list: THREE.Matrix4[] = []
    for (let i = 0; i <= ribCount; i++) {
      const x = -width / 2 + 0.2 + ((width - 0.4) * i) / ribCount
      list.push(m.clone().makeTranslation(x, WALL_H / 2, backZ + 0.16))
    }
    const sideLen = (frontZ - backZ) * 0.55
    const sideCount = Math.max(2, Math.floor(sideLen / 1.25))
    for (let i = 0; i <= sideCount; i++) {
      const z = backZ + 0.25 + ((sideLen - 0.3) * i) / sideCount
      list.push(m.clone().makeTranslation(-width / 2 + 0.27, WALL_H / 2, z))
    }
    return list
  }, [width, backZ, frontZ, ribCount])
  const ribRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const im = ribRef.current
    if (!im) return
    ribs.forEach((mat, i) => im.setMatrixAt(i, mat))
    im.count = ribs.length
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [ribs])

  const sideLen = (frontZ - backZ) * 0.55
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pal.line, toneMapped: false, transparent: true, opacity: 0.85 }), [pal.line])
  useEffect(() => () => lineMat.dispose(), [lineMat])

  const waitingDecal = useTextTexture('ZONA DE ESPERA', pal.decal, 0.5)
  const nStalls = layout.stalls.length

  return (
    <group>
      {/* Sombra de la maqueta sobre la página */}
      {shadowTex && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.26, midZ]} renderOrder={-2}>
          <planeGeometry args={[width * 1.35, depth * 1.35]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={tokens.light ? 0.35 : 0.7} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {/* Losa (suelo pulido) */}
      <mesh geometry={slab}>
        <meshPhysicalMaterial color={pal.slab} roughness={0.42} metalness={0.05} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>
      {/* Pared del fondo con ventanas altas y costillas; pared lateral izquierda más corta */}
      <mesh position={[0, WALL_H / 2, backZ]}>
        <boxGeometry args={[width, WALL_H, 0.22]} />
        <meshStandardMaterial color={pal.wall} roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh position={[-width / 2 + 0.11, WALL_H / 2, backZ + sideLen / 2]}>
        <boxGeometry args={[0.22, WALL_H, sideLen]} />
        <meshStandardMaterial color={pal.wall} roughness={0.8} metalness={0.05} />
      </mesh>
      <instancedMesh ref={ribRef} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[0.1, WALL_H, 0.1]} />
        <meshStandardMaterial color={pal.rib} roughness={0.6} metalness={0.3} />
      </instancedMesh>
      <mesh position={[0, WALL_H - 0.75, backZ + 0.115]}>
        <planeGeometry args={[width - 0.8, 0.42]} />
        <meshBasicMaterial color={pal.windows} toneMapped={false} transparent opacity={tokens.light ? 0.9 : 0.55} />
      </mesh>
      {/* Zócalo con la línea de acento */}
      <mesh position={[0, 0.06, backZ + 0.13]}>
        <boxGeometry args={[width, 0.12, 0.04]} />
        <meshBasicMaterial color={tokens.accent} toneMapped={false} transparent opacity={0.55} />
      </mesh>

      {/* Marcas del suelo: elevadores */}
      {layout.bays.map((b) => (
        <BayMarkings key={b.number} x={b.x} z={b.z} number={b.number} mat={lineMat} decalColor={pal.decal} />
      ))}

      {/* Pasillo y zona de espera */}
      {nStalls > 0 && (
        <group>
          {Array.from({ length: nStalls + 1 }, (_, k) => {
            const x = (k - nStalls / 2) * STALL_W
            return (
              <mesh key={k} position={[x, 0.004, layout.waitingZ]} rotation={[-Math.PI / 2, 0, 0.3]} material={lineMat}>
                <planeGeometry args={[0.06, 5]} />
              </mesh>
            )
          })}
          {waitingDecal && (
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, layout.waitingZ + 2.95]}>
              <planeGeometry args={[4.2, 0.6]} />
              <meshBasicMaterial map={waitingDecal} transparent toneMapped={false} depthWrite={false} />
            </mesh>
          )}
        </group>
      )}
      <mesh position={[0, 0.004, BAY_D / 2 + 1.0]} rotation-x={-Math.PI / 2} material={lineMat}>
        <planeGeometry args={[width - 1.2, 0.05]} />
      </mesh>
    </group>
  )
}

function BayMarkings({ x, z, number, mat, decalColor }: { x: number; z: number; number: number; mat: THREE.Material; decalColor: string }) {
  const w = BAY_W - 0.7
  const d = BAY_D - 0.6
  const num = useTextTexture(String(number), decalColor, 0.55)
  return (
    <group position={[x, 0.004, z]}>
      {[
        [0, d / 2, w, 0.06],
        [0, -d / 2, w, 0.06],
        [w / 2, 0, 0.06, d],
        [-w / 2, 0, 0.06, d],
      ].map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, 0, pz]} rotation-x={-Math.PI / 2} material={mat}>
          <planeGeometry args={[sx, sz]} />
        </mesh>
      ))}
      {num && (
        <mesh rotation-x={-Math.PI / 2} position={[w / 2 - 0.55, 0.001, d / 2 - 0.55]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshBasicMaterial map={num} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// ───────────────────────── Elevador ─────────────────────────

const postGeo = new RoundedBoxGeometry(0.28, LIFT_TOP, 0.36, 2, 0.03)
postGeo.translate(0, LIFT_TOP / 2, 0)
const beamGeo = new RoundedBoxGeometry(POST_X * 2 + 0.3, 0.2, 0.24, 2, 0.04)
const baseGeo = new RoundedBoxGeometry(0.62, 0.05, 0.7, 1, 0.02)
const carriageGeo = new RoundedBoxGeometry(0.36, 0.42, 0.44, 2, 0.03)
const armGeo = new RoundedBoxGeometry(1, 0.07, 0.11, 1, 0.02)
const padGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16)
const ledGeo = new THREE.BoxGeometry(0.03, LIFT_TOP - 0.5, 0.06)
const beaconDome = new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)
const beaconBase = new THREE.CylinderGeometry(0.1, 0.11, 0.06, 20)
const beamCone = new THREE.ConeGeometry(0.22, 1.1, 20, 1, true)
beamCone.rotateZ(-Math.PI / 2)
beamCone.translate(0.55, 0, 0)

function Lift({
  x,
  z,
  bay,
  pal,
  tokens,
  reduced,
  spinning,
  selected,
  shadowTex,
  onSelect,
}: {
  x: number
  z: number
  bay: Bay
  pal: Palette
  tokens: ThemeTokens
  reduced: boolean
  spinning: boolean
  selected: boolean
  shadowTex: THREE.Texture | null
  onSelect: () => void
}) {
  const o = bay.work_order
  const st = o ? WORK_ORDER_STATUS[o.status] : null
  const statusColor = st ? toneColor(st.tone, tokens) : null
  const ledColor = statusColor ?? mixHex(pal.postDark, '#000000', 0.2)
  const body = o ? resolveBody(o.vehicle.body_type) : null
  const color = o ? resolveColor(o.vehicle.color_hex) : null
  const build = body ? getCarBuild(body, 'low') : null
  const sill = body ? Math.min(...BODY_SPECS[body].bottomLine.map((p) => p[1])) : 0.3
  const target = o ? LIFT_HEIGHT[o.status] : 0

  const lifted = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const beam = useRef<THREE.Group>(null)
  const h = useRef(target)
  // Altura con la que se monta la parte móvil; después la anima useFrame escribiendo en el objeto (sin renders).
  // R3F compara los arrays de props elemento a elemento, así que este valor fijo no pisa la altura animada.
  const [initialY] = useState(target)
  const invalidate = useThree((s) => s.invalidate)
  const spin = spinning && o?.status === 'in_progress'

  const apply = (v: number) => {
    if (lifted.current) lifted.current.position.y = v
    if (shadow.current) {
      const k = 1 + v * 0.35
      shadow.current.scale.set(k, k, 1)
      ;(shadow.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0.18, 0.85 - v * 0.42)
    }
  }
  useEffect(() => {
    if (reduced) {
      h.current = target
      apply(target)
    }
    invalidate()
  })
  useFrame((_, dt) => {
    if (Math.abs(h.current - target) > 0.0005) {
      h.current = reduced ? target : THREE.MathUtils.damp(h.current, target, 2.4, Math.min(dt, 0.05))
      apply(h.current)
      invalidate()
    }
    if (spin && beam.current) beam.current.rotation.y += Math.min(dt, 0.05) * 4.2
  })

  const ledMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ledColor, toneMapped: false }), [ledColor])
  const beaconMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ledColor, toneMapped: false }), [ledColor])
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: statusColor ?? '#000000',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [statusColor],
  )
  useEffect(
    () => () => {
      ledMat.dispose()
      beaconMat.dispose()
      beamMat.dispose()
    },
    [ledMat, beaconMat, beamMat],
  )

  const armY = sill - 0.05
  const arms = useMemo(() => {
    const list: { pos: [number, number, number]; rotY: number; len: number; pad: [number, number, number] }[] = []
    for (const side of [1, -1]) {
      for (const dz of [0.95, -1.05]) {
        const from = new THREE.Vector2(side * (POST_X - 0.12), 0)
        const to = new THREE.Vector2(side * 0.62, dz)
        const len = from.distanceTo(to)
        const mid = from.clone().add(to).multiplyScalar(0.5)
        const rotY = -Math.atan2(to.y - from.y, to.x - from.x)
        list.push({ pos: [mid.x, 0, mid.y], rotY, len, pad: [to.x, 0.05, to.y] })
      }
    }
    return list
  }, [])

  const [hover, setHover] = useState(false)
  const gl = useThree((s) => s.gl)
  useCursor(hover, 'pointer', '', gl.domElement)

  return (
    <group position={[x, 0, z]}>
      {/* Columnas, travesaño y bases */}
      {[1, -1].map((side) => (
        <group key={side} position={[side * POST_X, 0, 0]}>
          <mesh geometry={baseGeo} position={[0, 0.025, 0]}>
            <meshStandardMaterial color={pal.postDark} roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh geometry={postGeo}>
            <meshStandardMaterial color={pal.post} roughness={0.38} metalness={0.55} />
          </mesh>
          {/* Tira LED en la cara interior con el color del estado */}
          <mesh geometry={ledGeo} material={ledMat} position={[-side * 0.15, LIFT_TOP / 2 + 0.05, 0]} />
        </group>
      ))}
      <mesh geometry={beamGeo} position={[0, LIFT_TOP + 0.1, 0]}>
        <meshStandardMaterial color={pal.post} roughness={0.38} metalness={0.55} />
      </mesh>
      {/* Baliza */}
      <group position={[-POST_X, LIFT_TOP + 0.23, 0]}>
        <mesh geometry={beaconBase}>
          <meshStandardMaterial color={pal.postDark} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh geometry={beaconDome} material={beaconMat} position={[0, 0.03, 0]} />
        {spin && (
          <group ref={beam} position={[0, 0.07, 0]}>
            <mesh geometry={beamCone} material={beamMat} />
            <mesh geometry={beamCone} material={beamMat} rotation-y={Math.PI} />
          </group>
        )}
      </group>

      {/* Sombra difusa del coche */}
      {shadowTex && build && (
        <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
          <planeGeometry args={[build.size.width * 1.55, build.size.length * 1.2]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {/* Parte móvil: carros, brazos y coche */}
      <group ref={lifted} position={[0, initialY, 0]}>
        {[1, -1].map((side) => (
          <mesh key={side} geometry={carriageGeo} position={[side * POST_X, armY + 0.12, 0]}>
            <meshStandardMaterial color={pal.postDark} roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
        {arms.map((a, i) => (
          <group key={i} position={[a.pos[0], armY, a.pos[2]]}>
            <mesh geometry={armGeo} rotation-y={a.rotY} scale={[a.len, 1, 1]}>
              <meshStandardMaterial color={pal.post} roughness={0.4} metalness={0.55} />
            </mesh>
          </group>
        ))}
        {arms.map((a, i) => (
          <mesh key={`p${i}`} geometry={padGeo} position={[a.pad[0], armY + 0.05, a.pad[2]]}>
            <meshStandardMaterial color="#111315" roughness={0.9} />
          </mesh>
        ))}
        {o && body && color && (
          <group rotation-y={-Math.PI / 2}>
            <CarModel body={body} color={color} accent={tokens.accent} detail="low" />
          </group>
        )}
      </group>

      {/* Zona de clic del elevador completo (invisible) */}
      <mesh
        position={[0, 1.6, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[BAY_W - 0.6, 3.6, BAY_D - 0.8]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      {selected && <SelectionRing tokens={tokens} />}
    </group>
  )
}

function SelectionRing({ tokens }: { tokens: ThemeTokens }) {
  const w = BAY_W - 0.7
  const d = BAY_D - 0.6
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: tokens.accent, toneMapped: false }), [tokens.accent])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group position={[0, 0.008, 0]}>
      {[
        [0, d / 2, w + 0.1, 0.1],
        [0, -d / 2, w + 0.1, 0.1],
        [w / 2, 0, 0.1, d],
        [-w / 2, 0, 0.1, d],
      ].map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, 0, pz]} rotation-x={-Math.PI / 2} material={mat}>
          <planeGeometry args={[sx, sz]} />
        </mesh>
      ))}
    </group>
  )
}

function WaitingCar({
  order,
  stall,
  tokens,
  shadowTex,
  onOpen,
}: {
  order: WorkOrder
  stall: { x: number; z: number; rot: number }
  tokens: ThemeTokens
  shadowTex: THREE.Texture | null
  onOpen: () => void
}) {
  const body = resolveBody(order.vehicle.body_type)
  const color = resolveColor(order.vehicle.color_hex)
  const build = getCarBuild(body, 'low')
  return (
    <group position={[stall.x, 0, stall.z]} rotation-y={stall.rot}>
      {shadowTex && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
          <planeGeometry args={[build.size.length * 1.2, build.size.width * 1.55]} />
          <meshBasicMaterial map={shadowTex} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <CarModel body={body} color={color} accent={tokens.accent} detail="low" />
      <mesh
        position={[0, 0.8, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        <boxGeometry args={[build.size.length, 1.6, build.size.width]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ───────────────────────── Texturas procedurales ─────────────────────────

/** Degradado radial negro → transparente (sombras difusas sin render extra). */
function useBlobTexture(): THREE.Texture | null {
  const tex = useMemo(() => {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    if (!g) return null
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64)
    grad.addColorStop(0, 'rgba(0,0,0,0.85)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.42)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

/** Texto pintado en el suelo (números de elevador, "ZONA DE ESPERA") con la tipografía de la app. */
function useTextTexture(text: string, color: string, opacity: number): THREE.Texture | null {
  const tex = useMemo(() => {
    if (typeof document === 'undefined') return null
    const square = text.length <= 2
    const c = document.createElement('canvas')
    c.width = square ? 256 : 1024
    c.height = square ? 256 : 146
    const g = c.getContext('2d')
    if (!g) return null
    g.clearRect(0, 0, c.width, c.height)
    g.globalAlpha = opacity
    g.fillStyle = color
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `600 ${square ? 200 : 104}px "Space Grotesk Variable", "Inter Variable", system-ui, sans-serif`
    if (!square) (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '10px'
    g.fillText(text, c.width / 2, c.height / 2 + (square ? 8 : 4))
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [text, color, opacity])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}
