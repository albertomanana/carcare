# Informe backend-laravel — API v1 (cierre de la batería de tests)

- **Fecha:** 2026-10-23 (oleada 1d)
- **Agente:** backend-laravel
- **Encargo:** cerrar la batería de tests de la API v1 (aislamiento, 401, roles, 422, reglas de negocio, forma JSON frente a `types.ts`, DemoSeeder), dejar `php artisan test` en verde y documentar la API.

## 1. Punto de partida

Las instancias anteriores dejaron la API completa y comprometida en `develop` (commit `8b4c1d8`), con 14 archivos de test. La última se cortó diciendo "Now the DemoSeeder test", pero `tests/Feature/DemoSeederTest.php` ya estaba escrito y completo (5 tests). Primera ejecución de esta sesión: **454 tests en verde (6889 aserciones)**. No he rehecho nada: he buscado huecos frente al contrato y los he cubierto.

## 2. Qué he hecho

1. **Auditoría de cobertura** frente a `docs/api/contrato-v1.md` y `route:list --path=api` (68 rutas). Ya estaban cubiertos aislamiento 404 en cada ruta (con un test que comprueba que el dataset coincide con `route:list` en los dos sentidos), 401, roles, 422, forma JSON de cada interfaz de `types.ts` y las reglas de negocio pedidas.
2. **8 tests nuevos** para los huecos que encontré (150 líneas, solo en `backend/tests/Feature/`):

   | Archivo | Test nuevo | Regla del contrato |
   |---------|-----------|--------------------|
   | `VehicleTest.php` | al borrar un vehículo archivado elimina en cascada su historial y sus ficheros, y no toca los de otro | §3.3 "Borra en cascada su historial y archivos" |
   | `VehicleTest.php` | el VIN es único por espacio y la matrícula no choca consigo misma al editar | §3.3 validación `vin`/`plate` |
   | `DocumentTest.php` | filtra por intervención vinculada y la intervención cuenta sus documentos | §3.9 `?maintenance_record_id=` |
   | `MileageTest.php` | lista por fecha descendente y, a igual fecha, por km descendente | §3.4 orden del listado |
   | `MaintenanceExpenseTest.php` | ordena el historial por fecha desc y, a igual fecha, por km desc | §3.5 orden del listado |
   | `WorkOrderTest.php` | al pasar a listo puede quedarse en el elevador indicado; un estado final nunca ocupa elevador | §3.11 liberación de elevadores |
   | `WorkOrderTest.php` | `mileage_in` menor que el km actual se acepta en el taller y la orden mantiene una sola lectura | §3.11 + §3.4 (lectura `source=work_order`) |
   | `AuthTest.php` | al borrar la cuenta conserva los talleres que tienen otro propietario (+ el borrado de cuenta elimina los ficheros del garaje) | §3.1 `DELETE /me` |

3. **Verificación en MariaDB 10.4**, además de SQLite: la suite completa se ejecutó contra una base **separada** `carcare_test` (ya existía), sin tocar `carcare` ni los datos demo (comprobado antes y después: 4 usuarios, 22 vehículos, 31 órdenes; API en :8000 respondiendo `{"status":"ok"}`).
4. No ha hecho falta corregir código: ningún test nuevo ha destapado un bug.

## 3. Endpoints implementados (68 rutas, prefijo `/api/v1`)

Todas las rutas no públicas llevan `auth:sanctum`; todas las que reciben un recurso en la URL llevan `can:` (policy). Recurso de otro espacio ⇒ 404; rol insuficiente ⇒ 403.

