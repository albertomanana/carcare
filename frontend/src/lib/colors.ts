/**
 * Colores habituales de carrocería con su nombre (el usuario puede elegir cualquier otro).
 * Son el color del propio vehículo (dato del usuario), no colores de la interfaz: por eso van en hex.
 */
export const VEHICLE_COLORS = [
  { hex: '#F2F2EF', name: 'Blanco' },
  { hex: '#15171A', name: 'Negro' },
  { hex: '#A9AEB4', name: 'Gris plata' },
  { hex: '#4B5157', name: 'Gris grafito' },
  { hex: '#C62828', name: 'Rojo' },
  { hex: '#1F4E9C', name: 'Azul' },
  { hex: '#6FA3D9', name: 'Azul claro' },
  { hex: '#2E6B45', name: 'Verde' },
  { hex: '#CDBA96', name: 'Beige' },
  { hex: '#6B4A35', name: 'Marrón' },
  { hex: '#E06A1B', name: 'Naranja' },
  { hex: '#E8C21C', name: 'Amarillo' },
] as const

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

/**
 * Nombre legible del color (hallazgo M4 de UX: "Gris", no "#6B7280"). Si no es uno de la paleta,
 * el nombre del más parecido; null si el valor no es un color válido.
 */
export function vehicleColorName(hex: string | null | undefined): string | null {
  const target = hex ? rgb(hex) : null
  if (!target) return null
  let best: { name: string; d: number } | null = null
  for (const c of VEHICLE_COLORS) {
    const [r, g, b] = rgb(c.hex)!
    const d = (r - target[0]) ** 2 + (g - target[1]) ** 2 + (b - target[2]) ** 2
    if (!best || d < best.d) best = { name: c.name, d }
  }
  return best?.name ?? null
}
