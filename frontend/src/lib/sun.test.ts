import { describe, expect, it } from 'vitest'
import { CANVAS, canvasColor, mixHex, sunPosition, sunTheme } from './sun'

const MADRID = { lat: 40.4, lon: -3.7 }

describe('sunPosition', () => {
  it('en el solsticio de verano el sol del mediodía está alto y al sur', () => {
    // Mediodía solar en Madrid: ~12:16 UTC
    const p = sunPosition(new Date('2026-06-21T12:16:00Z'), MADRID)
    expect(p.elevation).toBeGreaterThan(72)
    expect(p.elevation).toBeLessThan(74)
    expect(p.azimuth).toBeGreaterThan(170)
    expect(p.azimuth).toBeLessThan(190)
  })

  it('en el solsticio de invierno el mediodía queda bajo', () => {
    const p = sunPosition(new Date('2026-12-21T12:13:00Z'), MADRID)
    expect(p.elevation).toBeGreaterThan(25)
    expect(p.elevation).toBeLessThan(27.5)
  })

  it('por la mañana el sol está al este y por la tarde al oeste', () => {
    expect(sunPosition(new Date('2026-03-20T08:00:00Z'), MADRID).azimuth).toBeLessThan(140)
    expect(sunPosition(new Date('2026-03-20T17:00:00Z'), MADRID).azimuth).toBeGreaterThan(240)
  })

  it('de madrugada está bajo el horizonte', () => {
    expect(sunPosition(new Date('2026-11-13T02:00:00Z'), MADRID).elevation).toBeLessThan(-30)
  })
})

describe('sunTheme', () => {
  it('claro de día y oscuro de noche', () => {
    expect(sunTheme(new Date('2026-11-13T12:00:00Z'), MADRID).theme).toBe('light')
    expect(sunTheme(new Date('2026-11-13T22:00:00Z'), MADRID).theme).toBe('dark')
  })

  it('cambia de tema alrededor de la puesta de sol (13/11 en Madrid: ~17:00 UTC)', () => {
    expect(sunTheme(new Date('2026-11-13T16:30:00Z'), MADRID).theme).toBe('light')
    expect(sunTheme(new Date('2026-11-13T17:30:00Z'), MADRID).theme).toBe('dark')
  })

  it('el temple es máximo en el horizonte y nulo a pleno día o noche cerrada', () => {
    expect(sunTheme(new Date('2026-11-13T16:55:00Z'), MADRID).warmth).toBeGreaterThan(0.85)
    expect(sunTheme(new Date('2026-06-21T12:16:00Z'), MADRID).warmth).toBe(0)
    expect(sunTheme(new Date('2026-11-13T23:30:00Z'), MADRID).warmth).toBe(0)
  })
})

describe('canvasColor', () => {
  it('mezcla entre el lienzo pleno y el templado', () => {
    expect(canvasColor('dark', 0)).toBe(CANVAS.dark.core)
    expect(canvasColor('dark', 1)).toBe(CANVAS.dark.warm)
    expect(canvasColor('light', 0)).toBe(CANVAS.light.core)
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
  })
})
