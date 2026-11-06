#!/usr/bin/env node
/**
 * Descarga los logotipos de marca de simple-icons (licencia CC0 para los SVG; las marcas siguen siendo de sus
 * titulares) a frontend/public/img/marcas/<slug>.svg, para servirlos desde el propio sitio.
 * Se dibujan en monocromo con `mask-image` (ver BrandLogo), así que cogen el color del tema.
 *
 * Uso (desde la raíz):  node scripts/descargar-logos.mjs
 * Marcas sin logotipo en simple-icons (Cupra, Lexus, DS, Lancia, BYD…): la interfaz muestra un monograma.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = '13.21.0'
const DESTINO = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public', 'img', 'marcas')

/** nombre en el catálogo → slug de simple-icons */
const SLUGS = {
  'Alfa Romeo': 'alfaromeo', 'Aston Martin': 'astonmartin', Audi: 'audi', Bentley: 'bentley', BMW: 'bmw',
  Bugatti: 'bugatti', Chevrolet: 'chevrolet', Citroën: 'citroen', Dacia: 'dacia', Ferrari: 'ferrari', Fiat: 'fiat',
  Ford: 'ford', Honda: 'honda', Hyundai: 'hyundai', Jaguar: 'jaguar', Jeep: 'jeep', Kia: 'kia', Lamborghini: 'lamborghini',
  'Land Rover': 'landrover', Maserati: 'maserati', Mazda: 'mazda', McLaren: 'mclaren', 'Mercedes-Benz': 'mercedes',
  MG: 'mg', Mini: 'mini', Mitsubishi: 'mitsubishi', Nissan: 'nissan', Opel: 'opel', Peugeot: 'peugeot', Polestar: 'polestar',
  Porsche: 'porsche', Renault: 'renault', 'Rolls-Royce': 'rollsroyce', Seat: 'seat', Skoda: 'skoda', Smart: 'smart',
  Subaru: 'subaru', Suzuki: 'suzuki', Tesla: 'tesla', Toyota: 'toyota', Volkswagen: 'volkswagen', Volvo: 'volvo',
}

mkdirSync(DESTINO, { recursive: true })
const ok = []
const faltan = []
for (const [marca, slug] of Object.entries(SLUGS)) {
  const r = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@${VERSION}/icons/${slug}.svg`)
  if (!r.ok) { faltan.push(marca); continue }
  const svg = (await r.text()).replace(/<title>.*?<\/title>/, '')
  writeFileSync(join(DESTINO, `${slug}.svg`), svg)
  ok.push(slug)
}
console.log(`simple-icons ${VERSION}: ${ok.length} logotipos descargados`, faltan.length ? `· sin logotipo: ${faltan.join(', ')}` : '')
