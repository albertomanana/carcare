/**
 * Especificación paramétrica de cada carrocería (metros). Sin three.js: la comparten el 3D y la silueta SVG.
 *
 * Ejes: x = longitud (morro en +x, centro de la batalla en x = 0), y = altura (suelo en 0), z = anchura.
 * Los perfiles se definen de la trasera al morro. Formas genéricas propias: ninguna reproduce un modelo comercial.
 */
import type { BodyType } from '@/api/types'
import type { ProfilePoint } from './profile'

export type RimStyle = 'multi' | 'five' | 'six' | 'aero'

export interface BodySpec {
  type: BodyType
  /** Nombre en español para textos alternativos. */
  label: string
  length: number
  width: number
  wheelbase: number
  frontOverhang: number
  wheelRadius: number
  tireWidth: number
  /** Radio de llanta / radio de rueda. */
  rimRatio: number
  /** Holgura del paso de rueda (radio del paso = radio de rueda + archGap). */
  archGap: number
  /** Exponente de la forma del paso (2 = circular, >2 más cuadrado). */
  archShape: number

  /** Línea superior de la carrocería baja (maletero → cintura → capó). */
  topLine: ProfilePoint[]
  /** Línea inferior (paragolpes y estribo), sin pasos de rueda. */
  bottomLine: ProfilePoint[]
  /** Línea del techo del habitáculo; null = descapotable (sin techo). */
  roofLine: ProfilePoint[] | null
  /** x donde termina el parabrisas (arriba) y empieza el techo. */
  windshieldTopX: number
  /** x donde termina el techo y empieza la luna trasera. */
  rearGlassTopX: number
  /** Si la luna trasera solo ocupa una banda de alturas (furgoneta: ventanillas de puertas traseras). */
  rearGlassBand?: [number, number]

  /** Ventanillas laterales (DLO): extremos en x y pendientes de sus bordes. */
  dlo: {
    front: number
    rear: number
    frontSlope: number
    rearSlope: number
    /** Montantes negros (B, C…) en x. */
    pillars: number[]
  } | null

  /** Redondeo en planta: [longitud de la zona redondeada, exponente]. */
  planFront: [number, number]
  planRear: [number, number]

  /** Retranqueo del habitáculo respecto al hombro y caída de las lunas (m por m de altura). */
  ghInset: number
  tumble: number
  ghCorner: number
  roofCrown: number

  /** Línea de hombro (bajo la cintura) y metidas superior/inferior del costado. */
  shoulderDrop: number
  tuckTop: number
  tuckBottom: number
  rTop: number
  rBottom: number
  hoodCrown: number
  /** Ensanche de las aletas sobre las ruedas. */
  flare: number

  /** Juntas de puertas en x. */
  doors: number[]
  /** Altura de los plásticos negros inferiores (SUV, pick-up). */
  cladding?: number
  bed?: { from: number; to: number; depth: number; wall: number }
  cockpit?: { from: number; to: number; depth: number; wall: number }
  /** Parabrisas suelto del descapotable: base (x) y borde superior (x, y). */
  openWindshield?: { baseX: number; topX: number; topY: number }
  roofRails?: boolean
  rim: RimStyle
  headlightY: number
  taillightY: number
  /** Asientos: x del delantero y del trasero (null = biplaza). */
  seats: { frontX: number; rearX: number | null }
}

/**
 * Compacto de 5 puertas (segmento B/C): voladizo trasero corto, techo que cae hacia el portón, luna trasera inclinada
 * y montante C grueso (la ventanilla trasera acaba en cuña, sin luneta lateral). Así no se confunde con un familiar.
 */
