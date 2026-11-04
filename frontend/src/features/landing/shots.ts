/**
 * Capturas reales de la app (cuentas demo del DemoSeeder, datos ficticios) en `public/img/portada/`, en WebP de 1200
 * y 640 px de ancho y proporción 16:10. Se generaron con Playwright contra la API (tema oscuro, 1280 px, a 1,5x) y se
 * codificaron en WebP con el propio Chromium: ver el informe 2026-10-29-frontend-react-portada.
 */
export const SHOTS = {
  zonas: {
    file: 'particular-zonas',
    alt: 'Ficha de un Kia Sportage en CarCare: el coche en 3D con un punto en cada zona y, al lado, la lista de zonas con su estado; el motor sale como «Próximo» y la mayoría «Sin datos» o «Sin recordatorio».',
  },
  gastos: {
    file: 'particular-gastos',
    alt: 'Pestaña Gastos de la ficha: total del año, coste por km y consumo medio arriba; debajo, un gráfico de barras por mes y un anillo por categoría con combustible, seguro, mantenimiento y reparación.',
  },
  tablero: {
    file: 'taller-tablero',
    alt: 'Tablero de órdenes de trabajo de un taller con cinco columnas: Recibido, Diagnóstico, Piezas, Reparación y Listo. Las órdenes que van tarde tienen el borde rojo y la etiqueta «Tarde».',
  },
  taller3d: {
    file: 'taller-3d',
    alt: 'Vista Taller 3D: la nave con cuatro elevadores, tres ocupados y uno libre, y la zona de espera con coches de colores numerados; a la derecha, la misma información en una lista de elevadores y espera.',
  },
  directorio: {
    file: 'solicitudes-directorio',
    alt: 'Directorio de talleres: buscador por nombre o ciudad, filtro por servicio y la lista de talleres con su ciudad, dirección, servicios, horario y el botón «Solicitar reparación».',
  },
  recibida: {
    file: 'solicitudes-recibida',
    alt: 'Solicitud recibida por el taller: «Golpe seco en la suspensión delantera», con la zona, la fecha en que el cliente quiere venir, los km que declara, el historial que ha compartido y los datos del coche, y los botones Aceptar y Rechazar.',
  },
  presupuesto: {
    file: 'solicitudes-presupuesto',
    alt: 'Presupuesto recibido por el particular, con el rótulo «Presupuesto (no es una factura)»: líneas de pieza, fluido y mano de obra, subtotal, IVA del 21 % y total, la nota del taller y los botones Aceptar presupuesto y Rechazar presupuesto.',
  },
} as const

export type ShotName = keyof typeof SHOTS
