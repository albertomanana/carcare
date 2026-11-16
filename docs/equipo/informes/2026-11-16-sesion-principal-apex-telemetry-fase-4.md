# Rediseño «Apex Telemetry» · Fase 4: órdenes → gastos, gastos con relaciones y analítica con mes pulsable

**Fecha:** 16/11/2026 · **Quién:** sesión principal (interactiva, con Alberto) · **Zonas:** `backend/` (de `backend-laravel`), el contrato (de `arquitecto`) y `frontend/` (de `frontend-react`). Lo hizo la sesión principal en línea, sin agentes, por encargo directo de Alberto («sigue con el proyecto sin pausa»).

## Objetivo

Fase 4 del encargo del 13/11:

1. Toda orden de reparación genera o sincroniza sola su gasto en el vehículo, con desglose, fecha, concepto, taller y enlace a la orden, sin duplicar.
2. «Añadir gasto» detecta y vincula relaciones: gastos periódicos con su renovación, y reparaciones o modificaciones asociadas a una intervención.
3. La gráfica mensual de la analítica se pulsa: el mes elegido se resalta y abre su detalle.

## Decisiones (delegadas por Alberto: «te dejo a ti las decisiones»)

| Decisión | Qué se hizo y por qué |
|---|---|
| **El gasto de una orden es del dueño del coche, no del taller** | El ADR‑0003 sigue vigente: en un taller una orden es ingreso, no gasto. El gasto nace en el garaje del **particular** cuando el taller entrega una orden que venía de su solicitud. |
| **Un solo apunte** | Se reutiliza la regla que ya existía (intervención con coste ⇒ gasto vinculado). La orden entregada deja una intervención en el coche del particular y esa intervención genera el gasto. No hay una segunda vía que pueda duplicar. |
| **Sin duplicados por construcción** | `maintenance_records.repair_request_id` es único: una solicitud nunca deja dos intervenciones. |
| **La renovación de un gasto periódico es un recordatorio, no un gasto futuro** | El dinero aún no se ha pagado: no entra en ningún total (regla 2). Se reutilizan los recordatorios, que ya tenían recurrencia, agenda y avisos. |
| **«Modificaciones» como tipo y categoría** | Nuevos `RecordType.modification` y `ExpenseCategory.modification`; el encargo las pedía y no existían. |
| **El kilometraje del particular no lo toca el taller** | La intervención llega sin lectura de km. Lo exigía una prueba que ya existía («el coche del particular no cambia»); mi primera versión la rompía y se corrigió. |

Contrato: §3.5.1, §3.6.1 y §4.1 nuevos, y fila en el historial (15/11/2026). Todo aditivo.

## Qué se hizo

### Backend
- Migración `2026_11_15_000001_link_orders_expenses_and_renewals`: `maintenance_records.repair_request_id` (único) y `work_order_number`; `expenses.recurrence_months` y `reminder_id`.
- `MaintenanceService::createFromDeliveredRequest`: al entregar una orden nacida de una solicitud, crea en el vehículo del particular la intervención con las líneas facturadas, piezas, mano de obra y total con IVA; su gasto vinculado sale de la regla de siempre. No copia el diagnóstico ni los km. Queda en la actividad del particular sin autor («Taller Demo entregó…»).
- `ExpenseService`: gasto periódico (crea o **reutiliza** el recordatorio pendiente del mismo tipo), y gasto asociado a una intervención sin coste o que la crea en el mismo paso.
- `GET /workspaces/{ws}/analytics/month?month=YYYY-MM`: total, mes anterior, variación, categorías y los cargos (particular) u órdenes entregadas (taller).
- `ExpenseResource`: `recurrence_months`, `renewal` y `origin` (con desglose e IVA). `MaintenanceRecordResource`: `from_order`.
- Comando `php artisan carcare:sync-order-expenses [--dry-run]`: pone al día las órdenes entregadas antes de esta fase. Idempotente.
- `DemoSeeder`: el seguro anual de la demo es un gasto periódico unido a «Renovar el seguro».

### Pantallas
- **Añadir gasto** (`ExpenseDialog`): según la categoría aparece un apartado. Seguro, impuestos, aparcamiento y otros: «¿Se repite?» (mensual, trimestral, semestral, anual) con la próxima renovación ya propuesta. Mantenimiento, reparación, modificación e ITV: «Intervención» (solo el gasto · asociar a una que ya tengo · crear la intervención), y avisa si hay intervenciones sin coste para no apuntar dos veces.
- **Gastos del vehículo**: cada gasto vinculado dice de dónde viene («Orden OT‑2026‑0034 · Taller Demo», con enlace a la solicitud), su desglose (piezas, mano de obra, IVA) y, si es periódico, cuándo renueva.
- **Historial**: la intervención llegada del taller enlaza a su solicitud.
- **Analítica** (particular y taller): cada barra de la gráfica mensual es un botón. El mes elegido se pinta en naranja, queda en la URL (`?mes=AAAA-MM`) y abre «Detalle del mes»: total, comparación con el mes anterior, reparto (taller y órdenes · periódicos · modificaciones · combustible · resto) y los cargos uno a uno con su enlace.
- `components/charts/MonthSelectBars.tsx`: la gráfica nueva. Una sola serie, importe del mes elegido rotulado encima, el de los demás al pasar el puntero o enfocar; la tabla de datos sigue debajo.
- Lógica pura con pruebas: `lib/expenseLinks.ts` y `niceMax` en `lib/analytics.ts`.

