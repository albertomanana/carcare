# Contrato de la API v1

> **Fuente de verdad de las formas JSON:** [`frontend/src/api/types.ts`](../../frontend/src/api/types.ts).
> Este documento fija endpoints, permisos, validaciones y reglas de negocio. Backend y frontend se construyen en paralelo contra él (desarrollo *contract-first*). Cualquier cambio se anota en el **Historial de cambios** al final y lo aprueba el agente `arquitecto` (o Alberto).

## 1. Convenciones

- Base: `/api/v1`. JSON en `snake_case`. Cabecera `Accept: application/json` siempre.
- Autenticación: **Laravel Sanctum en modo SPA** (cookie de sesión + `X-XSRF-TOKEN`). Antes del login el cliente pide `GET /sanctum/csrf-cookie`.
- En desarrollo el navegador habla solo con Vite (`localhost:5173`), que reenvía `/api` y `/sanctum` a Laravel (`127.0.0.1:8000`). Mismo origen ⇒ sin CORS.
- Recurso individual: `{ "data": {...} }`. Listado paginado: `{ "data": [...], "meta": { current_page, last_page, per_page, total } }` (`per_page` por defecto 25, máx. 100, parámetro `?page=` y `?per_page=`). Listados pequeños sin paginar (miembros, bays, zonas, items) devuelven `{ "data": [...] }`.
- Fechas `YYYY-MM-DD`; instantes ISO 8601. Dinero: **string** con 2 decimales. Kilometraje: entero.
- Errores: `{ "message": "..." }` y, en 422, `{ "message", "errors": { campo: [mensajes] } }`. Mensajes en **español**. Nunca trazas ni SQL.
- Códigos: 200, 201 (creado), 204 (sin contenido), 401 (sin sesión), 403 (rol insuficiente dentro de un espacio al que perteneces), **404 (el recurso no existe o no es de tus espacios — no se revela su existencia)**, 409 (conflicto de estado), 422 (validación), 429 (rate limit).

## 2. Modelo de acceso: espacios de trabajo

Todo dato cuelga de un **espacio de trabajo** (`workspaces`):

| Tipo | Para quién | Se crea |
|------|-----------|---------|
| `personal` | Particular: "Mi garaje" | Automáticamente al registrarse (siempre, uno por usuario) |
| `workshop` | Taller / flota profesional | Al registrarse como taller o desde Ajustes → "Crear taller" |

Un usuario puede pertenecer a varios espacios. Las tablas hijas **no** duplican `user_id`: la propiedad se resuelve `recurso → vehículo → espacio → miembros`.

### Roles y permisos

| Capacidad | owner | manager | mechanic |
|-----------|:-----:|:-------:|:--------:|
| Ver todo el espacio (vehículos, historial, órdenes, clientes, documentos) | ✔ | ✔ | ✔ |
| **operate**: crear/editar vehículos, intervenciones, kilometraje, recordatorios, documentos, órdenes, clientes | ✔ | ✔ | ✔ |
| **manage**: archivar/eliminar vehículos y clientes, gastos, facturación/analítica, ajustes del espacio, miembros | ✔ | ✔ | ✘ |
| **own**: eliminar el espacio de taller | ✔ | ✘ | ✘ |

- En `personal` solo existe el `owner`.
- El rol `mechanic` recibe `revenue: null` en el dashboard y 403 en `/analytics` y en gastos.
- Implementación sugerida: `Gate`/Policies con `WorkspacePolicy::view|operate|manage|own` y policies de recurso que delegan en el espacio del vehículo. Resolver recursos de otros espacios con **404** (p. ej. scoping en la consulta o `abort(404)` en la policy).

## 3. Endpoints

### 3.1 Sistema y autenticación

