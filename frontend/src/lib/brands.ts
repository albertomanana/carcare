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

export function searchBrands(query: string, limit = 8): string[] {
  const q = normalizeSearch(query)
  if (!q) return CAR_BRANDS.slice(0, limit)
  const starts: string[] = []
  const contains: string[] = []
  for (const brand of CAR_BRANDS) {
    const b = normalizeSearch(brand)
    if (b.startsWith(q)) starts.push(brand)
    else if (b.includes(q)) contains.push(brand)
  }
  return [...starts, ...contains].slice(0, limit)
}
