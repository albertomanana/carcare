# Informe · backend-laravel · E16 Solicitudes de reparación a talleres (tarea 33)

*26/10/2026 (bloque 1 empezado en la sesión interactiva, cortada a las 14:23) · retomado el 28/10/2026 por el piloto automático · repaso de criterios y prueba en MariaDB el 01/11/2026.*

**Resumen.** Los 7 bloques están hechos y todos los criterios se cumplen. `php artisan test` en SQLite: **936 tests, 12.432 aserciones, en verde**. `migrate:fresh --seed` en MariaDB: sin errores y repetible. **La suite en MariaDB queda a medias: 49 de 936 tests**, porque Avast congela las ejecuciones largas de Pest contra esa base de datos, y esa decisión es de Alberto (ver el hallazgo). Las 18 rutas de §3.13.1 están implementadas. No hay desviaciones de forma respecto al contrato.

## Objetivo

Construir el backend de E16 según [ADR‑0007](../../arquitectura/ADR-0007-solicitudes-a-talleres.md) y el contrato §3.13: directorio de talleres, solicitudes de reparación con sus transiciones, presupuestos por versiones, conversión en orden, notificaciones en la app, los cambios en `VehicleService`, `WorkOrderService` y `AccountService`, la demo (§5) y el `ContractShapeTest`.

## Estado por bloques

| Bloque | Estado |
|--------|--------|
| 1. Migraciones, enums y modelos | **Hecho y en verde** (28/10 20:44: `php artisan test` → 517 tests, 7.883 aserciones) |
| 2. Directorio | **Hecho y en verde** (28/10 20:48: `php artisan test` → 546 tests, 8.003 aserciones) |
| 3. Solicitud y transiciones | **Hecho y en verde** (28/10 21:00: `php artisan test` → 655 tests, 8.523 aserciones) |
| 4. Presupuesto y conversión | **Hecho** (commits 6d3004e, 91fd566 y 93f184c; tests en `RepairQuoteTest.php`) |
| 5. Notificaciones y cambios en servicios existentes | **Hecho** (commit 6d3004e; tests en `AppNotificationTest.php`) |
| 6. DemoSeeder | **Hecho** (commit 6d3004e; tests en `DemoSeederTest.php`) |
| 7. Contract.php y ContractShapeTest | **Hecho** (commit 91fd566) |

Línea base antes de E16: 511 tests / 7.864 aserciones (28/10 20:35). Antes del repaso de hoy: 924 tests / 12.246 aserciones en SQLite (01/11 13:50, medido por el piloto).

## Hallazgo del 01/11: Avast congela Pest y fue quien se llevó los dos tests del 30/10

**Lo del 30/10 ya tiene causa: fue Avast.** Los registros de Avast (detección `IDP.Generic`, heurística de comportamiento) dicen que movió a su baúl justo los dos archivos que desaparecieron:

| Hora local (30/10) | Archivo | Tamaño en el baúl |
|--------------------|---------|-------------------|
| 19:25:49 detectado, 19:26:15 en el baúl | `backend/tests/Feature/ValidationTest.php` | 6.123 B |
| 19:26:29 detectado, 19:26:54 en el baúl | `backend/tests/Feature/RepairQuoteTest.php` | 32.696 B |

Antes, en una ejecución en paralelo del 26/10, Avast ya había señalado `vendor/pestphp/pest/bin/worker.php`. Los tests son código nuestro: es un falso positivo. **Las copias del baúl son antiguas: no hay que restaurarlas**, porque pisarían los tests actuales (93f184c ya recuperó su contenido).

**Hoy ha vuelto a actuar, esta vez congelando Pest.**
- A las 14:01:52 arranqué los tests de E16 contra MariaDB. A las 14:02:03 la conexión dejó de hacer consultas. A esa misma hora (13:02:03 UTC), `AvastSvc.log` apunta `IdpWrapper::OnNewDetection` y `AvastUI.log` abre un diálogo.
- El proceso de Pest se quedó **con todos sus hilos en `Suspended`**, sin CPU y sin consultas durante más de 9 minutos, con `aswhook.dll` de Avast cargada. Otro PHP en el mismo instante estaba en `UserRequest`, lo normal.
- **El diálogo sigue abierto a las 14:38** (ningún cierre en el registro de hoy): Avast espera a una persona. No sé qué archivo nombra, porque no se ve desde aquí.
- Hoy no se ha perdido ningún archivo: md5 de `backend/tests` antes y después, y `git status` tras cada ejecución.