| Método | Ruta | Cuerpo / query | Respuesta |
|--------|------|----------------|-----------|
| GET | `/api/v1/health` | — | `{ "status": "ok" }` |
| GET | `/sanctum/csrf-cookie` | — | 204 + cookie `XSRF-TOKEN` |
| POST | `/api/v1/auth/register` | `RegisterInput` | 201 `Resource<Me>` (deja la sesión iniciada) |
| POST | `/api/v1/auth/login` | `LoginInput` | 200 `Resource<Me>` · 422 "Las credenciales no son correctas." (mensaje genérico) · 429 tras 5 intentos/min por email+IP |
| POST | `/api/v1/auth/logout` | — | 204 (invalida sesión y regenera token CSRF) |
| GET | `/api/v1/me` | — | `Resource<Me>` · 401 sin sesión |
| PATCH | `/api/v1/me` | `{ name?, email? }` | `Resource<Me>` |
| PUT | `/api/v1/me/password` | `{ current_password, password, password_confirmation }` | 204 |
| DELETE | `/api/v1/me` | `{ password }` | 204. Borra el espacio personal y sus datos; en talleres donde es `owner` único, borra el taller. |

Validación de registro: `name` 2–100; `email` válido, único (case-insensitive, se guarda en minúsculas); `password` ≥ 8 con confirmación; `account_type` personal|workshop; `workshop_name` obligatorio si workshop (2–100).

### 3.2 Espacios, miembros, dashboard, actividad

| Método | Ruta | Permiso | Respuesta |
|--------|------|---------|-----------|
| GET | `/api/v1/workspaces` | autenticado | `{ data: Workspace[] }` |
| POST | `/api/v1/workspaces` | autenticado | `{ name }` → 201 `Resource<Workspace>` (siempre `type: workshop`, el creador es owner) |
| GET | `/api/v1/workspaces/{ws}` | view | `Resource<Workspace>` |
| PATCH | `/api/v1/workspaces/{ws}` | manage | `{ name?, settings?: { bays_count?, tax_rate? } }` (`bays_count` 1–12, `tax_rate` 0–100) |
| DELETE | `/api/v1/workspaces/{ws}` | own | 204. 409 si es `personal` |
| GET | `/api/v1/workspaces/{ws}/members` | view | `{ data: Member[] }` |
| POST | `/api/v1/workspaces/{ws}/members` | manage | `{ email, role: manager|mechanic }` → añade un **usuario ya registrado** (422 "No existe ninguna cuenta con ese email" si no existe). 409 en espacio personal. |
| PATCH | `/api/v1/workspaces/{ws}/members/{user}` | manage | `{ role }`. No se puede cambiar el rol del último owner (409). |
| DELETE | `/api/v1/workspaces/{ws}/members/{user}` | manage (o uno mismo para salir) | 204. No se puede quitar al último owner (409). |
| GET | `/api/v1/workspaces/{ws}/dashboard` | view | `Resource<WorkspaceDashboard>` según tipo |
| GET | `/api/v1/workspaces/{ws}/activity` | view | `Paginated<Activity>` (desc), `?vehicle_id=` opcional |
| GET | `/api/v1/workspaces/{ws}/reminders` | view | `Paginated<Reminder>` con `vehicle`, solo `pending`, orden por urgencia; `?state=overdue|soon|ok|unknown` |
| GET | `/api/v1/workspaces/{ws}/analytics` | manage | `Resource<WorkspaceAnalytics>`, `?from&to` (por defecto últimos 12 meses) |