### Portada
- Las 7 capturas de la portada (`frontend/public/img/portada/`) eran del 3 de noviembre, con el aspecto anterior. Se rehicieron con «Apex Telemetry» (tema oscuro, 1280 × 800 a 1,5x, WebP de 1200 y 640 px) y se actualizaron los textos alternativos de las tres cuyo contenido cambió (zonas, gastos y taller 3D) en `features/landing/shots.ts`.
- Se tomaron sobre una **demo recién sembrada en una base de datos aparte** (`carcare_shots`, creada y borrada en esta sesión), para no volver a tocar los datos de Alberto.

## Evidencias

| Comando | Resultado |
|---|---|
| `php artisan test` (backend) | **958 pasan** (12 883 aserciones). 12 nuevas en `OrderExpenseLinkTest`, 1 en `ContractShapeTest`, 1 ruta más en `IsolationTest` |
| `npx vitest run` (frontend) | **236 pasan** en 28 archivos (9 nuevas) |
| `npx tsc -b` · `npm run lint` · `npm run build` | sin errores · 0 errores · correcto |

**En el navegador** (Chromium, instancia aislada :8031 + :5191):

- Analítica del particular y del taller, claro y oscuro a 1280 px y a 390 px: pulsar octubre lo resalta, pone `?mes=2026-10` y abre el detalle; con Tab + Intro se pasa a noviembre (teclado comprobado).
- Detalle de octubre del particular: 717,17 €, +21 % respecto a septiembre, y entre los cargos «Revisión antes de un viaje largo · Orden OT‑2026‑0034 · Taller Demo · Piezas 51,70 € · Mano de obra 52,80 € · IVA 21,95 €».
- Formulario de gasto: se comprobó **lo que envía** interceptando la petición (no se escribió nada): seguro anual ⇒ `recurrence_months: 12, next_due_date: 2027-11-16`; reparación con intervención ⇒ `record: {title, zone, workshop_name}`; combustible ⇒ sin campos de más. Sin nombre de intervención avisa y no envía.
- Sin errores de consola salvo el `401` de la comprobación de sesión antes de entrar.

**Siembra limpia** (`DB_DATABASE=carcare_shots php artisan migrate:fresh --seed`, MariaDB): termina sin errores con las migraciones nuevas; la orden entregada de la solicitud de demo genera sola su intervención (1 con `repair_request_id`) y los 2 seguros salen como anuales unidos a su recordatorio. La base `carcare` de Alberto no se tocó (se comprobó: sigue con sus 5 solicitudes).

Capturas en [`2026-11-16-apex-telemetry-fase-4-capturas/`](2026-11-16-apex-telemetry-fase-4-capturas/).

## Datos de Alberto tocados (BD `carcare`)

- **Migración aditiva** (4 columnas nuevas, ninguna modificada).
- `carcare:sync-order-expenses` creó **2 intervenciones con su gasto** para órdenes ya entregadas que venían de solicitudes: OT‑2026‑0034 (El rojo, 126,45 €, 5 oct) y **OT‑2026‑0035, la de tu solicitud «Repro al coche»** (Golf/GTI). Es el comportamiento nuevo aplicado hacia atrás; si no quieres alguna, se archiva desde el historial del coche y su gasto desaparece.
- Los 2 seguros anuales de los coches de demo@ quedaron marcados como anuales y el último de cada coche unido a su recordatorio «Renovar el seguro» (lo mismo que hace ya el seeder).

## Limitaciones

- **«Toda orden» son las que nacen de una solicitud.** Una orden que el taller abre a mano para un cliente no tiene ningún garaje personal al que unirse: no hay vínculo entre el cliente del taller y una cuenta de particular. Para el particular que va a un taller de fuera, la vía es registrar la intervención (o el gasto con «Crear la intervención»).
- **Se sincroniza al entregar, una vez.** Una orden entregada ya no se puede editar, así que no hay cambios posteriores que propagar. Si el particular edita su intervención, manda la suya.
- **Asociar un gasto a una intervención** hace que el gasto tome la fecha y el nombre de la intervención (lo dice el formulario).
- **Editar** un gasto no permite asociarlo a una intervención a posteriori: solo al crearlo.
- **«Periódico» no genera pagos solos**: cada pago se anota cuando ocurre. El recordatorio avisa de la renovación.
- **La póliza** no se adjunta desde el formulario: se indica dónde guardarla (Datos › Documentos).
- **Sin E2E ni axe.** El formulario se probó en navegador interceptando el envío, no con un alta real desde la interfaz (los altas reales están cubiertas por las pruebas del backend).
- **Demo recién sembrada**: no trae un coche «En el taller»; se consigue en dos pasos aceptando el presupuesto de «Chirrido al frenar» y moviendo la orden desde el taller (buen guion para la defensa).
- Pendiente de fases anteriores: comprobar el 3D en una GPU real y regenerar `.impeccable/design.json`.

## Siguiente paso

Cierre del rediseño: repaso en una GPU real con Alberto y decidir si la demo sembrada debe traer ya una visita abierta al taller.
