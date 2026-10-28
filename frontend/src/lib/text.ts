/** Iniciales para avatares: 'Ana García' → 'AG'. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

const countFmt = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 })

/**
 * Plural en español con la cifra delante: plural(3, 'vehículo', 'vehículos') → '3 vehículos'.
 * Para frases con adjetivo se pasa la frase entera: plural(1, 'recordatorio vencido', 'recordatorios vencidos').
 * Nunca "recordatorio(s)".
 */
export function plural(n: number, one: string, many: string): string {
  return `${countFmt.format(n)} ${pluralWord(n, one, many)}`
}

/** Solo la palabra: pluralWord(1, 'día', 'días') → 'día'. */
export function pluralWord(n: number, one: string, many: string): string {
  return Math.abs(n) === 1 ? one : many
}

/** Une una lista en español: ['a', 'b', 'c'] → 'a, b y c'. */
export function joinList(items: string[]): string {
  const list = items.filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`
}

/** Primera letra en mayúscula y el resto igual: "viernes, 23 de octubre" → "Viernes, 23 de octubre". */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase('es-ES') + text.slice(1) : text
}