### 3.3 Vehículos

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/workspaces/{ws}/vehicles` | view | `Paginated<Vehicle>`. Query: `archived=0|1` (def. 0), `search` (marca, modelo, apodo, matrícula, VIN, cliente), `customer_id`, `sort=recent|name|mileage` |
| POST | `/api/v1/workspaces/{ws}/vehicles` | operate | `VehicleInput` → 201 |
| GET | `/api/v1/vehicles/{v}` | view | `Resource<Vehicle>` |
| PATCH | `/api/v1/vehicles/{v}` | operate | `VehicleInput` parcial. `current_mileage` **no** se edita aquí (usar `/mileage`) |
| POST | `/api/v1/vehicles/{v}/archive` · `/restore` | manage | `Resource<Vehicle>` |
| DELETE | `/api/v1/vehicles/{v}` | manage | Solo si está archivado (409 si no). Borra en cascada su historial y archivos |
| GET | `/api/v1/vehicles/{v}/summary` | view | `Resource<VehicleSummary>`, `?from&to` (def. año en curso) |
| GET | `/api/v1/vehicles/{v}/zones` | view | `{ data: ZoneStatus[] }` — siempre las 10 zonas en el orden del enum |
| GET | `/api/v1/vehicles/{v}/journal` | view | `{ data: JournalDay[] }`, `?from&to` (def. últimos 30 días), días sin eventos omitidos, desc |
| GET | `/api/v1/vehicles/{v}/report` | view | `Resource<VehicleReport>` |

Validación: `make` 1–60, `model` 1–80, `year` 1900…(año actual + 1), `color_hex` `^#[0-9A-Fa-f]{6}$`, `plate` se normaliza (mayúsculas, sin espacios ni guiones) y es única por espacio entre no archivados, `vin` 17 caracteres `[A-HJ-NPR-Z0-9]` única por espacio, `purchase_mileage`/`current_mileage` enteros 0–2.000.000, `customer_id` debe ser del mismo espacio y **solo en talleres** (422 en personal).

### 3.4 Kilometraje

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/vehicles/{v}/mileage` | view | `Paginated<MileageLog>` desc por `recorded_at`, luego `mileage` |
| POST | `/api/v1/vehicles/{v}/mileage` | operate | `MileageInput` → 201 |
| DELETE | `/api/v1/mileage/{log}` | operate | Solo `source=manual`. Recalcula `current_mileage` |

**Regla de kilometraje (aplica también a intervenciones, gastos, órdenes y recordatorios con km):**
1. Cada dato con km crea un `mileage_log` con su `source` y `source_id`.
2. `vehicles.current_mileage` = km de la lectura **más reciente por fecha** (desempate: mayor km); `mileage_updated_at` = esa fecha.
3. Si el nuevo km es **menor** que el de alguna lectura con fecha **anterior o igual**, o **mayor** que el de una lectura con fecha **posterior**, la API responde 422 `errors.mileage = ["El kilometraje no cuadra con lecturas anteriores (último: 84.200 km el 12/03/2026). Confírmalo si es correcto."]` salvo que llegue `confirm_mileage_drop: true`.
4. `recorded_at` no puede ser futura.

### 3.5 Intervenciones

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/vehicles/{v}/maintenance` | view | `Paginated<MaintenanceRecord>`. Orden `service_date` desc, desempate `mileage` desc. Query: `type`, `zone`, `year`, `search` (título, taller, descripción), `archived=0|1` |
| POST | `/api/v1/vehicles/{v}/maintenance` | operate | `MaintenanceInput` → 201 |
| GET | `/api/v1/maintenance/{r}` | view | con `items` |
| PATCH | `/api/v1/maintenance/{r}` | operate | Si llega `items`, **reemplaza** todas las líneas |
| POST | `/api/v1/maintenance/{r}/archive` · `/restore` | operate | |

Validación: `title` 2–120, `service_date` no futura, importes ≥ 0 y ≤ 999.999,99 con 2 decimales, `items` máx. 50, `quantity` > 0.

**D3‑A — Sin doble conteo:** en espacios **personales**, al guardar una intervención con `total_cost` > 0 se crea/actualiza en la misma transacción un gasto vinculado (`category = repair` si `type ∈ {repair, breakdown, bodywork}`, `inspection` si `type = inspection`, si no `maintenance`; misma fecha, km e importe; `description` = título). Si `total_cost` pasa a null/0, el gasto vinculado se elimina. Al archivar, el gasto vinculado deja de contar (se elimina; al restaurar se recrea). **Todos los totales de gasto salen solo de `expenses`.** En talleres no se generan gastos: la cifra económica es la facturación de órdenes.

