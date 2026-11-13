/**
 * El sol, para el tema «según el sol»: de día la app va en claro, de noche en oscuro, y cerca del horizonte el lienzo se
 * templa (amanecer y atardecer). Todo se calcula en el dispositivo con la hora y la zona horaria: no se pide la ubicación
 * ni sale ningún dato del navegador. La posición es una aproximación astronómica estándar (error de décimas de grado),
 * suficiente para decidir un color; no se enseña como dato al usuario.
 */

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2_440_588
const J2000 = 2_451_545
const OBLIQUITY = RAD * 23.4397

export interface Coordinates {
  lat: number
  lon: number
}

export interface SunPosition {
  /** Altura sobre el horizonte, en grados (negativa: bajo el horizonte). */
  elevation: number
  /** Rumbo en grados desde el norte, en el sentido de las agujas del reloj (90 = este, 180 = sur). */
  azimuth: number
}

/** Posición del sol para un instante y un lugar. */
export function sunPosition(date: Date, { lat, lon }: Coordinates): SunPosition {
  const days = date.getTime() / DAY_MS - 0.5 + J1970 - J2000
  const anomaly = RAD * (357.5291 + 0.98560028 * days)
  const center = RAD * (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly))
  const longitude = anomaly + center + RAD * 102.9372 + Math.PI
  const declination = Math.asin(Math.sin(OBLIQUITY) * Math.sin(longitude))
  const rightAscension = Math.atan2(Math.sin(longitude) * Math.cos(OBLIQUITY), Math.cos(longitude))
  const phi = RAD * lat
  const hourAngle = RAD * (280.16 + 360.9856235 * days) + RAD * lon - rightAscension
  const elevation = Math.asin(Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle))
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi))
  return { elevation: elevation / RAD, azimuth: (((fromSouth / RAD + 180) % 360) + 360) % 360 }
}

/** Zonas horarias de España: su hora oficial va muy adelantada respecto al sol, así que se fija un punto real. */
const KNOWN_ZONES: Record<string, Coordinates> = {
  'Europe/Madrid': { lat: 40.4, lon: -3.7 },
  'Atlantic/Canary': { lat: 28.1, lon: -15.4 },
  'Africa/Ceuta': { lat: 35.9, lon: -5.3 },
}

/**
 * Lugar aproximado sin pedir la ubicación: el de la zona horaria si es conocida y, si no, la longitud que corresponde a
 * su hora oficial de invierno (15° por hora) con una latitud templada del hemisferio que delata el cambio de hora.
 */
export function estimateCoordinates(now: Date = new Date()): Coordinates {
  let zone = ''
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    /* sin Intl: se usa el desfase horario */
  }
  if (KNOWN_ZONES[zone]) return KNOWN_ZONES[zone]
  const year = now.getFullYear()
  const january = new Date(year, 0, 1).getTimezoneOffset()
  const july = new Date(year, 6, 1).getTimezoneOffset()
  return { lat: january < july ? -35 : 40, lon: -Math.max(january, july) / 4 }
}

/** Con el sol por encima de esta altura es de día (incluye la refracción en el horizonte). */
const HORIZON = -0.833
/** Grados sobre o bajo el horizonte en los que el lienzo sigue templado (hora dorada y crepúsculo). */
const TWILIGHT = 12

export interface SunTheme {
  theme: 'light' | 'dark'
  /** 0 = pleno día o noche cerrada; 1 = el sol en el horizonte. */
  warmth: number
  elevation: number
  azimuth: number
}

/** Tema y temple del lienzo que corresponden a un instante. */
export function sunTheme(date: Date = new Date(), where: Coordinates = estimateCoordinates(date)): SunTheme {
  const { elevation, azimuth } = sunPosition(date, where)
  const theme = elevation > HORIZON ? 'light' : 'dark'
  const distance = Math.min(1, Math.max(0, Math.abs(elevation) / TWILIGHT))
  return { theme, warmth: 1 - distance, elevation, azimuth }
}

/** Lienzo de cada tema: el de pleno día o noche cerrada y el templado del horizonte. */
export const CANVAS = {
  light: { core: '#eef0f4', warm: '#f6e8da' },
  dark: { core: '#0b0d13', warm: '#1b1216' },
} as const

/** Mezcla lineal de dos colores #rrggbb (t = 0 ⇒ a, t = 1 ⇒ b). */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const k = Math.min(1, Math.max(0, t))
  return `#${[0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * k).toString(16).padStart(2, '0')).join('')}`
}

/** Color del lienzo (`--base`) para un tema y un temple. */
export function canvasColor(theme: 'light' | 'dark', warmth: number): string {
  return mixHex(CANVAS[theme].core, CANVAS[theme].warm, warmth)
}
