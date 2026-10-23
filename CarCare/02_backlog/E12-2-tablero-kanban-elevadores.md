# E12‑2 · Tablero kanban de órdenes y elevadores

| Campo | Valor |
|-------|-------|
| Épica | E12 · Órdenes de trabajo y elevadores |
| Prioridad | Must |
| Estado | En curso (oleada 1: backend `work-orders` y `status`, frontend tablero) |
| Para | Taller (owner, manager, mechanic) |
| Depende de | E12‑1 (crear orden), E12‑4 (elevadores), E13‑4 (permisos), contrato §3.11 |

## Historia

Como **jefe de taller** quiero **ver todas las órdenes abiertas en columnas por estado y moverlas de una a otra (también entre elevadores)** para **saber en todo momento qué coche está en qué fase y quién lo lleva, sin pizarras ni papeles**.

## Criterios de aceptación

- [ ] Dado el taller demo, cuando abro el tablero, entonces veo las columnas **Recibido, Diagnóstico, Esperando piezas, En curso, Listo** con sus órdenes (cargadas con `?status=open&per_page=200`). Entregadas y canceladas quedan en una vista aparte filtrable.
- [ ] Dada una tarjeta, cuando la veo, entonces muestra número (`OT-2026-0004`), matrícula y modelo con miniatura estática, cliente, prioridad (icono + texto), mecánico asignado, elevador y la marca **"Con retraso"** si `is_late`.
- [ ] Dada una tarjeta en "Diagnóstico", cuando la arrastro a "Esperando piezas" **o** uso su menú "Mover a…" con el teclado, entonces se llama a `POST /work-orders/{o}/status`, la tarjeta cambia de columna, el cambio persiste al recargar y queda en Actividad ("Ana movió OT‑… a «Esperando piezas»").
- [ ] Dado un movimiento que falla (`409`, error de red), cuando la API responde, entonces la tarjeta **vuelve a su columna** y veo un aviso con el mensaje de la API (sin estados fantasma).
- [ ] Dada una orden, cuando la muevo a "Listo", entonces se fija `completed_at` y su elevador se libera (salvo que indique otro). El elevador liberado aparece libre en la vista de elevadores y en el taller 3D.
- [ ] Dada una orden entregada o cancelada, cuando intento moverla o editarla, entonces la UI no ofrece la acción y la API responde `409` (estado final).
- [ ] Dado el filtro "Mis órdenes", "Mecánico", "Cliente" o el buscador (número, título, matrícula, cliente), cuando lo aplico, entonces el tablero se filtra y la URL conserva el filtro.
- [ ] Dado un móvil de 360 px, cuando abro el tablero, entonces las columnas se recorren con scroll horizontal por columnas (o pestañas por estado), sin que la página entera se desborde, y "Mover a…" funciona sin arrastrar.
- [ ] Dado un `mechanic`, cuando usa el tablero, entonces puede mover estados y elevadores (`operate`) pero no ve importes ni la acción de borrar (`manage`).

## Datos y reglas

- `GET /workspaces/{ws}/work-orders` (filtros `status`, `assigned_to`, `customer_id`, `search`), `POST /work-orders/{o}/status` con `{ status, bay? }`, `GET /workspaces/{ws}/bays`.
- Los estados no finales pueden moverse libremente entre sí; `delivered` y `cancelled` son finales.
- Un elevador = como máximo una orden abierta (`409` con mensaje).
- Autorización: `view` para ver, `operate` para mover. Órdenes de otro espacio ⇒ `404`.

## Pantallas implicadas

Taller → Órdenes (tablero), detalle de orden (panel lateral), vista de elevadores (2D) y taller 3D (E12‑7).

## Pruebas previstas

- Backend: transiciones válidas y `409` en finales; elevador ocupado `409`; liberación al pasar a `ready`; aislamiento.
- Frontend: reversión optimista ante error; alternativa "Mover a…" por teclado; filtros en la URL.
- E2E: crear orden → mover por todas las columnas → elevador ocupado da error visible → entregar.

## Fuera de alcance / limitaciones conocidas

- Sin tiempo real entre puestos (no hay WebSockets): otro usuario ve los cambios al refrescar o al revalidar la consulta. Valorar sondeo periódico si las pruebas con talleres lo piden.
- Sin cronómetro de horas por mecánico (lo tienen competidores como Tekmetric; ver `06_investigacion/competencia.md`).