### 3.6 Gastos (permiso manage en talleres; owner en personal)

| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/v1/vehicles/{v}/expenses` | `Paginated<Expense>`, desc. Query: `from`, `to`, `category` (admite lista separada por comas) |
| POST | `/api/v1/vehicles/{v}/expenses` | `ExpenseInput` → 201 |
| PATCH | `/api/v1/expenses/{e}` | 409 si `is_linked` ("Este gasto se gestiona desde su intervención.") |
| DELETE | `/api/v1/expenses/{e}` | 204; 409 si `is_linked` |

Validación: `amount` > 0; `expense_date` no futura; `fuel_quantity`, `fuel_unit` y `full_tank` solo se aceptan con `category = fuel` (si no, se guardan null); `fuel_unit` por defecto `kwh` si el vehículo es eléctrico, si no `l`.

### 3.7 Recordatorios

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/vehicles/{v}/reminders` | view | `{ data: Reminder[] }`, `?status=pending|done|dismissed|all` (def. pending). Orden: overdue, soon, ok, unknown; luego por fecha |
| POST | `/api/v1/vehicles/{v}/reminders` | operate | `ReminderInput` → 201. Al menos `due_date` o `due_mileage` (422 si ninguno) |
| PATCH | `/api/v1/reminders/{r}` | operate | |
| DELETE | `/api/v1/reminders/{r}` | operate | 204 |
| POST | `/api/v1/reminders/{r}/complete` | operate | `CompleteReminderInput` → `{ data: { completed: Reminder, next: Reminder | null } }` |
| POST | `/api/v1/reminders/{r}/dismiss` | operate | `Resource<Reminder>` |

**Cálculo del estado** (solo `pending`, se calcula al serializar, no se guarda):
- `days_left` = `due_date − hoy` (null si no hay `due_date`). `km_left` = `due_mileage − current_mileage` (null si falta alguno).
- `overdue` si `days_left < 0` o `km_left < 0`; `soon` si `days_left ≤ 30` o `km_left ≤ 1000`; `unknown` si solo hay `due_mileage` y el vehículo no tiene km; si no, `ok`.
- `progress` = máx. de (`días transcurridos desde starts_on / días totales`) y (`km desde start_mileage / km totales`); null si no calculable.
- `zone` por defecto según `kind`: oil, timing_belt → engine; tyres → tyres; brakes → brakes; battery → electrical; itv, insurance, tax, service, custom → general.
- Completar: `status=done`, guarda `completed_at`/`completed_mileage` (si llega km, crea lectura `source=reminder`). Si hay recurrencia y `create_next ≠ false`, crea el siguiente con `starts_on = completed_at`, `start_mileage = completed_mileage`, `due_date = completed_at + recurrence_months`, `due_mileage = completed_mileage + recurrence_km`.

### 3.8 Zonas (mapa 3D)

`GET /api/v1/vehicles/{v}/zones` → 10 `ZoneStatus` (engine, transmission, brakes, tyres, suspension, electrical, body, interior, exhaust, general) con etiquetas: Motor, Transmisión, Frenos, Neumáticos, Suspensión y dirección, Eléctrico y batería, Carrocería, Interior y climatización, Escape, General.
- `state` = peor estado (overdue > soon > ok > unknown) de los recordatorios pendientes de esa zona; `basis = reminders`.
- Sin recordatorios pero con intervenciones no archivadas: `state = unknown`, `basis = records`.
- Sin nada: `state = unknown`, `basis = none`.
- **La interfaz siempre lo etiqueta como "según tus intervalos, no medido".**