const hatchback: BodySpec = {
  type: 'hatchback',
  label: 'Compacto',
  length: 4.06,
  width: 1.78,
  wheelbase: 2.56,
  frontOverhang: 0.8,
  wheelRadius: 0.325,
  tireWidth: 0.215,
  rimRatio: 0.63,
  archGap: 0.045,
  archShape: 2.2,
  topLine: [
    [-1.98, 0.86],
    [-1.962, 0.97, 0.05],
    [-1.885, 1.02, 0.12],
    [-1.25, 1.01],
    [0.35, 0.965],
    [0.88, 0.945, 0.35],
    [1.8, 0.85, 0.35],
    [2.035, 0.75, 0.1],
    [2.08, 0.65],
  ],
  bottomLine: [
    [-1.98, 0.47],
    [-1.9, 0.3, 0.1],
    [-1.66, 0.26],
    [1.72, 0.245],
    [2.0, 0.3, 0.1],
    [2.08, 0.42],
  ],
  roofLine: [
    [-1.93, 0.99],
    [-1.7, 1.37, 0.14],
    [-1.42, 1.425, 0.4],
    [-0.35, 1.455],
    [0.08, 1.43, 0.35],
    [0.93, 0.93],
  ],
  windshieldTopX: 0.0,
  rearGlassTopX: -1.6,
  dlo: { front: 0.82, rear: -1.22, frontSlope: 1.2, rearSlope: 0.62, pillars: [-0.36] },
  planFront: [0.52, 2.6],
  planRear: [0.34, 3.2],
  ghInset: 0.08,
  tumble: 0.3,
  ghCorner: 0.07,
  roofCrown: 0.035,
  shoulderDrop: 0.17,
  tuckTop: 0.03,
  tuckBottom: 0.055,
  rTop: 0.09,
  rBottom: 0.05,
  hoodCrown: 0.03,
  flare: 0.016,
  doors: [0.84, -0.33, -1.08],
  rim: 'five',
  headlightY: 0.62,
  taillightY: 0.92,
  seats: { frontX: -0.42, rearX: -1.22 },
}

const sedan: BodySpec = {
  type: 'sedan',
  label: 'Berlina',
  length: 4.72,
  width: 1.83,
  wheelbase: 2.83,
  frontOverhang: 0.93,
  wheelRadius: 0.335,
  tireWidth: 0.235,
  rimRatio: 0.64,
  archGap: 0.045,
  archShape: 2.2,
  topLine: [
    [-2.375, 0.84],
    [-2.335, 0.97, 0.08],
    [-2.2, 1.015, 0.25],
    [-1.6, 1.0],
    [0.3, 0.975],
    [1.05, 0.95, 0.35],
    [2.02, 0.84, 0.35],
    [2.3, 0.73, 0.1],
    [2.345, 0.64],
  ],
  bottomLine: [
    [-2.375, 0.44],
    [-2.27, 0.29, 0.1],
    [-2.0, 0.25],
    [2.0, 0.235],
    [2.27, 0.29, 0.1],
    [2.345, 0.4],
  ],
  roofLine: [
    [-1.95, 0.98],
    [-1.3, 1.37, 0.4],
    [-0.9, 1.44, 0.45],
    [-0.1, 1.445],
    [0.22, 1.42, 0.35],
    [1.1, 0.93],
  ],
  windshieldTopX: 0.12,
  rearGlassTopX: -1.05,
  dlo: { front: 0.98, rear: -1.62, frontSlope: 1.2, rearSlope: 0.75, pillars: [-0.26] },
  planFront: [0.58, 2.6],
  planRear: [0.4, 3],
  ghInset: 0.085,
  tumble: 0.3,
  ghCorner: 0.07,
  roofCrown: 0.035,
  shoulderDrop: 0.17,
  tuckTop: 0.03,
  tuckBottom: 0.055,
  rTop: 0.09,
  rBottom: 0.05,
  hoodCrown: 0.03,
  flare: 0.012,
  doors: [1.0, -0.24, -1.25],
  rim: 'multi',
  headlightY: 0.6,
  taillightY: 0.9,
  seats: { frontX: -0.3, rearX: -1.2 },
}

const wagon: BodySpec = {
  ...sedan,
  type: 'wagon',
  label: 'Familiar',
  topLine: [
    [-2.375, 0.86],
    [-2.355, 0.97, 0.05],
    [-2.27, 1.01, 0.12],
    [-1.6, 1.01],
    [0.3, 0.975],
    [1.05, 0.95, 0.35],
    [2.02, 0.84, 0.35],
    [2.3, 0.73, 0.1],
    [2.345, 0.64],
  ],
  roofLine: [
    [-2.33, 0.98],
    [-2.24, 1.34, 0.08],
    [-2.0, 1.45, 0.3],
    [-0.1, 1.475],
    [0.22, 1.45, 0.35],
    [1.1, 0.93],
  ],
  rearGlassTopX: -2.06,
  dlo: { front: 0.98, rear: -2.05, frontSlope: 1.2, rearSlope: 2.2, pillars: [-0.26, -1.32] },
  doors: [1.0, -0.24, -1.25],
  roofRails: true,
  rim: 'five',
  taillightY: 0.92,
  seats: { frontX: -0.3, rearX: -1.2 },
}

