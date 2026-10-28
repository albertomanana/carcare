import { describe, expect, it } from 'vitest'
import { fitTabs } from './tabs'

describe('fitTabs', () => {
  const widths = [70, 70, 60, 100, 50]
  const more = () => 55

  it('muestra todas si caben', () => {
    expect(fitTabs(widths, more, 350)).toBe(5)
    expect(fitTabs(widths, more, 351)).toBe(5)
  })

  it('pasa las que no caben a "Más", contando el ancho del botón', () => {
    // 70+70+60+100 = 300 + 55 = 355 > 340 ⇒ 3 pestañas (200 + 55)
    expect(fitTabs(widths, more, 340)).toBe(3)
    // Con la última más ancha (380 en total), 4 + "Más" = 355 caben justas
    expect(fitTabs([70, 70, 60, 100, 80], more, 355)).toBe(4)
    expect(fitTabs([70, 70, 60, 100, 80], more, 354)).toBe(3)
  })

  it('el botón puede ser más ancho si lleva el nombre de la pestaña activa', () => {
    // La activa es la 4.ª (índice 3): si queda escondida, el botón mide como "Recordatorios ▾"
    const trigger = (firstHidden: number) => (3 >= firstHidden ? 120 : 55)
    // 3 pestañas: 200 + 120 = 320 ≤ 340
    expect(fitTabs(widths, trigger, 340)).toBe(3)
    // Con 300 px, 3 ya no caben (320) ⇒ 2: 140 + 120 = 260
    expect(fitTabs(widths, trigger, 300)).toBe(2)
    expect(fitTabs(widths, trigger, 400)).toBe(5)
  })

  it('deja siempre al menos una', () => {
    expect(fitTabs(widths, more, 10)).toBe(1)
  })
})
