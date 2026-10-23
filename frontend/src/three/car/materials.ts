/**
 * Materiales físicos del coche. Los neutros se comparten entre todos los coches; la pintura se memoriza por color
 * (LRU acotado: al expulsar un color se libera su material). El color de las pinzas sale del token --accent.
 */
import * as THREE from 'three'
import type { MatKey } from './geometry'
import type { RimStyle } from './specs'

export type CarMaterials = Record<MatKey, THREE.Material>

export interface MaterialOptions {
  accent: string
  night?: boolean
  rim?: RimStyle
}

// ───────────────────────── Textura procedural de la parrilla ─────────────────────────

let grilleTex: THREE.Texture | null = null
function grilleTexture(): THREE.Texture | null {
  if (grilleTex) return grilleTex
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#2a2e31'
  g.fillRect(0, 0, 64, 64)
  // panal de abeja: hexágonos oscuros sobre marco claro
  g.fillStyle = '#050606'
  const hex = (cx: number, cy: number, r: number) => {
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  }
  for (let row = -1; row < 4; row++) {
    for (let col = -1; col < 3; col++) {
      const cx = col * 32 + (row % 2 ? 16 : 0) + 16
      const cy = row * 18.5 + 9
      hex(cx, cy, 10.5)
    }
  }
  grilleTex = new THREE.CanvasTexture(c)
  grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping
  grilleTex.repeat.set(26, 4)
  grilleTex.colorSpace = THREE.SRGBColorSpace
  grilleTex.anisotropy = 4
  return grilleTex
}

// ───────────────────────── Materiales compartidos ─────────────────────────

const shared = new Map<string, Omit<CarMaterials, 'paint'>>()

const RIM_COLOR: Record<RimStyle, string> = {
  multi: '#d3d8dc',
  five: '#bcc3c8',
  six: '#4f565c',
  aero: '#a4acb1',
}

function sharedMaterials(opts: MaterialOptions): Omit<CarMaterials, 'paint'> {
  const key = `${opts.accent}|${opts.night ? 1 : 0}|${opts.rim ?? 'five'}`
  const hit = shared.get(key)
  if (hit) return hit
  const night = !!opts.night
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
  const phy = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)
  const m: Omit<CarMaterials, 'paint'> = {
    // Luna tintada oscura: casi negra en transmisión, pero con reflejo especular fuerte (ior de vidrio + capa de barniz)
    glass: phy({
      color: '#0b1116',
      metalness: 0,
      roughness: 0.04,
      ior: 1.52,
      specularIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: night ? 1.6 : 2.4,
    }),
    trim: phy({ color: '#060708', metalness: 0.2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }),
    chrome: std({ color: '#e6eaec', metalness: 1, roughness: 0.07 }),
    rubber: std({ color: '#141516', metalness: 0, roughness: 0.86 }),
    rim: phy({ color: RIM_COLOR[opts.rim ?? 'five'], metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
    rimDark: std({ color: '#1a1d20', metalness: 0.7, roughness: 0.45 }),
    disc: std({ color: '#8a9095', metalness: 0.95, roughness: 0.38 }),
    caliper: phy({ color: opts.accent, metalness: 0.1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    underbody: std({ color: '#0a0b0c', metalness: 0, roughness: 0.95 }),
    cladding: std({ color: '#151719', metalness: 0.05, roughness: 0.72 }),
    interior: std({ color: '#141618', metalness: 0, roughness: 0.85 }),
    bedliner: std({ color: '#111213', metalness: 0, roughness: 0.98 }),
    lightFront: std({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: night ? 3.2 : 1.25, roughness: 0.15, metalness: 0 }),
    lightRear: std({ color: '#5a0508', emissive: '#ff1a2b', emissiveIntensity: night ? 2.6 : 0.9, roughness: 0.2, metalness: 0 }),
    lens: phy({ color: '#232a2f', metalness: 0.92, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }),
    grille: std({ color: '#ffffff', map: grilleTexture(), metalness: 0.4, roughness: 0.45 }),
    engine: std({ color: '#a3aaaf', metalness: 0.85, roughness: 0.32 }),
    engineDark: std({ color: '#2d3236', metalness: 0.45, roughness: 0.5 }),
    battery: std({ color: '#262b2f', metalness: 0.1, roughness: 0.55 }),
    exhaust: std({ color: '#8d857c', metalness: 0.9, roughness: 0.42 }),
    spring: std({ color: '#b9c3ca', metalness: 0.85, roughness: 0.3 }),
    seat: std({ color: '#1c1f22', metalness: 0, roughness: 0.66 }),
  }
  shared.set(key, m)
  return m
}

// ───────────────────────── Pintura ─────────────────────────

const PAINT_LRU = 32
const paints = new Map<string, THREE.MeshPhysicalMaterial>()

function lum(hex: string) {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b // lineal
}

export function paintMaterial(hex: string): THREE.MeshPhysicalMaterial {
  const hit = paints.get(hex)
  if (hit) {
    paints.delete(hex)
    paints.set(hex, hit)
    return hit
  }
  const l = lum(hex)
  // Colores claros: perlado (poco metal); oscuros: metalizado con más reflejo
  const metalness = l > 0.45 ? 0.06 : l > 0.12 ? 0.22 : 0.3
  const m = new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness,
    roughness: l > 0.45 ? 0.3 : 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.15,
  })
  paints.set(hex, m)
  if (paints.size > PAINT_LRU) {
    const [oldKey, old] = paints.entries().next().value as [string, THREE.MeshPhysicalMaterial]
    paints.delete(oldKey)
    old.dispose()
  }
  return m
}

export function getCarMaterials(color: string, opts: MaterialOptions): CarMaterials {
  return { ...sharedMaterials(opts), paint: paintMaterial(color) }
}

// ───────────────────────── Shader fresnel (rayos X y resaltado) ─────────────────────────

const VERT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN;
varying vec3 vView;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mvPosition.xyz);
}
`

const FRAG = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFill;
uniform float uPower;
varying vec3 vN;
varying vec3 vView;
void main() {
  #include <clipping_planes_fragment>
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), uPower);
  float a = clamp((uFill + f) * uOpacity, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (0.75 + 0.6 * f), a);
  #include <colorspace_fragment>
}
`

export interface FresnelOptions {
  color: string
  opacity?: number
  fill?: number
  power?: number
  /** false ⇒ se dibuja por encima de todo (resaltado "a través" de la carrocería). */
  depthTest?: boolean
  additive?: boolean
}

export function fresnelMaterial(o: FresnelOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uOpacity: { value: o.opacity ?? 1 },
      uFill: { value: o.fill ?? 0.05 },
      uPower: { value: o.power ?? 2.2 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    side: THREE.DoubleSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    clipping: true,
  })
}