### 3.9 Documentos

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/vehicles/{v}/documents` | view | `{ data: VehicleDocument[] }`, `?document_type=`, `?maintenance_record_id=` |
| POST | `/api/v1/vehicles/{v}/documents` | operate | `multipart/form-data`: `file`, `title`, `document_type`, `maintenance_record_id?` (del mismo vehículo), `expires_at?` → 201 |
| GET | `/api/v1/documents/{d}/download` | view | Stream con `Content-Disposition: attachment` (o `inline` con `?inline=1` para PDF/imagen). Cabecera `X-Content-Type-Options: nosniff` |
| DELETE | `/api/v1/documents/{d}` | operate | 204, borra el fichero |

Archivos: disco **privado** (`storage/app/private/documents/{workspace}/{uuid}.{ext}`), nunca en `public/`. Máx. 10 MB. MIME real (`mimetypes:`) en `application/pdf, image/jpeg, image/png, image/webp`. Nombre interno UUID; `original_filename` saneado.

### 3.10 Taller: clientes

Solo en espacios `workshop` (en `personal` → 404 en estas rutas).

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/v1/workspaces/{ws}/customers` | view · `Paginated<Customer>`, `?search=` (nombre, email, teléfono, NIF) |
| POST | `/api/v1/workspaces/{ws}/customers` | operate · `CustomerInput` → 201 |
| GET/PATCH | `/api/v1/customers/{c}` | view / operate |
| DELETE | `/api/v1/customers/{c}` | manage · 409 si tiene órdenes abiertas; sus vehículos quedan con `customer = null` |
| GET | `/api/v1/customers/{c}/vehicles` | view · `{ data: Vehicle[] }` |

