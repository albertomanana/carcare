# Informe · backend-laravel · E16 Solicitudes de reparación a talleres (tarea 33)

*26/10/2026 (bloque 1 empezado en la sesión interactiva, cortada a las 14:23) · retomado el 28/10/2026 por el piloto automático. Se completa bloque a bloque.*

## Objetivo

Construir el backend de E16 según [ADR‑0007](../../arquitectura/ADR-0007-solicitudes-a-talleres.md) y el contrato §3.13: directorio de talleres, solicitudes de reparación con sus transiciones, presupuestos por versiones, conversión en orden, notificaciones en la app, los cambios en `VehicleService`, `WorkOrderService` y `AccountService`, la demo (§5) y el `ContractShapeTest`.

## Estado por bloques

| Bloque | Estado |
|--------|--------|
| 1. Migraciones, enums y modelos | **Hecho y en verde** (28/10 20:44: `php artisan test` → 517 tests, 7.883 aserciones) |
| 2. Directorio | **Hecho y en verde** (28/10 20:48: `php artisan test` → 546 tests, 8.003 aserciones) |
| 3. Solicitud y transiciones | **Hecho y en verde** (28/10 21:00: `php artisan test` → 655 tests, 8.523 aserciones) |
| 4. Presupuesto y conversión | En curso (código en disco; tests en `RepairQuoteTest.php`) |
| 5. Notificaciones y cambios en servicios existentes | Pendiente |
| 6. DemoSeeder | Pendiente |
| 7. Contract.php y ContractShapeTest | Pendiente |

Estado a las 21:00 del 28/10: bloques 1, 2 y 3 en verde. Línea base antes de empezar: 511 tests / 7.864 aserciones (20:35).

## Bloque 1 · Migraciones, enums y modelos

Revisado lo que había en disco del 26/10 (no se rehízo):
- Migraciones `2026_10_26_000003_create_notifications_table.php` (la estándar de Laravel) y `2026_10_26_000004_create_repair_requests_tables.php` (`workshop_profiles`, `repair_requests` con la copia fija `vehicle_*`, `repair_quotes` con las líneas en JSON y `vehicles.source_vehicle_id` nullable con `nullOnDelete`). Coinciden con §3.13: longitudes iguales a las de `vehicles`, dinero en `decimal(10,2)`, `sent_at` con `DEFAULT` explícito (la misma precaución de MariaDB que `received_at`), índices para el límite de 24 h, la pareja abierta y los listados de cada parte.
- Enums `WorkshopService`, `RepairRequestStatus`, `RepairQuoteStatus` y `NotificationKind` con los literales de `types.ts`.
- Modelos `WorkshopProfile`, `RepairRequest` y `RepairQuote`. Cambio: `RepairRequest::RESOURCE_RELATIONS` ya no carga `vehicle` (el recurso solo necesita `vehicle_id`; el taller nunca debe recibir datos del coche vivo).
- `Workspace::workshopProfile()` y `Workspace::managers()` (owner y managers: los destinatarios de los avisos del taller).
- `WorkspacePolicy`: `ownWorkshop`, `listRepairRequests`, `createRepairRequest` y, nuevo, `viewInDirectory` (ficha pública: 404 si no es un taller con `listed = true`).
- Nuevo `RepairRequestPolicy` (`view`, `actAsRequester`, `decide`): tercero ⇒ 404; la otra parte o el mecánico ⇒ 403.
- `ActivityLogger::logWithoutUser()`: actividad con `user = null` para lo que el contrato §3.13.9 registra sin autor en el taller ("El cliente aceptó…", "Se abrió OT‑… desde una solicitud").
- Tests: `tests/Feature/E16ModelTest.php` (6 casos) y ayudantes de E16 en `tests/Pest.php` (`listWorkshop`, `e16World`, `requestInput`, `quoteInput`, `sendRequest`).

## Bloque 2 · Directorio

