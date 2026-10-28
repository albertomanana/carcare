import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { BodyType, Zone } from '@/api/types'
import { getCarBuild } from './build'
import type { Detail, MatKey } from './geometry'
import { fresnelMaterial, getCarMaterials } from './materials'
import { BODY_SPECS } from './specs'

/** En rayos X estas piezas se ven sólidas (el resto de la carrocería pasa a "fantasma"). */
const SOLID_IN_XRAY = new Set<MatKey>(['disc', 'caliper', 'engine', 'engineDark', 'battery', 'exhaust', 'spring'])
const HIDDEN_IN_XRAY = new Set<MatKey>(['underbody', 'interior', 'bedliner'])

export interface CarModelProps {
  body: BodyType
  color: string
  accent: string
  detail?: Detail
  night?: boolean
  xray?: boolean
  /** Color del "fantasma" de rayos X (token --info). */
  ghostColor?: string
  highlight?: { zone: Zone; color: string; pulse: boolean } | null
  /**
   * Recorte (portada): la parte sólida y la de rayos X se reparten el coche con dos planos.
   * `ghost: null` ⇒ solo se dibuja la parte sólida recortada (cortinilla entre dos coches).
   * Los planos pueden moverse en cada fotograma (se leen al pintar); los materiales se clonan una vez por plano.
   */
  clip?: { solid: THREE.Plane; ghost: THREE.Plane | null } | null
  onClick?: (e: { point: THREE.Vector3; stopPropagation: () => void }) => void
}

