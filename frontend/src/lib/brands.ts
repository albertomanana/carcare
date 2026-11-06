/**
 * Marcas habituales en España para el buscador del asistente (solo texto, sin logotipos).
 * El usuario puede escribir cualquier otra.
 */
export const CAR_BRANDS = [
  'Abarth',
  'Alfa Romeo',
  'Alpine',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'BYD',
  'Chevrolet',
  'Citroën',
  'Cupra',
  'Dacia',
  'DS',
  'Ferrari',
  'Fiat',
  'Ford',
  'Honda',
  'Hyundai',
  'Infiniti',
  'Isuzu',
  'Iveco',
  'Jaguar',
  'Jeep',
  'Kia',
  'Lamborghini',
  'Lancia',
  'Land Rover',
  'Lexus',
  'Lynk & Co',
  'Maserati',
  'Mazda',
  'Mercedes-Benz',
  'MG',
  'Mini',
  'Mitsubishi',
  'Nissan',
  'Omoda',
  'Opel',
  'Peugeot',
  'Polestar',
  'Porsche',
  'Renault',
  'Rover',
  'Saab',
  'Seat',
  'Skoda',
  'Smart',
  'SsangYong',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
] as const

/** Quita tildes y pasa a minúsculas para buscar. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Sugerencias con el campo vacío: marcas muy vistas en las calles españolas, no las primeras del
 * abecedario (hallazgo M6 de UX: antes salían Abarth, Alfa Romeo, Alpine, Aston Martin…).
 * Es una lista orientativa para ahorrar teclas, no un ranking.
 */
export const COMMON_BRANDS = ['Seat', 'Toyota', 'Volkswagen', 'Renault', 'Peugeot', 'Dacia', 'Kia', 'Hyundai', 'Citroën', 'Ford'] as const

export function searchBrands(query: string, limit = 8): string[] {
  const q = normalizeSearch(query)
  if (!q) return COMMON_BRANDS.slice(0, limit)
  const starts: string[] = []
  const contains: string[] = []
  for (const brand of CAR_BRANDS) {
    const b = normalizeSearch(brand)
    if (b.startsWith(q)) starts.push(brand)
    else if (b.includes(q)) contains.push(brand)
  }
  return [...starts, ...contains].slice(0, limit)
}

/**
 * Logotipos descargados por `scripts/descargar-logos.mjs` (simple-icons, CC0) a /img/marcas/<slug>.svg.
 * Las marcas que no están aquí (Cupra, Lexus, DS, Lancia, BYD…) muestran un monograma, nunca un logo inventado.
 */
const LOGO_SLUGS: Record<string, string> = {
  'alfa romeo': 'alfaromeo', 'aston martin': 'astonmartin', audi: 'audi', bentley: 'bentley', bmw: 'bmw',
  bugatti: 'bugatti', chevrolet: 'chevrolet', citroen: 'citroen', dacia: 'dacia', ferrari: 'ferrari', fiat: 'fiat',
  ford: 'ford', honda: 'honda', hyundai: 'hyundai', jaguar: 'jaguar', jeep: 'jeep', kia: 'kia', lamborghini: 'lamborghini',
  'land rover': 'landrover', maserati: 'maserati', mazda: 'mazda', mclaren: 'mclaren', 'mclaren automotive': 'mclaren',
  'mercedes-benz': 'mercedes', mg: 'mg', mini: 'mini', mitsubishi: 'mitsubishi', nissan: 'nissan', opel: 'opel',
  peugeot: 'peugeot', polestar: 'polestar', porsche: 'porsche', renault: 'renault', 'rolls-royce': 'rollsroyce',
  seat: 'seat', skoda: 'skoda', smart: 'smart', subaru: 'subaru', suzuki: 'suzuki', tesla: 'tesla',
  toyota: 'toyota', volkswagen: 'volkswagen', volvo: 'volvo',
}

/** Ruta del logotipo de una marca, o null si no hay (se usa el monograma). */
export function brandLogoUrl(make: string): string | null {
  const slug = LOGO_SLUGS[normalizeSearch(make)]
  return slug ? `/img/marcas/${slug}.svg` : null
}

/** Dos letras para el monograma: «Lynk & Co» → «LC», «Seat» → «SE». */
export function brandMonogram(make: string): string {
  const words = make.replace(/[^\p{L}\p{N}\s-]/gu, '').split(/[\s-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] ?? '?').slice(0, 2).toUpperCase()
}