const suv: BodySpec = {
  type: 'suv',
  label: 'SUV',
  length: 4.62,
  width: 1.89,
  wheelbase: 2.76,
  frontOverhang: 0.93,
  wheelRadius: 0.375,
  tireWidth: 0.245,
  rimRatio: 0.6,
  archGap: 0.05,
  archShape: 2.8,
  topLine: [
    [-2.31, 1.02],
    [-2.29, 1.13, 0.05],
    [-2.2, 1.165, 0.12],
    [-1.5, 1.17],
    [0.6, 1.14],
    [1.1, 1.12, 0.35],
    [2.05, 1.03, 0.4],
    [2.27, 0.93, 0.1],
    [2.31, 0.81],
  ],
  bottomLine: [
    [-2.31, 0.58],
    [-2.15, 0.42, 0.12],
    [-1.9, 0.4],
    [1.9, 0.39],
    [2.2, 0.45, 0.12],
    [2.31, 0.55],
  ],
  roofLine: [
    [-2.27, 1.14],
    [-2.17, 1.57, 0.08],
    [-1.95, 1.68, 0.3],
    [-0.1, 1.7],
    [0.25, 1.67, 0.4],
    [1.17, 1.12],
  ],
  windshieldTopX: 0.14,
  rearGlassTopX: -2.0,
  dlo: { front: 1.05, rear: -1.98, frontSlope: 1.2, rearSlope: 1.6, pillars: [-0.22, -1.3] },
  planFront: [0.55, 3],
  planRear: [0.36, 3.4],
  ghInset: 0.085,
  tumble: 0.26,
  ghCorner: 0.075,
  roofCrown: 0.035,
  shoulderDrop: 0.2,
  tuckTop: 0.03,
  tuckBottom: 0.05,
  rTop: 0.1,
  rBottom: 0.06,
  hoodCrown: 0.03,
  flare: 0.02,
  doors: [1.04, -0.2, -1.32],
  cladding: 0.53,
  roofRails: true,
  rim: 'six',
  headlightY: 0.78,
  taillightY: 1.06,
  seats: { frontX: -0.25, rearX: -1.2 },
}

const coupe: BodySpec = {
  type: 'coupe',
  label: 'Coupé',
  length: 4.55,
  width: 1.86,
  wheelbase: 2.7,
  frontOverhang: 0.98,
  wheelRadius: 0.34,
  tireWidth: 0.255,
  rimRatio: 0.68,
  archGap: 0.04,
  archShape: 2.1,
  topLine: [
    [-2.22, 0.8],
    [-2.19, 0.92, 0.05],
    [-2.06, 0.965, 0.15],
    [-1.5, 0.95],
    [0.2, 0.92],
    [1.0, 0.885, 0.35],
    [2.0, 0.76, 0.4],
    [2.28, 0.64, 0.1],
    [2.33, 0.56],
  ],
  bottomLine: [
    [-2.22, 0.4],
    [-2.1, 0.25, 0.1],
    [-1.9, 0.22],
    [2.0, 0.2],
    [2.25, 0.24, 0.1],
    [2.33, 0.34],
  ],
  roofLine: [
    [-2.0, 0.94],
    [-1.0, 1.24, 0.6],
    [-0.45, 1.315, 0.45],
    [0.0, 1.32],
    [0.25, 1.3, 0.3],
    [1.16, 0.875],
  ],
  windshieldTopX: 0.18,
  rearGlassTopX: -0.55,
  dlo: { front: 1.05, rear: -1.25, frontSlope: 1.0, rearSlope: 0.55, pillars: [] },
  planFront: [0.6, 2.4],
  planRear: [0.4, 2.8],
  ghInset: 0.1,
  tumble: 0.38,
  ghCorner: 0.06,
  roofCrown: 0.03,
  shoulderDrop: 0.15,
  tuckTop: 0.035,
  tuckBottom: 0.06,
  rTop: 0.09,
  rBottom: 0.05,
  hoodCrown: 0.035,
  flare: 0.03,
  doors: [1.0, -0.42],
  rim: 'multi',
  headlightY: 0.53,
  taillightY: 0.86,
  seats: { frontX: -0.2, rearX: null },
}