- Rutas: `GET /workshops`, `GET /workshops/{id}` (`can:viewInDirectory`), `GET /workspaces/{ws}/directory-profile` (`can:viewWorkshop`: en personal, 404) y `PUT …/directory-profile` (`can:ownWorkshop`: manager y mechanic ⇒ 403).
- `DirectoryService` (búsqueda, ficha y guardado con bloqueo del espacio), `DirectoryController`, `Directory/DirectoryIndexRequest`, `Directory/DirectoryProfileRequest` y los recursos `DirectoryProfileResource`, `DirectoryWorkshopResource` y `DirectoryWorkshopRefResource`.
- Búsqueda portable MariaDB/SQLite: `LOWER(name|city) LIKE` y el servicio con `services LIKE '%"tyres"%'` (los servicios son literales cerrados del enum guardados como lista JSON). `is_member` con `withExists` (una sola consulta).
- **Decisión de implementación (PUT):** los campos que no llegan se conservan. Así "Aparecer en el directorio" se puede apagar con `{ listed: false }` sin borrar la ciudad ni el resto. Si `listed = true` llega sin ciudad, 422 `errors.city` ("Indica la ciudad para aparecer en el directorio."), como dice §3.13.2.
- Actividad `directory_profile.updated` ("Ana actualizó el perfil del directorio"), solo si algo cambió.
- Mensajes y nombres de campo nuevos en `lang/es/validation.php` (`distinct`, `required_if_accepted` y los atributos de E16).
- Tests: `tests/Feature/DirectoryTest.php` (22 casos); `IsolationTest` cubre las rutas nuevas (404 al intruso en el perfil y 401 sin sesión también en `/workshops`); `RolesTest`: el mecánico recibe 403 al editar el perfil.

## Bloque 3 · Solicitud y transiciones

- Rutas: `GET|POST /workspaces/{ws}/repair-requests` (`can:listRepairRequests` / `can:createRepairRequest`) y `/repair-requests/{r}` con `show`, `PATCH`, `cancel`, `accept`, `reject`, `quotes`, `quote/accept`, `quote/reject` e `history`, cada una con su `can:` de `RepairRequestPolicy` (`view`, `actAsRequester` o `decide`).
- `RepairRequestService` (crear, listar, transiciones, historial, presupuesto y conversión), `RepairRequestNotifier` (destinatarios de los avisos), `RepairRequestController`, siete Form Requests en `app/Http/Requests/RepairRequest/` y los recursos `RepairRequestResource` y `RepairQuoteResource`.
- **Crear:** copia fija de los 7 campos; los km no crean lectura; 429 "Has enviado 5 solicitudes…" (cuenta en BD por `requester_user_id` y `created_at` de las últimas 24 h, canceladas incluidas) y 409 "Ya tienes una solicitud abierta…" (pareja vehículo‑taller), las dos comprobaciones con el espacio personal bloqueado (`lockForUpdate`) dentro de la transacción. Los 422 de §3.13.3 con sus frases ("Este vehículo está archivado.", "Este taller no está en el directorio.", "No puedes enviar una solicitud a un taller del que formas parte.", "No puede ser menor que el último kilometraje anotado (84.200 km).").
- **Transiciones:** cada una relee la fila con `lockForUpdate()` dentro de `DB::transaction` y vuelve a comprobar el estado. 409 "Esta solicitud ya está cerrada.", "Esta solicitud ya tiene respuesta." y "Esta solicitud ya es la orden OT‑…. Para cancelarla, llama al taller.".
- **`perspective`:** la calcula el recurso con los espacios de los que el usuario es owner (una consulta por petición, guardada en `$request->attributes`). Para el taller, `vehicle_id = null`; nunca sale el apodo ni el VIN.
- **Historial compartido:** intervenciones no archivadas, `service_date` desc, máx. 50, solo los 7 campos de `SharedHistoryEntry`. Si no está disponible, 403 "El cliente no comparte su historial con el taller." (nueva `ForbiddenException`; `bootstrap/app.php` deja pasar su frase y el resto de 403 siguen diciendo "No tienes permiso para esta acción.").
- **Borrar el coche** (adelantado del bloque 5 porque lo pide la tabla de §3.13.4): `VehicleService::delete` llama a `RepairRequestService::cancelForDeletedVehicle` dentro de su transacción.
- Tests: `tests/Feature/RepairRequestTest.php` (80 casos: crear, 19 casos de 422, 409 de pareja, 429 en la 6.ª, listados de las dos partes, matriz 404/403 en las 9 rutas, transiciones válidas y su 409, bloqueo de fila, historial y borrado del coche). `IsolationTest` y `RolesTest` cubren las 11 rutas nuevas (el mundo de prueba `world()` incluye ahora una solicitud de un particular al taller de Olga).