| Área | Rutas | Permiso |
|------|-------|---------|
| Sistema | `GET health` | público |
| Autenticación | `POST auth/register`, `POST auth/login` (5 intentos/min por email+IP ⇒ 429), `POST auth/logout` | público / sesión |
| Cuenta | `GET/PATCH/DELETE me`, `PUT me/password` | sesión |
| Espacios | `GET/POST workspaces`; `GET/PATCH/DELETE workspaces/{ws}` | view / manage / own (409 en personal) |
| Miembros | `GET/POST workspaces/{ws}/members`; `PATCH/DELETE workspaces/{ws}/members/{user}` | view / manage (o uno mismo para salir) |
| Vistas del espacio | `GET workspaces/{ws}/dashboard`, `activity`, `reminders`, `analytics` | view (analytics: manage) |
| Vehículos | `GET/POST workspaces/{ws}/vehicles`; `GET/PATCH/DELETE vehicles/{v}`; `POST vehicles/{v}/archive`, `restore` | view / operate / manage |
| Vistas del vehículo | `GET vehicles/{v}/summary`, `zones`, `journal`, `report` | view |
| Kilometraje | `GET/POST vehicles/{v}/mileage`; `DELETE mileage/{log}` (solo `manual`) | view / operate |
| Intervenciones | `GET/POST vehicles/{v}/maintenance`; `GET/PATCH maintenance/{r}`; `POST maintenance/{r}/archive`, `restore` | view / operate |
| Gastos | `GET/POST vehicles/{v}/expenses`; `PATCH/DELETE expenses/{e}` (409 si vinculado) | manage |
| Recordatorios | `GET/POST vehicles/{v}/reminders`; `PATCH/DELETE reminders/{r}`; `POST reminders/{r}/complete`, `dismiss` | view / operate |
| Documentos | `GET/POST vehicles/{v}/documents`; `GET documents/{d}/download`; `DELETE documents/{d}` | view / operate |
| Clientes (taller) | `GET/POST workspaces/{ws}/customers`; `GET/PATCH/DELETE customers/{c}`; `GET customers/{c}/vehicles` | view / operate / manage (404 en personal) |
| Órdenes (taller) | `GET/POST workspaces/{ws}/work-orders`; `GET/PATCH/DELETE work-orders/{o}`; `POST work-orders/{o}/status`; `GET workspaces/{ws}/bays` | view / operate / manage (404 en personal) |

`GET /sanctum/csrf-cookie` lo sirve Sanctum (fuera de `api/`).

## 4. Decisiones técnicas

- **Capas:** `routes/api.php` → Form Request (mensajes en español, `ApiRequest` base) → middleware `can:` con Policies (`WorkspacePolicy` y `WorkspaceScopedPolicy`, que resuelve el espacio del recurso y devuelve `denyAsNotFound()` si no eres miembro) → controlador delgado → Service (transacciones, reglas, actividad) → Eloquent → API Resource.
- **Errores uniformes** en `bootstrap/app.php` (`withExceptions`): 401 "No autenticado.", 403 "No tienes permiso para esta acción.", 404 "Recurso no encontrado.", 409/429 con mensaje propio, 422 `{ message, errors }`, cualquier otra excepción ⇒ 500 "Error interno del servidor." sin trazas ni SQL. `ForceJsonResponse` antepuesto al grupo `api`.
- **Dinero:** `decimal(10,2)` con cast `decimal:2`; sumas en céntimos enteros (`App\Support\Money`, `Totals`) para evitar errores de coma flotante; IVA con redondeo half-up. Sin `intl`.
- **Kilometraje:** `MileageService` centraliza la regla §3.4 (retroceso ⇒ 422 salvo `confirm_mileage_drop`; km actual = lectura más reciente por fecha, desempate mayor km). Intervenciones, gastos, recordatorios y órdenes sincronizan **una** lectura por origen (`source`, `source_id`).
- **D3‑A sin doble conteo:** el gasto vinculado se crea/actualiza/borra en la misma transacción que la intervención (solo en espacios personales); todos los totales salen de `expenses`.
- **Numeración OT‑AAAA‑NNNN:** bloqueo `lockForUpdate` sobre la fila del espacio dentro de la transacción; una creación rechazada (409/422) no consume número.
- **Archivos:** disco privado `local` (`storage/app/private/documents/{workspace}/{uuid}.{ext}`), MIME real por contenido, descarga solo por controlador autorizado con `X-Content-Type-Options: nosniff`. Al borrar documento, vehículo, espacio o cuenta se borran también los ficheros.
- **Actividad:** `ActivityLogger` desde los servicios, con `summary` en español y sin datos sensibles.
- **Índices compuestos** donde se filtra (`vehicle_id, service_date`, `vehicle_id, recorded_at, mileage`, `workspace_id, status`, `workspace_id, bay`…) y FKs con `cascadeOnDelete`/`nullOnDelete` según el caso.
- **Datos demo:** `DemoSeeder` repetible (borra y recrea solo las 4 cuentas demo con `AccountService::delete`), con fechas relativas a hoy; aborta con `RuntimeException` en producción y `DatabaseSeeder` no siembra nada allí.
- **Dependencias:** ninguna nueva en esta sesión (Laravel 12, Sanctum 4, Pest 3).

