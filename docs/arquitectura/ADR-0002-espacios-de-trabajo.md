# ADR‑0002 · Espacios de trabajo: particular y taller sobre el mismo modelo

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (21/10/2026) |
| Relacionada | D7 (nueva): alcance particular + taller |

## Contexto
La documentación original priorizaba al propietario particular y dejaba el portal de talleres "fuera del MVP". El 21/10/2026 Alberto pidió explícitamente que CarCare sirva **a la vez** a un particular que sigue su coche día a día y a un mecánico que gestiona su flota. Hay que soportar ambos sin duplicar el modelo de datos.

## Decisión
- Tabla `workspaces` con `type ∈ {personal, workshop}` y `settings` (elevadores, IVA, moneda).
- Tabla pivote `workspace_user` con `role ∈ {owner, manager, mechanic}`.
- Al registrarse, todo usuario recibe un espacio `personal`. Puede crear o pertenecer a espacios `workshop`.
- Los vehículos pertenecen a un espacio (`vehicles.workspace_id`) y, en talleres, opcionalmente a un cliente (`customer_id`).
- Las tablas hijas (intervenciones, gastos, recordatorios, documentos, kilometraje) **no** guardan `user_id`: la propiedad se resuelve a través del vehículo y su espacio (una sola fuente de verdad).
- Funciones exclusivas de taller: `customers`, `work_orders` (+ líneas), elevadores y facturación.

## Consecuencias
- Un mismo usuario puede llevar su coche personal y trabajar en un taller con la misma cuenta.
- Toda consulta y policy debe filtrar por espacio: se cubre con un test de aislamiento por endpoint.
- La UI cambia según el tipo de espacio activo (cabina del coche vs. centro de control del taller).
- Riesgo de alcance: hay más pantallas. Mitigación: las funciones de taller reutilizan vehículos, historial y documentos.

## Cómo defenderlo
Patrón *multi-tenant* por espacio con control de acceso basado en roles (RBAC), habitual en SaaS B2B/B2C.
