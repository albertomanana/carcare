/** Utilidades de color sin three.js (las usa también la silueta SVG). */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Mezcla dos colores hex (t = 0 ⇒ a, t = 1 ⇒ b). */
export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

/** Luminancia relativa aproximada (0..1). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Nombre aproximado del color en español (para textos alternativos). */
export function colorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (s < 0.14 || d < 0.06) {
    if (l < 0.12) return 'negro'
    if (l < 0.42) return 'gris oscuro'
    if (l < 0.75) return 'gris'
    return 'blanco'
  }
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h < 15 || h >= 345) return l < 0.3 ? 'granate' : 'rojo'
  if (h < 40) return l < 0.35 ? 'marrón' : 'naranja'
  if (h < 65) return 'amarillo'
  if (h < 160) return 'verde'
  if (h < 200) return 'turquesa'
  if (h < 255) return 'azul'
  if (h < 290) return 'morado'
  return 'rosa'
}
