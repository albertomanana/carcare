/**
 * Visor del vehículo (chunk diferido). Un único <Canvas>:
 *  - showcase: coche protagonista con autorrotación lenta (sin marcadores) mientras se ve.
 *  - inspect: órbita + 10 marcadores HTML accesibles; al seleccionar, vuelo de cámara y resaltado de la pieza.
 *  - xray: carrocería "fantasma" con componentes internos simplificados (rótulo "Ilustrativo").
 * Rendimiento: frameloop "demand" (solo se pinta cuando algo cambia: órbita, vuelo de cámara, pulso de la selección),
 * salvo el giro del escaparate; "never" con la pestaña oculta; DPR ≤ 1,5; recursos liberados al desmontar.
 */
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Zone, ZoneStatus } from '@/api/types'
import type { CarViewerProps } from '../types'
import { getCarLayout, type ZoneAnchor } from '../car/anchors'
import { getCarBuild } from '../car/build'
import { CarModel } from '../car/CarModel'
import { resolveBody, resolveColor } from '../car/specs'
import { useInView, usePageVisible, usePrefersReducedMotion, useThemeTokens, type ThemeTokens } from '../env'
import { toneColor, ZONE_DISCLAIMER, ZoneMarkerButton, zoneTone } from '../markers/ZoneMarkerButton'
import { OverlayItem, OverlayLayer, OverlayProjector, useOverlayStore, type OverlayAnchor, type OverlayStore } from './overlay'
import { CameraRig, type Focus } from './CameraRig'
import { CarShadow, StudioEnvironment, StudioFloor } from './Stage'
import { ReleaseOnUnmount, ResumeOnVisible, XrayBadge } from './common'
import { canvasDpr } from './dpr'
import { useCanvasLabel } from './useCanvasLabel'

export default function CarViewerCanvas({
  appearance,
  mode = 'showcase',
  zones,
  selectedZone = null,
  onSelectZone,
  xray = false,
  lighting = 'studio',
  className,
  ariaLabel,
}: CarViewerProps) {
  const body = resolveBody(appearance.bodyType)
  const color = resolveColor(appearance.colorHex)
  const tokens = useThemeTokens()
  const reduced = usePrefersReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const inView = useInView(wrap)
  const pageVisible = usePageVisible()
  const dpr = useMemo(canvasDpr, [])
  const inspect = mode === 'inspect'
  const night = lighting === 'night'
  const animate = mode === 'showcase' && !reduced && inView
  const label = ariaLabel ?? (inspect ? 'Modelo 3D del vehículo con zonas de mantenimiento' : 'Modelo 3D del vehículo')
  const finePointer = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches, [])
  const overlay = useOverlayStore()
  const markerZones = inspect && zones ? zones : []
  const select = (z: Zone | null) => onSelectZone?.(z)

  return (
    <div ref={wrap} className={['relative isolate overflow-hidden', className].filter(Boolean).join(' ')}>
      <Canvas
        frameloop={!pageVisible ? 'never' : animate ? 'always' : 'demand'}
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 24, near: 0.1, far: 80, position: [7, 3, 7] }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = night ? 1.05 : 1.1
        }}
        onPointerMissed={() => {
          if (inspect && selectedZone) onSelectZone?.(null)
        }}
        style={{ touchAction: inspect || finePointer ? 'none' : 'pan-y' }}
      >
        <ReleaseOnUnmount />
        <ResumeOnVisible visible={pageVisible} />
        <ViewerScene
          body={body}
          color={color}
          tokens={tokens}
          reduced={reduced}
          inspect={inspect}
          night={night}
          xray={xray}
          zones={inspect ? zones : undefined}
          selectedZone={inspect ? selectedZone : null}
          onSelectZone={onSelectZone}
          interactive={inspect || finePointer}
          label={label}
          overlay={overlay}
        />
      </Canvas>
      {markerZones.length > 0 && (
        <OverlayLayer store={overlay} ids={markerZones.map((z) => z.zone)} label="Zonas del vehículo">
          {markerZones.map((z) => (
            <OverlayItem key={z.zone} store={overlay} id={z.zone}>
              <ZoneMarkerButton status={z} selected={z.zone === selectedZone} tokens={tokens} onSelect={select} />
            </OverlayItem>
          ))}
        </OverlayLayer>
      )}
      {xray && <XrayBadge />}
      {inspect && zones && zones.length > 0 && (
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-fg-subtle">Colores {ZONE_DISCLAIMER}</p>
      )}
    </div>
  )
}

interface SceneProps {
  body: ReturnType<typeof resolveBody>
  color: string
  tokens: ThemeTokens
  reduced: boolean
  inspect: boolean
  night: boolean
  xray: boolean
  zones?: ZoneStatus[]
  selectedZone: Zone | null
  onSelectZone?: (z: Zone | null) => void
  interactive: boolean
  label: string
  overlay: OverlayStore
}

