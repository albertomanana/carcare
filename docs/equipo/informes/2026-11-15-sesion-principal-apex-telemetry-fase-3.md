# Rediseño «Apex Telemetry» · Fase 3: el coche «en el taller» y la telemetría radial del garaje

**Fecha:** 15/11/2026 · **Quién:** sesión principal (interactiva, con Alberto) · **Zonas:** `backend/` (de `backend-laravel`), el contrato (de `arquitecto`), `frontend/src/three/` (de `experto-3d`) y `frontend/` (de `frontend-react`). Lo hizo la sesión principal en línea, sin agentes, por encargo directo de Alberto («sigue con el proyecto sin pausa»).

## Objetivo

Fase 3 del encargo del 13/11:

1. **Particular ↔ taller.** Un coche del particular con una orden abierta en un taller se ve en su garaje como «En el taller» (ámbar), con el lugar exacto, quién lo lleva y el tiempo en vivo, y se puede pulsar para ver el progreso.
2. **Telemetría radial.** Al elegir un coche del garaje, la cámara se acerca, el coche gira y sus datos clave lo rodean sin taparlo nunca.

## Decisión de contrato (delegada por Alberto)

Un vehículo personal solo se une a una orden de taller a través de una **solicitud convertida** (E16, §3.13.6), y de la orden el particular solo veía número, estado y fechas. Para el seguimiento, `RepairRequestWorkOrder` gana, de forma aditiva:

| Campo | Qué es |
|---|---|
| `promised_at` | Fecha de entrega prevista, si el taller la ha dado. |
| `bay` | Elevador en el que está el coche, o `null`. |
| `mechanic_name` | **Solo el nombre de pila** de la persona asignada, o `null`. |
| `status_changed_at`, `repair_seconds`, `estimated_minutes` | Los tiempos de §3.11.1. |

El particular **sigue sin acceso a la orden** (`GET /work-orders/{o}` ⇒ 404) y sin ver importes de la orden, diagnóstico, líneas, ni el apellido o el email del mecánico. Anotado en el historial del contrato (15/11/2026).

Consecuencia que conviene saber: «En el taller» **solo aparece si el taller usa CarCare y la orden nació de una solicitud**. Si el particular lleva el coche a un taller de fuera, no hay dato y no se muestra nada (regla 2).

## Qué se hizo

### Backend
- `RepairRequestResource`: `work_order` expone los campos nuevos; el nombre sale de `firstName()`.
- `RepairRequest::RESOURCE_RELATIONS` carga `workOrder.assignee` (sin consultas N+1).
- `tests/Support/Contract.php` y un test nuevo en `RepairQuoteTest`: el particular sigue la orden desde la solicitud y no recibe apellido, email, importes ni diagnóstico.

### Lógica pura (con pruebas)
- `lib/workshopVisit.ts`: visitas abiertas por vehículo (`openVisits`), lugar («Elevador 4»), estado, frase accesible y recorrido de la orden (`visitSteps`).
- `lib/vehicleTelemetry.ts`: los datos clave del vehículo (en el taller · avisos · km · ITV · seguro · neumáticos · última revisión · motor · gasto del mes), cada uno con su tono y la pantalla donde se ve o se completa. Sin dato, lo dice («Sin recordatorio», «Sin indicar», «Sin registrar»).
- `three/scenes/garage/telemetry.ts`: `ringLayout`, el reparto de las tarjetas en dos columnas fuera de la elipse que barre el coche al girar.

### Escena del garaje (`frontend/src/three/`)
- `GarageSceneProps.telemetry` y `GarageVehicle.inWorkshop` (aditivos).
- `TelemetryRing.tsx`: capa HTML con las tarjetas y las líneas guía en SVG; un proyector dentro del lienzo escribe posiciones directamente en el DOM en cada fotograma (sin renders de React).
- Con telemetría, la cámara no se acerca tanto: deja sitio a una columna a cada lado; los rótulos de los demás coches se ocultan y se respeta el hueco de los controles de la escena.
- Plaza de un coche en el taller: marco ámbar encendido y resplandor en el suelo; su rótulo dice «En el taller».

### Pantallas
- **Inicio** (`PersonalDashboard`): telemetría radial al elegir un coche; aviso «En el taller» en la barra del vehículo con «Ver progreso»; panel nuevo «… de un vistazo» con los mismos datos en HTML (móvil, sin WebGL, lectores de pantalla).
- **Garaje** (`VehicleCard`): insignia ámbar sobre la miniatura y bloque con taller, lugar, estado y cronómetro.
- **Ficha del vehículo**: el mismo aviso en la cabecera, con enlace al seguimiento.
- **Detalle de la solicitud**: recorrido de la orden en píldoras, cronómetro grande, dónde está, quién lo lleva y entrega prevista; se refresca solo cada minuto mientras la orden está abierta.
- `DESIGN.md`: componentes «En el taller», «Recorrido de la orden», «Telemetría del vehículo» y la sección «Garaje 3D: telemetría radial».

