/**
 * Guardián de la regla R11 (informe de UX, 24/10/2026): importar '@/three' (miniaturas, silueta, respaldos 2D,
 * envoltorios) NO puede arrastrar three.js. Recorre el grafo de imports ESTÁTICOS desde src/three/index.tsx
 * (ignora `import type` e `import()` diferidos) y falla si alguno llega a 'three' o '@react-three/*'.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HEAVY = /^(three($|\/)|@react-three\/)/

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && !c.endsWith('/') && /\.(ts|tsx)$/.test(c)) return c
  }
  return null
}

/** Imports estáticos de valor (no de tipo) de un archivo. */
function staticImports(code: string): string[] {
  const out: string[] = []
  const re = /^\s*(import|export)\s+(?!type\b)([^'";]*?)\s*from\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const spec = m[3] ?? m[4]
    // `export type * from` / `import { type A, type B }` puros no cargan código
    if (m[2] && /^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(m[2].trim())) continue
    out.push(spec)
  }
  return out
}

describe('módulo 3D: exports ligeros', () => {
  it('importar @/three no carga three.js ni React Three Fiber', () => {
    const entry = join(SRC, 'three', 'index.tsx')
    const seen = new Set<string>()
    const heavy: string[] = []
    const stack = [entry]
    while (stack.length) {
      const file = stack.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      for (const spec of staticImports(readFileSync(file, 'utf8'))) {
        if (HEAVY.test(spec)) heavy.push(`${file.slice(SRC.length + 1)} → ${spec}`)
        const local = resolveLocal(file, spec)
        if (local) stack.push(local)
      }
    }
    expect(seen.size).toBeGreaterThan(5)
    expect(heavy).toEqual([])
  })

  it('la imagen fija de la portada existe en 1280 y 640 px y pesa menos de 150 KB', () => {
    for (const w of [1280, 640]) {
      const file = resolve(SRC, '..', 'public', 'img', `portada-coche-${w}.webp`)
      expect(existsSync(file)).toBe(true)
      expect(statSync(file).size).toBeLessThan(150 * 1024)
    }
  })
})