**Qué lo provoca: no lo sé con certeza.**
- La primera congelación coincide al segundo con la detección de Avast. Las siguientes tienen el mismo síntoma, pero no dejan otra línea de detección en el registro: atribuirlas a Avast es una deducción muy probable, no una prueba.
- No es un test concreto: `RepairRequestTest` se congeló una vez en el primer test y otra después de 5.
- No es la carpeta de `LARAVEL_STORAGE_PATH`: también se congela con `backend/storage`.
- No es MariaDB en sí: el seeder, las carreras (más de un minuto) y los archivos de tests pequeños terminan bien.
- Solo se ha visto con Pest contra MariaDB. En SQLite no se ha congelado nada hoy: 936 tests en 223 s.
- También aparece `powershell.exe` tres veces (27 y 29/10, `IDP.HELU.PSE*`). No he comprobado si tiene que ver con el piloto.

**Qué he hecho y qué no.** Solo he leído los registros de Avast, y he terminado mis propios procesos congelados. No he tocado la configuración de Avast, ni su diálogo, ni su baúl, ni he reanudado ningún proceso suspendido. **Tampoco he troceado la suite en ejecuciones cortas para esquivar la congelación:** sería sortear lo que ha decidido un antivirus y la decisión es de Alberto. Sí hice una única ejecución dirigida con los 9 tests más sensibles al motor (ver Evidencias), y queda dicho aquí para que se valore.

**Pregunta para Alberto** (la anota la sesión principal: este encargo me limita a editar mi fila y las peticiones 11 y 13 del tablero):

> **Avast toma los tests de CarCare por una amenaza. ¿Le añades una excepción?** Ya se llevó dos archivos el 30/10 y hoy ha congelado las pruebas contra MariaDB; hay un aviso suyo abierto en la pantalla esperando respuesta.
> **Ahora, con el aviso abierto:** no lo mandes al baúl si te deja elegir. Si ya lo hiciste o lo haces, nada grave: `git restore` lo recupera una vez confirmados los tests de hoy, y no restaures las copias antiguas del baúl.
> **A)** Añadir una excepción en Avast para `C:\Users\Alberto\Desktop\CarCare\backend` (y, si no basta, para `C:\xampp\php\php.exe`). Los tests terminan de un tirón y no vuelven a desaparecer archivos, pero Avast deja de vigilar esa carpeta.
> **B)** No añadir nada y aceptar que los tests contra MariaDB solo se hacen a medias; se sigue con SQLite. Los archivos pueden volver a desaparecer.
> **Recomiendo A**, solo con la carpeta `backend` primero, porque es la excepción más pequeña.

## Evidencias del 01/11

**Comandos y resultados reales:**

| Comando | Base de datos | Resultado |
|---------|---------------|-----------|
| `php artisan test` | SQLite en memoria | **936 passed (12.432 assertions), 223,12 s**, exit 0. `git status --short backend/tests` igual antes y después. 12 tests más que los 924 de las 13:50 |
| `php artisan migrate:fresh --seed` | MariaDB 10.4.32, `carcare_back` :3399 | Exit 0, dos veces (14:01 y 14:33): 7 usuarios, 11 espacios, 13 clientes, 23 vehículos, 36 órdenes, 4 perfiles, 4 solicitudes, 2 presupuestos, 13 notificaciones |
| `php artisan db:seed`, repetido tras lo anterior | MariaDB | Exit 0 y **`+0` en las 15 tablas**, las tres veces |
| `pest` de `E16ModelTest` · `DirectoryTest` · `AppNotificationTest` | MariaDB | **6 (19 aserciones) · 22 (99) · 12 (105): en verde** |
| `pest RepairQuoteTest.php --filter "importe\|falla la conversi\|aceptar el presupuesto crea\|una segunda solicitud\|nunca enlaza\|compara normalizada"` | MariaDB | **9 passed (104 assertions), 5,5 s**: DECIMAL(10,2) al límite y desbordado, rollback de la conversión, reutilización, matrícula normalizada |
| `php race.php 2` (script en %TEMP%, fuera del repositorio) | MariaDB | **16 de 16 en OK**; detalle abajo |

**Total en MariaDB: 49 de 936 tests, 327 aserciones, 0 fallos.**

**Congelados en MariaDB, sin resultado** (se terminó el proceso a los 22‑34 s):

