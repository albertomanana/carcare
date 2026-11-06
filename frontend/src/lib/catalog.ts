import { useEffect, useState } from 'react'
import type { BodyType, FuelType, Transmission } from '@/api/types'
import { normalizeSearch } from '@/lib/brands'

/**
 * Catálogo marca → modelo → versión generado por `scripts/generar-catalogo.mjs` (fuentes en
 * docs/arquitectura/catalogo-vehiculos.md). Se carga bajo demanda: ~50 KB comprimidos que solo hacen falta en el
 * formulario de vehículo. Es una ayuda para no teclear: el usuario puede escribir cualquier valor.
 */
export interface CatalogVersion {
  /** Texto de la versión tal como se guarda, p. ej. «2.0 L 4 cil. turbo · Automático». */
  n: string
  f?: FuelType
  t?: Transmission
  /** Primer y último año con esa versión en la fuente. */
  y: [number, number]
}
export interface CatalogModel {
  n: string
  y?: [number, number]
  /** Solo cuando todas las filas de la fuente coinciden. */
  b?: BodyType
  v?: CatalogVersion[]
}
export interface CatalogBrand {
  n: string
  fuente: 'epa' | 'editorial'
  m: CatalogModel[]
}
export interface Catalog {
  generado: string
  desde: number
  marcas: CatalogBrand[]
}

let cache: Promise<Catalog> | null = null

export function loadCatalog(): Promise<Catalog> {
  cache ??= import('@/data/catalogo-vehiculos.json').then((m) => (m.default ?? m) as unknown as Catalog)
  return cache
}

/** null mientras carga (o si falla: el formulario sigue funcionando a mano). */
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  useEffect(() => {
    let vivo = true
    loadCatalog().then((c) => vivo && setCatalog(c)).catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])
  return catalog
}

export function findBrand(catalog: Catalog | null, make: string): CatalogBrand | null {
  const q = normalizeSearch(make)
  if (!catalog || !q) return null
  return catalog.marcas.find((b) => normalizeSearch(b.n) === q) ?? null
}

export function findModel(brand: CatalogBrand | null, model: string): CatalogModel | null {
  const q = normalizeSearch(model)
  if (!brand || !q) return null
  return brand.m.find((m) => normalizeSearch(m.n) === q) ?? null
}

export function searchModels(brand: CatalogBrand | null, query: string, limit = 12): CatalogModel[] {
  if (!brand) return []
  const q = normalizeSearch(query)
  if (!q) return brand.m.slice(0, limit)
  const starts: CatalogModel[] = []
  const contains: CatalogModel[] = []
  for (const m of brand.m) {
    const n = normalizeSearch(m.n)
    if (n.startsWith(q)) starts.push(m)
    else if (n.includes(q)) contains.push(m)
  }
  return [...starts, ...contains].slice(0, limit)
}

/** Versiones del modelo; si se conoce el año, las que existían entonces van primero. */
export function versionsFor(model: CatalogModel | null, year: number | null): CatalogVersion[] {
  const list = model?.v ?? []
  if (!year) return list
  const inYear = list.filter((v) => year >= v.y[0] && year <= v.y[1])
  return inYear.length ? inYear : []
}