/** Urgencia para el desapilado: el más urgente conserva su sitio. */
const URGENCY: Record<string, number> = { danger: 5, warning: 4, ok: 3, info: 2, neutral: 1 }

function ViewerScene({ body, color, tokens, reduced, inspect, night, xray, zones, selectedZone, onSelectZone, interactive, label, overlay }: SceneProps) {
  useCanvasLabel(label)
  const layout = getCarLayout(body)
  const build = getCarBuild(body, 'high')
  const anchors = layout.anchors

  const focus: Focus = useMemo(() => {
    if (inspect && selectedZone) {
      const a = anchors[selectedZone]
      return { target: a.target, direction: a.direction, distance: a.distance }
    }
    return { target: layout.framing.target, direction: layout.framing.direction, distance: layout.framing.distance }
  }, [inspect, selectedZone, anchors, layout])

  const selectedStatus = zones?.find((z) => z.zone === selectedZone) ?? null
  const highlight = useMemo(() => {
    if (!selectedZone) return null
    const tone = selectedStatus ? zoneTone(selectedStatus) : 'accent'
    return { zone: selectedZone, color: toneColor(tone === 'neutral' ? 'info' : tone, tokens), pulse: !reduced }
  }, [selectedZone, selectedStatus, tokens, reduced])

  const floorColor = night ? tokens.base : tokens.light ? tokens.surface3 : tokens.surface2

  const markerAnchors: OverlayAnchor[] = useMemo(
    () =>
      (zones ?? []).map((z) => {
        const a = anchors[z.zone]
        const top = z.zone === 'general' || z.zone === 'engine'
        const sel = z.zone === selectedZone
        return {
          id: z.zone,
          position: a.position,
          pivot: 'icon' as const,
          priority: (sel ? 10 : 0) + (URGENCY[zoneTone(z)] ?? 0),
          fixed: sel,
          dim: !!selectedZone && !sel,
          facing: top ? null : ([a.direction[0], 0, a.direction[2]] as [number, number, number]),
        }
      }),
    [zones, anchors, selectedZone],
  )

  return (
    <>
      <StudioEnvironment key={night ? 'night' : 'studio'} night={night} accent={tokens.accent} info={tokens.info} />
      <CarModel
        body={body}
        color={color}
        accent={tokens.accent}
        night={night}
        xray={xray}
        ghostColor={tokens.info}
        highlight={highlight}
        onClick={
          inspect && zones?.length
            ? (e) => {
                e.stopPropagation()
                const z = nearestZone(e.point, anchors, zones)
                if (z) onSelectZone?.(z)
              }
            : undefined
        }
      />
      {night && <HeadlightBeams body={body} />}
      <StudioFloor color={floorColor} night={night} strength={tokens.light ? 0.6 : 1} />
      <CarShadow key={body} length={build.size.length} width={build.size.width} opacity={tokens.light ? 0.55 : 0.8} />
      <CameraRig
        focus={focus}
        reducedMotion={reduced}
        autoRotate={!inspect}
        enableRotate={interactive}
        enableZoom={inspect}
        minDistance={1.6}
        maxDistance={16}
        fitWidth={!selectedZone ? layout.framing.length * 1.12 : undefined}
      />
      {zones && zones.length > 0 && <OverlayProjector store={overlay} anchors={markerAnchors} />}
    </>
  )
}

function nearestZone(p: THREE.Vector3, anchors: Record<Zone, ZoneAnchor>, zones: ZoneStatus[]): Zone | null {
  let best: Zone | null = null
  let bd = Infinity
  for (const z of zones) {
    if (z.zone === 'general') continue
    const a = anchors[z.zone].position
    const d = Math.hypot(p.x - a[0], p.y - a[1], p.z - a[2])
    if (d < bd) {
      bd = d
      best = z.zone
    }
  }
  return bd < 1.1 ? best : null
}

/** De noche: conos de luz de los faros sobre el suelo. */
function HeadlightBeams({ body }: { body: ReturnType<typeof resolveBody> }) {
  const s = getCarBuild(body, 'high').shape
  const scene = useThree((st) => st.scene)
  const lights = useMemo(() => {
    const out: THREE.SpotLight[] = []
    for (const side of [1, -1]) {
      const l = new THREE.SpotLight('#eaf3ff', 36, 14, 0.42, 0.85, 1.6)
      l.position.set(s.front - 0.15, s.spec.headlightY, side * s.halfWidth * 0.62)
      l.target.position.set(s.front + 5, 0, side * s.halfWidth * 1.2)
      out.push(l)
    }
    return out
  }, [s])
  useEffect(() => {
    for (const l of lights) {
      scene.add(l)
      scene.add(l.target)
    }
    return () => {
      for (const l of lights) {
        scene.remove(l)
        scene.remove(l.target)
        l.dispose()
      }
    }
  }, [lights, scene])
  return null
}