| Archivo | Tests | Estado en MariaDB |
|---------|-------|-------------------|
| `RepairRequestTest` | 82 | Congelado (en otro intento pasaron 5 antes de congelarse) |
| `RepairQuoteTest` | 54 | Congelado (los 9 de arriba sí, por separado; 45 sin probar) |
| `RepairRequestMatrixTest` | 63 | Congelado |
| `RepairRequestIsolationTest` | 110 | Congelado |
| `DemoSeederTest` | 8 | Congelado (el seeder en sí sí está probado: fila de `migrate:fresh --seed`) |
| `ContractShapeTest` | 99 | Congelado |
| `IsolationTest` | 261 | Congelado |
| `RolesTest` | 28 | Congelado |
| Otros 14 archivos, sin relación con E16 | 191 | No intentado: no tenía sentido con la congelación activa |

**Carreras reales en MariaDB.** Procesos PHP separados llaman al servicio a la vez, con una barrera de reloj. Son dos rondas de 8 escenarios (no HTTP, porque `php -S` atiende de una en una):

| Escenario | Resultado en las 2 rondas |
|-----------|---------------------------|
| R1 dos clics en aceptar el presupuesto | 1 OK y 1 409; una sola orden, cliente y vehículo |
| R2 seis conversiones a la vez en un taller | 6 OK; secuencias 1 a 6, sin repetidos ni huecos |
| R3 aceptar dos veces | 1 OK y 1 409 "Esta solicitud ya tiene respuesta." |
| R4 cancelar y aceptar a la vez | 1 OK y 1 409; ganó cada una en una ronda, estado coherente |
| R5 dos clics en enviar la solicitud | 1 OK y 1 409; una sola solicitud |
| R6 siete envíos a la vez | 5 OK y 2 429; 5 solicitudes |
| R7 el taller envía la v2 mientras el cliente acepta la v1 | 1 OK y 1 409; ganó cada una en una ronda, nunca una orden con una versión sustituida |
| R8 rechazar y aceptar a la vez | 1 OK y 1 409; ganó cada una en una ronda |

**Lo que siembra la demo, mirado en `carcare_back`:**
- Directorio, 4 solicitudes y notificaciones sin leer exactamente como dice §5: `taller@` y `gerente@` con la solicitud nueva y `demo@` con el presupuesto.
- Las frases de las notificaciones no llevan nombre, email ni teléfono de Lucía.
- Buscar `Prueba QA`, `QA frontend`, `lorem` y `test` en las columnas de texto solo encuentra "testigo" de motor (una palabra normal del taller) y `Neumáticos Prueba`/`Rosa Prueba`. El primero lo pide §5; el segundo es su dueña ficticia.

**Rutas:** `php artisan route:list` da 18 de E16, las de §3.13.1.

## Archivos tocados el 01/11

