import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { heroMode, type HeroEnv, scrollProgress } from './hero'

const desk: HeroEnv = { webgl: true, reducedMotion: false, desktop: true, saveData: false, stopped: false }

describe('heroMode: cuándo se monta solo el coche 3D de la portada', () => {
  it('en escritorio, con WebGL y sin preferencias en contra, se monta solo (en reposo)', () => {
    expect(heroMode(desk)).toBe('auto')
  })

  it('sin WebGL solo hay imagen, sin botón "Ver en 3D"', () => {
    expect(heroMode({ ...desk, webgl: false })).toBe('none')
    expect(heroMode({ ...desk, webgl: false, desktop: false })).toBe('none')
  })

  it('movimiento reducido, móvil o tableta, ahorro de datos o animación detenida ⇒ imagen y botón', () => {
    expect(heroMode({ ...desk, reducedMotion: true })).toBe('manual')
    expect(heroMode({ ...desk, desktop: false })).toBe('manual')
    expect(heroMode({ ...desk, saveData: true })).toBe('manual')
    expect(heroMode({ ...desk, stopped: true })).toBe('manual')
  })
})

describe('scrollProgress: recorrido de la sección con el escenario fijo', () => {
  // Ventana de 800 px, cabecera de 64 ⇒ escenario de 736. Sección de dos pantallas (1472) ⇒ recorrido de 736 px.
  const H = 1472
  it('vale 0 con la sección pegada a la cabecera y 1 al final del recorrido', () => {
    expect(scrollProgress(64, H, 800)).toBe(0)
    expect(scrollProgress(64 - 368, H, 800)).toBeCloseTo(0.5)
    expect(scrollProgress(64 - 736, H, 800)).toBe(1)
  })

  it('se queda entre 0 y 1 antes y después de la sección', () => {
    expect(scrollProgress(500, H, 800)).toBe(0)
    expect(scrollProgress(-5000, H, 800)).toBe(1)
  })

  it('si la sección no es más alta que el escenario no hay recorrido', () => {
    expect(scrollProgress(0, 700, 800)).toBe(0)
    expect(scrollProgress(Number.NaN, H, 800)).toBe(0)
  })
})

describe('la portada no carga three.js al arrancar (R11)', () => {
  it('sus archivos solo importan el 3D desde la fachada ligera @/three, nunca three.js ni las escenas', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const files = ['LandingPage.tsx', 'HeroVisual.tsx', 'Screenshot.tsx', 'hero.ts', 'shots.ts']
    const bad: string[] = []
    for (const f of files) {
      const code = readFileSync(resolve(dir, f), 'utf8')
      for (const m of code.matchAll(/^\s*import\s+[^'"]*?from\s*['"]([^'"]+)['"]/gm)) {
        if (/^(three($|\/)|@react-three\/|@\/three\/)/.test(m[1])) bad.push(`${f} → ${m[1]}`)
      }
    }
    expect(bad).toEqual([])
  })
})

describe('capturas reales de la portada', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'img', 'portada')
  const shots = [...readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'shots.ts'), 'utf8').matchAll(/file: '([a-z0-9-]+)'/g)].map((m) => m[1])

  it('cada captura del manifiesto existe en 1200 y 640 px y pesa menos de 80 KB', () => {
    expect(shots.length).toBeGreaterThanOrEqual(7)
    for (const name of shots) {
      for (const w of [1200, 640]) {
        const file = resolve(dir, `${name}-${w}.webp`)
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size).toBeLessThan(80 * 1024)
      }
    }
  })
})