const convertible: BodySpec = {
  ...coupe,
  type: 'convertible',
  label: 'Descapotable',
  length: 4.42,
  width: 1.83,
  wheelbase: 2.62,
  frontOverhang: 0.92,
  topLine: [
    [-2.19, 0.82],
    [-2.16, 0.93, 0.05],
    [-2.0, 0.975, 0.15],
    [-1.4, 0.965],
    [0.2, 0.935],
    [0.95, 0.9, 0.3],
    [1.95, 0.78, 0.4],
    [2.18, 0.66, 0.1],
    [2.23, 0.58],
  ],
  bottomLine: [
    [-2.19, 0.41],
    [-2.08, 0.26, 0.1],
    [-1.9, 0.23],
    [1.9, 0.21],
    [2.15, 0.25, 0.1],
    [2.23, 0.35],
  ],
  roofLine: null,
  windshieldTopX: 0.32,
  rearGlassTopX: 0,
  dlo: null,
  doors: [0.9, -0.45],
  cockpit: { from: -0.98, to: 0.92, depth: 0.42, wall: 0.1 },
  openWindshield: { baseX: 0.96, topX: 0.36, topY: 1.24 },
  headlightY: 0.55,
  taillightY: 0.87,
  seats: { frontX: -0.2, rearX: null },
}

const minivan: BodySpec = {
  type: 'minivan',
  label: 'Monovolumen',
  length: 4.86,
  width: 1.9,
  wheelbase: 2.98,
  frontOverhang: 0.98,
  wheelRadius: 0.345,
  tireWidth: 0.225,
  rimRatio: 0.6,
  archGap: 0.045,
  archShape: 2.3,
  topLine: [
    [-2.38, 0.98],
    [-2.36, 1.06, 0.05],
    [-2.25, 1.09, 0.1],
    [0.5, 1.06],
    [1.15, 1.04, 0.35],
    [2.12, 0.92, 0.4],
    [2.42, 0.8, 0.1],
    [2.47, 0.7],
  ],
  bottomLine: [
    [-2.38, 0.5],
    [-2.25, 0.33, 0.1],
    [-2.0, 0.3],
    [2.0, 0.29],
    [2.38, 0.35, 0.1],
    [2.47, 0.46],
  ],
  roofLine: [
    [-2.34, 1.08],
    [-2.28, 1.62, 0.06],
    [-2.1, 1.745, 0.25],
    [0.0, 1.765],
    [0.45, 1.72, 0.5],
    [1.32, 1.03],
  ],
  windshieldTopX: 0.42,
  rearGlassTopX: -2.12,
  dlo: { front: 1.2, rear: -2.12, frontSlope: 1.1, rearSlope: 2.5, pillars: [0.22, -1.28] },
  planFront: [0.6, 2.6],
  planRear: [0.36, 3.4],
  ghInset: 0.08,
  tumble: 0.22,
  ghCorner: 0.08,
  roofCrown: 0.04,
  shoulderDrop: 0.18,
  tuckTop: 0.03,
  tuckBottom: 0.05,
  rTop: 0.1,
  rBottom: 0.05,
  hoodCrown: 0.03,
  flare: 0.012,
  doors: [1.18, 0.2, -1.3],
  roofRails: true,
  rim: 'five',
  headlightY: 0.72,
  taillightY: 1.0,
  seats: { frontX: 0.05, rearX: -0.95 },
}