## 5. Desviaciones del contrato

**Ninguna.** Hay tres puntos donde el contrato admitía más de una lectura; los he dejado como estaban implementados y los anoto para que el `arquitecto` los fije en el historial si lo ve bien:

1. **Periodo por defecto.** §4 dice "año natural en curso", pero la tabla de §3.2 dice "últimos 12 meses" para `/analytics`. Implementado según cada tabla de endpoints: `summary` = año en curso; `analytics` = 12 meses naturales hasta hoy (del día 1 de hace 11 meses a hoy); `journal` = últimos 30 días. Hay tests para cada uno.
2. **Elevador al pasar a `ready`/`delivered`/`cancelled` "salvo que se indique otro".** `ready` con `bay` indicado conserva ese elevador (la orden sigue abierta); `delivered` y `cancelled` siempre dejan `bay = null`, porque una orden cerrada nunca ocupa elevador.
3. **Reglas añadidas compatibles con el contrato** (no cambian formas JSON): reducir `bays_count` por debajo de un elevador ocupado ⇒ 409; solo un `owner` puede nombrar o retirar propietarios (un `manager` recibe 403); al quitar a un miembro sus órdenes quedan sin asignar; borrar una orden `received`/`cancelled` borra su lectura de km.

## 6. Evidencias

### `php artisan test` (SQLite en memoria, configuración de `phpunit.xml`)

```
   PASS  Tests\Feature\AnalyticsTest          (19)
   PASS  Tests\Feature\AuthTest               (11)
   PASS  Tests\Feature\ContractShapeTest      (67)
   PASS  Tests\Feature\DemoSeederTest         (5)
   PASS  Tests\Feature\DocumentTest           (6)
   PASS  Tests\Feature\IsolationTest          (215)
   PASS  Tests\Feature\MaintenanceExpenseTest (18)
   PASS  Tests\Feature\MileageTest            (8)
   PASS  Tests\Feature\ReminderTest           (22)
   PASS  Tests\Feature\RolesTest              (22)
   PASS  Tests\Feature\ValidationTest         (35)
   PASS  Tests\Feature\VehicleTest            (10)
   PASS  Tests\Feature\WorkOrderTest          (16)
   PASS  Tests\Feature\WorkspaceMemberTest    (8)

  Tests:    462 passed (6959 assertions)
  Duration: 32.75s
```

(Entre paréntesis, el número de tests por archivo contado sobre la salida real; los datasets cuentan cada caso por separado.)

### Misma suite contra MariaDB 10.4.32 (base `carcare_test`, no `carcare`)

```
DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=carcare_test DB_USERNAME=root DB_PASSWORD= php artisan test

  Tests:    462 passed (6959 assertions)
  Duration: 134.23s
```

### `php artisan route:list --path=api | tail -3`

```

                                                    Showing [68] routes

```

(Las dos últimas rutas, con `tail -5`: `GET|HEAD api/v1/workspaces/{workspace}/work-orders` y `POST api/v1/workspaces/{workspace}/work-orders`. Las 68 rutas empiezan por `api/v1/`.)