### «0 % de solapamiento»: cómo se garantiza
Las tarjetas no se colocan alrededor del coche «a ojo»: van en dos columnas a los lados de la elipse que envuelve al coche **girando** (su proyección no depende del ángulo), con 26 px de margen, y apiladas con 10 px de hueco. Las que no caben no se dibujan. `telemetry.test.ts` comprueba las cuatro garantías (fuera del coche, sin pisarse, dentro de la zona libre, líneas sin cruces) para 162 combinaciones de número de datos, tamaño de coche y zona libre.

## Evidencias

| Comando | Resultado |
|---|---|
| `php artisan test` (backend) | **939 pasan** (12 523 aserciones), 145 s |
| `npx vitest run` (frontend) | **227 pasan** en 27 archivos (22 nuevas: `workshopVisit`, `telemetry`, `vehicleTelemetry`) |
| `npx tsc -b` | sin errores |
| `npm run lint` | 0 errores (avisos: los de siempre más los de `TelemetryRing.tsx`, del mismo tipo que el resto de proyectores de la escena, que escriben en el DOM a propósito) |
| `npm run build` | correcto |

**En el navegador** (Chromium con WebGL por software, instancia aislada :8031 + :5191, usuario `demo@carcare.test`):

- Inicio 1440 × 900 oscuro y 1280 × 800 claro, con «El rojo» elegido: **9 tarjetas visibles, 0 solapes** medidos sobre el DOM real (rectángulos de las tarjetas), en dos instantes del giro.
- Garaje, ficha del vehículo y detalle de la solicitud, claro y oscuro a 1280 px.
- Inicio a 390 px (sin escena): aviso «En el taller» y panel «El rojo de un vistazo».
- Sin errores de consola salvo el `401` de la comprobación de sesión antes de entrar (el de siempre).

Capturas en [`2026-11-15-apex-telemetry-fase-3-capturas/`](2026-11-15-apex-telemetry-fase-3-capturas/).

## Datos de Alberto tocados (BD `carcare`)

Para poder ver «En el taller» con un caso real, y **usando los servicios de la aplicación** (las mismas reglas que la API, sin tocar tablas a mano):

- La solicitud #3 «Chirrido al frenar» (El rojo, Taller Demo) estaba con presupuesto pendiente: **se aceptó el presupuesto** como Lucía ⇒ se creó la orden **OT-2026-0036**.
- Esa orden se puso **en reparación en el elevador 4**, asignada a Andrés, con 2 h estimadas.

Quedan los avisos y la actividad que esos pasos generan de forma normal. Con `php artisan migrate:fresh --seed` vuelve todo al estado de la demo (ojo: el seeder no crea todavía una visita abierta; conviene añadirla para la defensa).

## Limitaciones

- **Sin GPU real**: todo se comprobó con WebGL por software; no hay medida de FPS. La capa de telemetría reescribe 9 tarjetas y 9 líneas por fotograma mientras el coche gira; es barato, pero está sin medir en un equipo real.
- **1024–1200 px de ancho**: si no caben las dos columnas se dibuja una o ninguna. No se rompe nada (los datos están en el panel), pero el efecto se pierde. Sin comprobar a 1024 px exactos.
- **«En el taller» depende de las solicitudes**: se leen las 50 solicitudes convertidas más recientes del espacio y se refresca cada minuto; no hay tiempo real (ni WebSockets).
- **«Última revisión»** usa la última intervención de tipo revisión; si no hay, la última intervención de cualquier tipo, y lo rotula como tal.
- **Sin E2E ni auditoría axe** en esta fase (no hay carpeta `frontend/e2e`). El teclado se revisó a mano en el código: las tarjetas son enlaces, el aviso tiene su frase para lectores de pantalla y la luz ámbar se queda quieta con movimiento reducido.
- El **seeder de la demo** no crea una visita abierta.
- Sigue pendiente de fases anteriores: regenerar `.impeccable/design.json` y rehacer las capturas de la portada.

## Siguiente paso

Fase 4: órdenes → gastos (cada orden entregada genera o sincroniza su gasto en el vehículo, sin duplicados), gastos recurrentes y analítica por mes pulsable. Antes hay que resolver dos decisiones de contrato: los gastos no tienen periodicidad y el ADR‑0003 limita el gasto vinculado a los espacios personales.
