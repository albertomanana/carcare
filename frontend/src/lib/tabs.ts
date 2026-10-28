/**
 * Cuántas pestañas caben en `available` px: todas, o las primeras `n` más el botón "Más ▾". `triggerWidth(n)` da el
 * ancho de ese botón cuando la primera pestaña escondida es la `n` (lleva el nombre de la activa si queda dentro).
 * Siempre deja al menos una pestaña a la vista.
 */
export function fitTabs(widths: number[], triggerWidth: (firstHidden: number) => number, available: number): number {
  const sum = (n: number) => widths.slice(0, n).reduce((a, b) => a + b, 0)
  if (sum(widths.length) <= available) return widths.length
  for (let n = widths.length - 1; n >= 1; n--) {
    if (sum(n) + triggerWidth(n) <= available) return n
  }
  return 1
}