- `backend/tests/Feature/RepairRequestTest.php`, `RepairRequestMatrixTest.php`, `RepairQuoteTest.php` y `DemoSeederTest.php`: 12 tests nuevos y un test ampliado.
- `docs/equipo/informes/2026-10-26-backend-laravel-e16.md` y mi fila y las peticiones 11 y 13 de `docs/equipo/TABLERO.md`.
- **Nada** en `backend/app`, `backend/database`, `backend/routes`, `frontend/`, `types.ts` ni el contrato. El repaso no ha encontrado ningún fallo en el código.
- Fuera del repositorio, en `%TEMP%\carcare-back-scripts\`: `race.php`, los scripts de ejecución y los registros. Se pueden borrar. La copia temporal de `Log.db` de Avast que usé para leerlo ya está borrada.

## Contrato

- **Desviaciones de forma: cero.** `ContractShapeTest` en verde en SQLite; en MariaDB está entre los congelados.
- **Tres mensajes 409 que el contrato no redacta**, para casos que tampoco detalla: "Acepta la solicitud antes de enviar un presupuesto…" (`/quotes` desde `pending`), "Esta solicitud no tiene ningún presupuesto pendiente de respuesta." y "Esta solicitud ya se convirtió en una orden del taller…" (cancelar cuando el taller ya borró la orden). El código sigue siendo 409 y la forma `{ message }`, así que no requieren un cambio de contrato.

## Limitaciones

- **MariaDB: 887 de los 936 tests sin verificar hoy**, incluida la matriz de transiciones y el aislamiento de E16. El `migrate:fresh --seed`, las carreras y los 49 tests sí. No hay que decir, ni en la memoria, que toda la suite pasa en MariaDB.
- Las carreras prueban los servicios, no la pila HTTP, y el script no queda en el repositorio.
- `removeTestResidue` del seeder no mira `repair_requests`, `customers` ni `vehicles`. No afecta a una demo sembrada desde cero. Si una prueba manual deja una solicitud "Prueba QA" en una base con la demo, volver a sembrar no la borra.
- Cosmético en la demo: la orden de la solicitud convertida se crea después de las demás, así que es `OT-2026-0034` con fecha del 25/09, y su número es mayor que el de órdenes más recientes.

## Siguiente paso

1. Alberto responde al aviso de Avast y a la pregunta de arriba.
2. Con la excepción puesta, terminar la prueba en MariaDB con un solo comando:
   ```bash
   cd backend && DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3399 DB_DATABASE=carcare_back DB_USERNAME=root DB_PASSWORD= LARAVEL_STORAGE_PATH=C:/Users/Alberto/AppData/Local/Temp/carcare-back-storage php artisan test
   ```
3. La sesión principal confirma los 4 archivos de tests: hasta entonces, si Avast se los lleva, `git restore` no recupera los 12 tests nuevos.
4. documentador-tfg (petición 17): ya existen los tests de aislamiento de E16 (`RepairRequestIsolationTest`, 110 casos) y las cifras nuevas son 936/12.432.

## Repaso de criterios (01/11/2026)

Repasados contra el código y los tests reales. Los tests marcados con **(nuevo)** se han añadido hoy porque el criterio no los tenía o solo los tenía en parte. **Ningún criterio ha destapado un fallo del código de la aplicación: no se ha tocado `backend/app` ni `backend/database`.**

| Criterio | Estado | Test (archivo en `backend/tests/Feature/` › nombre) |
|----------|--------|-----------------------------------------------------|
| Cada fila de §3.13.4 con su transición válida y su 409 (8 acciones × 6 estados de partida) | Cumplido | `RepairRequestMatrixTest` › "§3.13.4: transición válida o 409, sin efectos secundarios si no procede" (48 casos) |
| Fila "Borrar el vehículo" | Cumplido (y ampliado) | `RepairRequestMatrixTest` › "borrar el coche cancela la solicitud abierta…" (3), "borrar el coche no toca las solicitudes cerradas…" (3) y **(nuevo)** "borrar un coche sin archivar da 409…" (3) |
| Fila "Compartir o retirar el historial" | Cumplido | `RepairRequestMatrixTest` › la matriz (compartir, 6 estados), "retirar el historial también se puede…" (3) y "una solicitud convertida o rechazada deja de compartir…" (3) |
| 409 al decidir sobre un presupuesto (versión no vigente, caducada) | Cumplido | `RepairQuoteTest` › "responder a una versión que ya no es la vigente da 409", "un presupuesto caducado no se puede aceptar (409), pero sí rechazar", "responder sin presupuesto pendiente…" |
| Bloqueo de fila y concurrencia | Cumplido | `RepairRequestTest` › "las transiciones bloquean la fila…" y carreras reales en MariaDB (ver Evidencias) |
| 422 de la solicitud | Cumplido | `RepairRequestTest` › "valida la solicitud (422 con el campo)" (20 casos; **(nuevo)** "km menores aunque se pida confirmar") y "no se puede enviar una solicitud a un taller del que eres miembro" |
| 422 de presupuesto y decisión | Cumplido | `RepairQuoteTest` › "valida el presupuesto…" (15), "quote_id es obligatorio y entero", "un importe que no cabe en DECIMAL(10,2)…" (3), **(nuevo)** "el motivo del cliente al rechazar admite hasta 500…"; `RepairRequestTest` › "rechazar exige un motivo de 5 a 500 caracteres" (4) |
| 429 en la 6.ª solicitud en 24 h | Cumplido | `RepairRequestTest` › "429 a partir de la 6.ª solicitud en 24 horas (contadas en la base de datos)" |
| 409 pareja abierta | Cumplido | `RepairRequestTest` › "409 si ya hay una solicitud abierta para la misma pareja vehículo‑taller; a otro taller sí se puede" |
| Conversión: reutiliza cliente por solicitud anterior | Cumplido | `RepairQuoteTest` › "una segunda solicitud del mismo usuario reutiliza el cliente y el vehículo del taller", "otro coche del mismo usuario…", "cada taller tiene su propia ficha…", "si el cliente de la solicitud anterior está anonimizado…", "si el taller eliminó al cliente…" y **(nuevo)** "el cliente se reutiliza por la cuenta, no por el email…" |
| Conversión: nunca por email | Cumplido | `RepairQuoteTest` › "nunca enlaza por email con un cliente dado de alta a mano…" |
| Conversión: vehículo por `source_vehicle_id` y si no por matrícula | Cumplido | `RepairQuoteTest` › "un coche sin matrícula también se reutiliza…", "la matrícula se compara normalizada…", "una copia archivada del coche no se reutiliza…", **(nuevo)** "el enlace con el coche del particular gana a la matrícula…" y **(nuevo)** "un vehículo del taller enlazado a otro coche se reutiliza por matrícula y conserva su enlace" |
| Conversión: líneas y totales del presupuesto; lectura `work_order` | Cumplido | `RepairQuoteTest` › "aceptar el presupuesto crea cliente, vehículo y orden en una transacción…", "si falla la conversión no queda nada a medias", "el importe más alto admitido…" |
| E16‑12: 404 para un tercero | Cumplido | `RepairRequestTest` › "un tercero recibe 404 en todas las rutas de una solicitud…" (9); `RepairRequestIsolationTest` › "un tercero recibe 404 en la solicitud y en todo lo que nació de ella" (6); `IsolationTest` › "responde 404 a un usuario de otro espacio" (incluye las 11 rutas de solicitudes y las 2 del perfil del directorio) |
| E16‑12: 404 en `/vehicles`, `/work-orders` y `/customers` cruzados | Cumplido | `RepairRequestIsolationTest` › "el taller recibe 404 en el garaje del particular, también después de la conversión" (26 rutas × 3 roles) y "el particular recibe 404 en el taller: en su orden, en su ficha de cliente y en la copia de su coche" (23 rutas) |
| E16‑12: 403 entre las partes y para el mecánico | Cumplido | `RepairRequestTest` › "el taller recibe 403 en las acciones del particular" (4 × 3 roles) y "el particular y el mecánico reciben 403 en las decisiones del taller" (4 × 2); `RolesTest` › "el mecánico recibe 403 en lo que no puede hacer" |
| Notificaciones: destinatarios | Cumplido | `AppNotificationTest` › "una solicitud nueva avisa al owner y a los managers…", "las respuestas del taller avisan solo al particular…", "las acciones del particular avisan al owner y a los managers…", "nunca avisa a quien hace la acción y usa los managers del taller en ese momento"; y la matriz comprueba los destinatarios de cada fila |
| Notificaciones: frases sin nombre, email ni teléfono | Cumplido | `AppNotificationTest` (frases literales de §3.13.8 y `expectNoPersonalData`); `RepairRequestIsolationTest` › "ninguna frase del taller lleva el email o el teléfono del particular…" |
| `AccountService` borra las notificaciones | Cumplido | `AppNotificationTest` › "borrar la cuenta borra sus notificaciones…" y "si la solicitud de una notificación ya no existe, abrirla da 404" |
| `VehicleService::delete` cancela y avisa | Cumplido | `AppNotificationTest` › "borrar el coche cancela la solicitud abierta y avisa al taller"; `RepairRequestMatrixTest` y `RepairRequestTest` › "borrar el coche cancela sus solicitudes abiertas…"; **(nuevo)** en sentido contrario: `RepairQuoteTest` › "si el taller borra su copia del coche…" |
| `WorkOrderService` avisa al pasar a `ready` | Cumplido | `AppNotificationTest` › "la orden lista avisa al particular; ningún otro cambio de estado de la orden avisa" y "una orden que no viene de una solicitud no avisa a nadie…" |
| `DemoSeeder` cumple §5 | Cumplido (test ampliado) | `DemoSeederTest` › "siembra el directorio de talleres y las 4 solicitudes de demo@ (E16, §5)" (**ampliado**: direcciones, owners y contraseña de `taller2@`‑`taller4@`, sin `bodywork` en Taller Demo) y "se puede ejecutar varias veces sin duplicar datos" |
| Petición 11: sin restos tipo "Prueba QA" | Cumplido | `DemoSeederTest` › **(nuevo)** "la demo sembrada no contiene restos de pruebas (petición 11)" y **(nuevo)** "volver a sembrar borra los restos de pruebas de los espacios demo y no toca los de otras cuentas" |
| `ContractShapeTest` con las interfaces de E16 | Cumplido | `ContractShapeTest` › "las especificaciones tienen las mismas claves que las interfaces de types.ts" (10 interfaces de E16), "los enums PHP tienen exactamente los literales de types.ts" (4 enums), "las entradas de E16 validan exactamente los campos de types.ts" (8 entradas) y las respuestas reales de "DirectoryProfile…", "DirectoryWorkshop…", "RepairRequest…" (3), "SharedHistoryEntry…", "AppNotification…" y "los errores de E16…" |
| 18 rutas de §3.13.1 | Cumplido | `php artisan route:list` → 18 rutas de E16; `IsolationTest` › "los datasets cubren todas las rutas de route:list --path=api" |

*`QuoteLineItemInput` de `types.ts` es un alias (`Omit<LineItemInput,…>`), no una interfaz: su forma se comprueba en `repairQuoteItem()` y en los 422 de las líneas.*

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
