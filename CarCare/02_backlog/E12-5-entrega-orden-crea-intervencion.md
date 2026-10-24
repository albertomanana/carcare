# E12‑5 · Entregar una orden crea la intervención en el historial del vehículo

| Campo | Valor |
|-------|-------|
| Épica | E12 · Órdenes de trabajo y elevadores |
| Prioridad | Must |
| Estado | Construido (23/10/2026: `frontend/src/features/workshop/OrderDetailPage.tsx` muestra "Ver en el historial"; la API lo prueba en `WorkOrderTest.php`). Falta verificar la definición de terminado (E2E): tareas 5 y 6 |
| Para | Taller |
| Depende de | E12‑3 (líneas y totales), E3 (intervenciones), contrato §3.11. Base del puente taller ↔ particular (D13) |

## Historia

Como **taller** quiero que **al entregar un coche al cliente su trabajo quede automáticamente en el historial del vehículo** para **no apuntarlo dos veces y tener el historial completo la próxima vez que venga**.

## Criterios de aceptación

- [ ] Dada una orden en "Listo" con líneas y un total de 242,00 €, cuando la paso a **Entregado**, entonces, **en la misma transacción**, se fija `delivered_at` y se crea una intervención con: tipo `repair`, zona `general`, título = título de la orden, descripción = diagnóstico, fecha = fecha de entrega, km = km de entrada, taller = nombre del espacio, coste total = total de la orden, las mismas líneas y `work_order_id` enlazado. La orden guarda `maintenance_record_id`.
- [ ] Dado que la creación de la intervención falla, cuando ocurre el error, entonces **la orden no queda entregada** (rollback; test).
- [ ] Dada la intervención creada, cuando abro el historial del vehículo, entonces aparece con un enlace "Desde OT‑2026‑…" a la orden, y la orden enlaza a la intervención.
- [ ] Dado un taller, cuando se crea esa intervención, entonces **no se genera ningún gasto** (los gastos vinculados solo existen en espacios personales, ADR‑0003).
- [ ] Dada una orden entregada, cuando intento editarla o moverla, entonces la API responde `409` y la UI la muestra en solo lectura.
- [ ] Dada una orden **cancelada**, cuando se cancela, entonces no se crea ninguna intervención.
- [ ] Dada la entrega, cuando se registra, entonces Actividad muestra "… entregó OT‑… · intervención añadida al historial".

## Datos y reglas

- Tablas: `work_orders`, `work_order_items`, `maintenance_records`, `maintenance_items`.
- Validación: solo desde estados no finales. Pasar a `delivered` libera el elevador.
- Autorización: `operate` del espacio (los tres roles).

## Pantallas implicadas

Tablero kanban (E12‑2), detalle de orden, historial del vehículo (E3‑3).

## Pruebas previstas

- Backend: entrega crea la intervención con todos los campos; rollback si falla; sin gasto en taller; `409` después; cancelación sin intervención.
- E2E: recorrido taller completo (E6‑2 b).

## Fuera de alcance / limitaciones conocidas

- El tipo es siempre `repair` por simplicidad (contrato). Distinguir mantenimiento de reparación por líneas es una mejora posible.
- La intervención se queda en el **espacio del taller**. Que llegue al garaje personal del cliente es la decisión **D13** (puente taller ↔ particular), pendiente.
- El total no es una factura (D12).