### 3.11 Taller: órdenes de trabajo y elevadores

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/workspaces/{ws}/work-orders` | view | `Paginated<WorkOrder>`, `?status=` (lista por comas, o `open` = todo menos delivered/cancelled), `?vehicle_id`, `?customer_id`, `?assigned_to`, `?search` (número, título, matrícula, cliente), `per_page` hasta 200 para el tablero kanban |
| POST | `/api/v1/workspaces/{ws}/work-orders` | operate | `WorkOrderInput` → 201, `status = received`, `received_at = ahora`, `customer` copiado del vehículo |
| GET/PATCH | `/api/v1/work-orders/{o}` | view / operate | 409 si está `delivered` o `cancelled` (solo lectura) |
| DELETE | `/api/v1/work-orders/{o}` | manage | Solo en `received` o `cancelled` |
| POST | `/api/v1/work-orders/{o}/status` | operate | `WorkOrderStatusInput` → `Resource<WorkOrder>` |
| GET | `/api/v1/workspaces/{ws}/bays` | view | `{ data: Bay[] }` (1…`bays_count`) |

Reglas:
- `number` = `OT-{año}-{secuencial de 4 dígitos}` por espacio y año, sin huecos por concurrencia (bloqueo en transacción).
- Totales: `subtotal = Σ items.total`, `tax_amount = subtotal × tax_rate / 100` (redondeo half-up a 2 decimales), `total = subtotal + tax_amount`. `tax_rate` por defecto el del espacio.
- `bay` entre 1 y `bays_count`; **un elevador solo puede tener una orden abierta** (409 "El elevador 2 está ocupado por OT-2026-0004"). Pasar a `ready`, `delivered` o `cancelled` libera el elevador (`bay = null`) salvo que se indique otro.
- Estados finales: `delivered` y `cancelled` no admiten más cambios (409). El resto puede moverse libremente entre sí (tablero kanban).
- Al pasar a `ready` se fija `completed_at`. Al pasar a `delivered` se fija `delivered_at` y se crea, en la misma transacción, una **intervención** en el historial del vehículo: `type = repair` (o `maintenance` si todas las líneas son de mantenimiento — por simplicidad: `repair`), `zone = general`, `title` = título de la orden, `description` = diagnóstico, `service_date` = fecha de entrega, `mileage = mileage_in`, `workshop_name` = nombre del espacio, `total_cost = total`, líneas copiadas, `work_order_id` enlazado. `maintenance_record_id` de la orden apunta a ella.
- `mileage_in` crea una lectura de km (`source = work_order`) con las reglas de §3.4 (en talleres se acepta sin confirmación si es menor, pero se registra igualmente).
- `assigned_to` debe ser miembro del espacio.

### 3.12 Actividad (auditoría ligera)

Cada acción de escritura relevante registra un `Activity` (sin secretos ni datos personales sensibles en `metadata`): `vehicle.created|updated|archived|restored|deleted`, `mileage.recorded`, `maintenance.created|updated|archived`, `expense.created|updated|deleted`, `reminder.created|completed|dismissed`, `document.uploaded|deleted`, `customer.created`, `work_order.created|updated|status_changed`, `member.added|removed|role_changed`. `summary` en español listo para mostrar.

## 4. Analítica: definiciones

- **Periodo**: `from`/`to` inclusivos. Por defecto, el año natural en curso hasta hoy.
- **`totals.month` / `totals.year`**: mes y año naturales de `to`.
- **`previous_period`**: periodo inmediatamente anterior de la misma duración; `null` si no tiene ningún gasto. `change_pct = (period − previous) / previous × 100`, 1 decimal.
- **Coste por km**: disponible solo si dentro del periodo hay ≥ 2 lecturas de km separadas ≥ 500 km **y** ≥ 30 días. `km = máx − mín` de lecturas del periodo; `value = total del periodo / km`. Si no, `reason` dice exactamente qué falta ("Necesitas al menos dos lecturas de kilometraje separadas 30 días y 500 km en este periodo.").
- **Consumo** (método lleno‑a‑lleno): entre dos repostajes consecutivos con `full_tank = true` y km informado, `consumo = Σ cantidad repostada después del primero hasta el segundo inclusive / km recorridos × 100`. Media ponderada de los tramos del periodo. Requiere ≥ 2 repostajes llenos con km. Unidad según `fuel_unit` predominante.
- **`km_this_month` / `km_this_year`**: diferencia entre la última lectura del periodo y la última anterior al inicio del periodo (o la primera del periodo si no hay anterior); null si < 2 lecturas.
- **`avg_daily_km`**: (km última − km primera) / días entre ambas, sobre los últimos 90 días; null si < 2 lecturas o < 7 días.
- **`since_last`**: para `oil`, `service`, `itv` busca la última intervención no archivada con ese `service_kind`; `days` desde su fecha y `km` = `current_mileage − record.mileage` (null si falta).
- **Diario (`journal`)**: `km_driven` de un día = lectura máxima del día − lectura anterior más reciente (null si no hay ambas). `spent` = suma de gastos del día.

## 5. Datos de demostración

`php artisan db:seed --class=DemoSeeder` (nunca en producción; el seeder aborta si `APP_ENV=production`):
- `demo@carcare.test` / `password` → espacio personal con 2 vehículos (p. ej. hatchback rojo y SUV gris) y ~18 meses de historial **claramente ficticio**: lecturas de km semanales, repostajes llenos, intervenciones con líneas, gastos varios, recordatorios (uno vencido, uno próximo, varios ok) y algún documento de ejemplo.
- `taller@carcare.test` / `password` → espacio taller "Taller Demo" con 4 elevadores, 2 miembros más (`mecanico@carcare.test` mechanic, `gerente@carcare.test` manager), ~12 clientes, ~20 vehículos de distintas carrocerías y colores y ~30 órdenes repartidas por todos los estados (algunas tarde, 3 en elevadores).

## 6. Historial de cambios

| Fecha | Cambio | Aprobado por |
|-------|--------|--------------|
| 2026-10-21 | Versión inicial: espacios personal/taller, zonas 3D, diario, órdenes de trabajo | Arquitecto (sesión de arranque) |
