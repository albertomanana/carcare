import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { brandLogoUrl, brandMonogram } from './brands'
import { findBrand, findModel, loadCatalog, searchModels, versionsFor, type Catalog } from './catalog'

const fixture: Catalog = {
  generado: '2026-11-06',
  desde: 2005,
  marcas: [
    {
      n: 'Audi',
      fuente: 'epa',
      m: [
        { n: 'A3', v: [{ n: '2.0 L 4 cil. turbo · Manual', f: 'gasoline', t: 'manual', y: [2010, 2014] }, { n: '1.4 L 4 cil. turbo · Automático', f: 'gasoline', t: 'automatic', y: [2016, 2020] }] },
        { n: 'Q5', b: 'suv' },
      ],
    },
    { n: 'Citroën', fuente: 'editorial', m: [{ n: 'C3', b: 'hatchback' }] },
  ],
}

describe('catálogo', () => {
  it('busca la marca sin importar mayúsculas ni tildes', () => {
    expect(findBrand(fixture, 'citroen')?.n).toBe('Citroën')
    expect(findBrand(fixture, ' AUDI ')?.n).toBe('Audi')
    expect(findBrand(fixture, 'Opel')).toBeNull()
    expect(findBrand(null, 'Audi')).toBeNull()
    expect(findBrand(fixture, '')).toBeNull()
  })

  it('sugiere modelos: primero los que empiezan por el texto, luego los que lo contienen', () => {
    const brand = findBrand(fixture, 'Audi')
    expect(searchModels(brand, '').map((m) => m.n)).toEqual(['A3', 'Q5'])
    expect(searchModels(brand, 'q').map((m) => m.n)).toEqual(['Q5'])
    expect(searchModels(brand, '5').map((m) => m.n)).toEqual(['Q5'])
    expect(searchModels(null, 'a')).toEqual([])
    expect(findModel(brand, 'q5')?.b).toBe('suv')
  })

  it('filtra las versiones por año y no inventa versiones sin fuente', () => {
    const a3 = findModel(findBrand(fixture, 'Audi'), 'A3')
    expect(versionsFor(a3, null)).toHaveLength(2)
    expect(versionsFor(a3, 2012).map((v) => v.n)).toEqual(['2.0 L 4 cil. turbo · Manual'])
    expect(versionsFor(a3, 2000)).toEqual([])
    expect(versionsFor(findModel(findBrand(fixture, 'Audi'), 'Q5'), 2018)).toEqual([])
  })

  it('el catálogo generado trae marcas, modelos y versiones, y las editoriales no llevan versiones', async () => {
    const catalog = await loadCatalog()
    expect(catalog.marcas.length).toBeGreaterThan(50)
    const a4 = findModel(findBrand(catalog, 'Audi'), 'A4')
    expect(a4?.v?.length).toBeGreaterThan(3)
    expect(a4?.b).toBeUndefined() // mezcla berlina y familiar: no se autorrellena
    const ibiza = findModel(findBrand(catalog, 'Seat'), 'Ibiza')
    expect(ibiza?.b).toBe('hatchback')
    expect(ibiza?.v).toBeUndefined()
    expect(findBrand(catalog, 'Seat')?.fuente).toBe('editorial')
  })
})

describe('logotipos de marca', () => {
  it('devuelve la ruta solo de las marcas con logotipo y el archivo existe', async () => {
    expect(brandLogoUrl('Audi')).toBe('/img/marcas/audi.svg')
    expect(brandLogoUrl('mercedes-benz')).toBe('/img/marcas/mercedes.svg')
    expect(brandLogoUrl('Citroën')).toBe('/img/marcas/citroen.svg')
    expect(brandLogoUrl('Cupra')).toBeNull()
    const catalog = await loadCatalog()
    for (const b of catalog.marcas) {
      const url = brandLogoUrl(b.n)
      if (!url) continue
      const file = fileURLToPath(new URL(`../../public${url}`, import.meta.url))
      expect(existsSync(file), `${b.n}: falta ${url}`).toBe(true)
    }
  })

  it('el monograma usa dos letras', () => {
    expect(brandMonogram('Cupra')).toBe('CU')
    expect(brandMonogram('Lynk & Co')).toBe('LC')
    expect(brandMonogram('Alfa Romeo')).toBe('AR')
    expect(brandMonogram('')).toBe('?')
  })
})