### Qué cubre la batería (resumen)

- **Aislamiento:** 404 a un usuario de otro espacio en las 58 rutas con recurso (dataset `endpoints con recurso`, 59 casos porque el dashboard se prueba en personal y en taller; 58 + 7 de cuenta + 3 públicas = 68), 404 a gerente y mecánico del taller sobre el garaje personal de la dueña, 404 en rutas de taller dentro de un espacio personal, y comprobación de que un intruso no modifica nada. Un test falla si aparece una ruta en `route:list` sin su caso.
- **401** en todas las rutas no públicas; toda ruta con recurso tiene middleware `can:`.
- **Roles:** mecánico ⇒ 403 en gastos, analítica, archivar/restaurar/borrar vehículos, borrar clientes y órdenes, ajustes y miembros; `revenue: null` en su dashboard; puede ver, operar y salir del taller. Gerente gestiona pero no borra el taller ni toca al propietario.
- **422** representativos en español para cada formulario y filtro, sin trazas ni SQL.
- **Reglas de negocio:** gasto vinculado sin doble conteo (resumen, dashboard, analítica, informe, gastos y diario), km con retroceso y confirmación, estado/progreso/recurrencia de recordatorios (incl. 31/01 + 1 mes = 28/02), numeración OT sin huecos y por año, elevador ocupado 409, entrega ⇒ intervención, coste/km y consumo lleno‑a‑lleno (gasolina y kWh) con datos conocidos, resumen, diario y zonas.
- **Forma JSON:** cada interfaz de respuesta de `frontend/src/api/types.ts` se compara clave a clave y tipo a tipo con la respuesta real (`tests/Support/Contract.php`), y cada enum PHP con su unión de literales en `types.ts`.
- **Datos demo:** cuentas, volúmenes, coherencia de km, D3‑A, numeración, login real de las cuentas demo, repetible y bloqueado en producción.

## 7. Limitaciones

- **Concurrencia de la numeración OT:** el bloqueo `lockForUpdate` es real en MariaDB, pero no hay un test con dos procesos a la vez (SQLite ignora `FOR UPDATE`); los tests prueban la ausencia de huecos de forma secuencial.
- **No lanzar dos `php artisan test` a la vez en la misma carpeta:** `Storage::fake('local')` usa un único directorio (`storage/framework/testing/disks/local`) y un proceso lo vacía mientras el otro lo usa. Me pasó al lanzar SQLite y MariaDB en paralelo (1 fallo espurio en cada uno); por separado, ambos en verde.
- **Cierre de sesión:** el test comprueba que la sesión queda cerrada; la regeneración del token CSRF está en el código (`invalidate()` + `regenerateToken()`), pero no se comprueba en un test.
- **Sin E2E en esta sesión:** no he probado la SPA contra la API; la integración la verificó la sesión principal (22/10) y le toca a `qa-tester` en la oleada 3.
- `tests/Unit` está vacío: todo se prueba como Feature contra la API.

## 8. Archivos tocados

- `backend/tests/Feature/AuthTest.php`, `DocumentTest.php`, `MaintenanceExpenseTest.php`, `MileageTest.php`, `VehicleTest.php`, `WorkOrderTest.php` (solo añadidos).
- `docs/equipo/informes/2026-10-23-backend-laravel-api-v1.md` (este informe) y mi fila de `docs/equipo/TABLERO.md`.
- Ningún cambio en `app/`, migraciones ni seeders. No he hecho commits (regla 11).

## 9. Siguiente paso propuesto

1. `arquitecto`: anotar en el historial del contrato las tres interpretaciones del apartado 5.
2. `devops`: CI con dos trabajos, `php artisan test` en SQLite y otro contra un servicio MariaDB 10.4 (el comando de arriba funciona tal cual).
3. `qa-tester`: E2E de los flujos críticos (registro, alta de vehículo, intervención con coste ⇒ gasto, orden hasta entrega) y un test de numeración concurrente contra MariaDB.