export function CarModel({
  body,
  color,
  accent,
  detail = 'high',
  night = false,
  xray = false,
  ghostColor = '#7cc4fa',
  highlight = null,
  clip = null,
  onClick,
}: CarModelProps) {
  const build = useMemo(() => getCarBuild(body, detail), [body, detail])
  const baseMats = useMemo(() => getCarMaterials(color, { accent, night, rim: BODY_SPECS[body].rim }), [color, accent, night, body])

  // Con recorte, materiales propios (clonados) para no afectar a los compartidos
  const clipSolid = clip?.solid ?? null
  const clipGhost = clip?.ghost ?? null
  const mats = useMemo(() => {
    if (!clipSolid) return baseMats
    const out = {} as Record<MatKey, THREE.Material>
    for (const k of Object.keys(baseMats) as MatKey[]) {
      const m = baseMats[k].clone()
      m.clippingPlanes = [clipSolid]
      out[k] = m
    }
    return out
  }, [baseMats, clipSolid])
  useEffect(() => {
    if (mats === baseMats) return
    return () => Object.values(mats).forEach((m) => m.dispose())
  }, [mats, baseMats])

  const ghost = useMemo(() => {
    const m = fresnelMaterial({ color: ghostColor, opacity: 0.85, fill: 0.035, power: 2.4 })
    if (clipGhost) m.clippingPlanes = [clipGhost]
    return m
  }, [ghostColor, clipGhost])
  useEffect(() => () => ghost.dispose(), [ghost])

  const internalsMats = useMemo(() => {
    if (!clipGhost) return baseMats
    const out = {} as Record<MatKey, THREE.Material>
    for (const k of Object.keys(baseMats) as MatKey[]) {
      const m = baseMats[k].clone()
      m.clippingPlanes = [clipGhost]
      out[k] = m
    }
    return out
  }, [baseMats, clipGhost])
  useEffect(() => {
    if (internalsMats === baseMats) return
    return () => Object.values(internalsMats).forEach((m) => m.dispose())
  }, [internalsMats, baseMats])

  const hl = useMemo(
    () => (highlight ? fresnelMaterial({ color: highlight.color, opacity: 1, fill: 0.22, power: 1.6, depthTest: false }) : null),
    [highlight],
  )
  useEffect(() => () => hl?.dispose(), [hl])

  // Pulso del resaltado (solo si se permite animación): dos latidos y se queda fijo, para que el lienzo
  // ("demand") deje de pintarse en vez de quedarse a 60 fps mientras haya una zona seleccionada.
  const invalidate = useThree((s) => s.invalidate)
  const pulseFrom = useRef<number | null>(null)
  useEffect(() => {
    pulseFrom.current = null
  }, [hl])
  useFrame(({ clock }) => {
    if (!hl || !highlight?.pulse) return
    const t = clock.getElapsedTime()
    if (pulseFrom.current === null) pulseFrom.current = t
    const e = t - pulseFrom.current
    const u = hl.uniforms.uOpacity as { value: number }
    if (e >= PULSE_SECONDS) {
      // último fotograma: deja la opacidad en 1 (aunque un fotograma lento se haya saltado el final) y para
      if (u.value !== 1) {
        u.value = 1
        invalidate()
      }
      return
    }
    u.value = 0.72 + 0.28 * Math.cos(e * PULSE_RATE)
    invalidate()
  })

  // Cajas invisibles para el clic (el raycasting sobre la malla real sería caro)
  const proxy = useMemo(() => {
    const sh = build.shape
    const { length, width } = build.size
    const lowTop = Math.max(...sh.top.samples.map((p) => p[1]))
    const lower = { position: [(sh.front + sh.rear) / 2, lowTop / 2 + 0.05, 0] as [number, number, number], size: [length, lowTop - 0.1, width] as [number, number, number] }
    const cabin =
      sh.ghRange && sh.roof
        ? {
            position: [(sh.ghRange[0] + sh.ghRange[1]) / 2, (lowTop + build.size.height) / 2, 0] as [number, number, number],
            size: [(sh.ghRange[1] - sh.ghRange[0]) * 0.8, build.size.height - lowTop, width * 0.8] as [number, number, number],
          }
        : null
    return { lower, cabin }
  }, [build])

  const showGhost = xray || !!clipGhost
  const showSolid = !xray || !!clipSolid

  return (
    <group
      onClick={
        onClick
          ? (e) => {
              onClick({ point: e.point, stopPropagation: () => e.stopPropagation() })
            }
          : undefined
      }
    >
      {showSolid &&
        build.parts.map((p) => (
          <mesh key={`s-${p.mat}`} geometry={p.geometry} material={mats[p.mat]} raycast={noRaycast} />
        ))}
      {showGhost &&
        build.parts.map((p) => {
          if (HIDDEN_IN_XRAY.has(p.mat)) return null
          if (SOLID_IN_XRAY.has(p.mat)) {
            // discos y pinzas se ven sólidos a través de la carrocería fantasma (con recorte, solo en la parte de rayos X)
            return <mesh key={`x-${p.mat}`} geometry={p.geometry} material={clipGhost ? internalsMats[p.mat] : mats[p.mat]} raycast={noRaycast} />
          }
          return <mesh key={`g-${p.mat}`} geometry={p.geometry} material={ghost} renderOrder={2} raycast={noRaycast} />
        })}
      {showGhost &&
        build.xrayParts.map((p) => (
          <mesh key={`i-${p.mat}`} geometry={p.geometry} material={clipGhost ? internalsMats[p.mat] : mats[p.mat]} raycast={noRaycast} />
        ))}
      {/* invisibles: el raycaster de three.js no mira `visible`, así que reciben el clic sin gastar dos dibujados */}
      {onClick && (
        <>
          <mesh position={proxy.lower.position} material={PROXY_MAT} visible={false}>
            <boxGeometry args={proxy.lower.size} />
          </mesh>
          {proxy.cabin && (
            <mesh position={proxy.cabin.position} material={PROXY_MAT} visible={false}>
              <boxGeometry args={proxy.cabin.size} />
            </mesh>
          )}
        </>
      )}
      {hl &&
        highlight &&
        build.highlight[highlight.zone].map((g, i) => (
          <mesh key={`h-${highlight.zone}-${i}`} geometry={g} material={hl} renderOrder={10} raycast={noRaycast} />
        ))}
    </group>
  )
}

const PROXY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
/** Pulso del resaltado: 2 latidos (~4 s; con coseno empieza y acaba en el máximo) y se queda a opacidad 1. */
const PULSE_RATE = 3.2
const PULSE_SECONDS = (2 * 2 * Math.PI) / PULSE_RATE

function noRaycast() {
  /* las mallas visibles no participan en el raycasting (se usa una caja proxy) */
}
