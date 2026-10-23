/*
 * Service worker de AUTODESACTIVACIÓN. CarCare no usa service workers.
 *
 * Existe porque otro proyecto local (una PWA) se ejecutó antes en http://localhost:5173 y dejó registrado
 * su service worker en "/sw.js": el navegador seguía mostrando aquella app aunque el servidor ya fuese CarCare.
 * Cuando el navegador busca la actualización de "/sw.js", recibe este archivo, que borra las cachés,
 * se da de baja y recarga las pestañas abiertas para que carguen CarCare desde el servidor.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => client.navigate(client.url))
    })(),
  )
})