const van: BodySpec = {
  type: 'van',
  label: 'Furgoneta',
  length: 5.25,
  width: 2.02,
  wheelbase: 3.3,
  frontOverhang: 0.88,
  wheelRadius: 0.36,
  tireWidth: 0.225,
  rimRatio: 0.56,
  archGap: 0.05,
  archShape: 2.4,
  topLine: [
    [-2.72, 1.04],
    [-2.705, 1.13, 0.04],
    [-2.62, 1.16, 0.08],
    [1.5, 1.14],
    [1.95, 1.12, 0.3],
    [2.38, 1.0, 0.3],
    [2.5, 0.88, 0.08],
    [2.53, 0.78],
  ],
  bottomLine: [
    [-2.72, 0.5],
    [-2.62, 0.38, 0.08],
    [-2.4, 0.36],
    [2.2, 0.35],
    [2.46, 0.4, 0.1],
    [2.53, 0.5],
  ],
  roofLine: [
    [-2.71, 1.14],
    [-2.69, 2.17, 0.04],
    [-2.6, 2.27, 0.12],
    [0.8, 2.29],
    [1.15, 2.23, 0.35],
    [1.98, 1.11],
  ],
  windshieldTopX: 1.12,
  rearGlassTopX: -2.68,
  rearGlassBand: [1.45, 1.98],
  dlo: { front: 1.88, rear: 0.78, frontSlope: 1.2, rearSlope: 30, pillars: [] },
  planFront: [0.5, 2.8],
  planRear: [0.22, 4],
  ghInset: 0.05,
  tumble: 0.08,
  ghCorner: 0.09,
  roofCrown: 0.04,
  shoulderDrop: 0.2,
  tuckTop: 0.02,
  tuckBottom: 0.04,
  rTop: 0.08,
  rBottom: 0.05,
  hoodCrown: 0.025,
  flare: 0.008,
  doors: [1.86, 0.74, -0.95],
  rim: 'six',
  headlightY: 0.9,
  taillightY: 1.05,
  seats: { frontX: 0.95, rearX: null },
}

const pickup: BodySpec = {
  type: 'pickup',
  label: 'Pick-up',
  length: 5.35,
  width: 1.94,
  wheelbase: 3.22,
  frontOverhang: 0.98,
  wheelRadius: 0.39,
  tireWidth: 0.265,
  rimRatio: 0.55,
  archGap: 0.055,
  archShape: 3,
  topLine: [
    [-2.76, 1.08],
    [-2.745, 1.145, 0.03],
    [-2.7, 1.165, 0.05],
    [-0.25, 1.17],
    [0.55, 1.16],
    [1.25, 1.15, 0.3],
    [2.3, 1.1, 0.35],
    [2.53, 1.0, 0.1],
    [2.59, 0.86],
  ],
  bottomLine: [
    [-2.76, 0.62],
    [-2.65, 0.48, 0.08],
    [-2.4, 0.46],
    [2.2, 0.45],
    [2.5, 0.52, 0.1],
    [2.59, 0.62],
  ],
  roofLine: [
    [-0.47, 1.15],
    [-0.45, 1.74, 0.04],
    [-0.35, 1.83, 0.1],
    [0.75, 1.84],
    [1.05, 1.8, 0.3],
    [1.6, 1.14],
  ],
  windshieldTopX: 1.0,
  rearGlassTopX: -0.42,
  rearGlassBand: [1.32, 1.72],
  dlo: { front: 1.5, rear: -0.38, frontSlope: 1.3, rearSlope: 25, pillars: [0.58] },
  planFront: [0.45, 3.2],
  planRear: [0.2, 4],
  ghInset: 0.08,
  tumble: 0.18,
  ghCorner: 0.08,
  roofCrown: 0.035,
  shoulderDrop: 0.2,
  tuckTop: 0.025,
  tuckBottom: 0.045,
  rTop: 0.08,
  rBottom: 0.06,
  hoodCrown: 0.03,
  flare: 0.035,
  doors: [1.52, 0.58, -0.4],
  cladding: 0.6,
  bed: { from: -2.69, to: -0.52, depth: 0.5, wall: 0.065 },
  rim: 'six',
  headlightY: 0.95,
  taillightY: 1.0,
  seats: { frontX: 0.55, rearX: -0.2 },
}

export const BODY_SPECS: Record<BodyType, BodySpec> = {
  hatchback,
  sedan,
  wagon,
  suv,
  coupe,
  convertible,
  minivan,
  van,
  pickup,
}

export const BODY_TYPES = Object.keys(BODY_SPECS) as BodyType[]

export const DEFAULT_BODY: BodyType = 'hatchback'
/** Grafito neutro por defecto (CLAUDE.md / ADR-0004). */
export const DEFAULT_COLOR = '#3a4248'

export function resolveBody(bodyType: BodyType | null | undefined): BodyType {
  return bodyType && bodyType in BODY_SPECS ? bodyType : DEFAULT_BODY
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i
export function resolveColor(hex: string | null | undefined): string {
  if (!hex || !HEX.test(hex.trim())) return DEFAULT_COLOR
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h.toLowerCase()}`
}
