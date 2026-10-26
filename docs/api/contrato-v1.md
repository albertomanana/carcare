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
| **manage**: archivar/eliminar vehículos y clientes, gastos, importes y analítica, ajustes del espacio, miembros | ✔ | ✔ | ✘ |
| **own**: eliminar el espacio de taller | ✔ | ✘ | ✘ |

- En `personal` solo existe el `owner`.
- El rol `mechanic` recibe `revenue: null` en el dashboard y 403 en `/analytics` y en gastos.
- Implementación sugerida: `Gate`/Policies con `WorkspacePolicy::view|operate|manage|own` y policies de recurso que delegan en el espacio del vehículo. Resolver recursos de otros espacios con **404** (p. ej. scoping en la consulta o `abort(404)` en la policy).
- **Única excepción entre espacios (E16, [ADR‑0007](../arquitectura/ADR-0007-solicitudes-a-talleres.md)):**
  - el directorio de talleres, que es optativo y solo muestra lo que publica el owner;
  - la solicitud de reparación, un recurso con exactamente dos partes: el owner del espacio personal que la envía y los miembros del taller destinatario.

  Ninguna otra ruta cambia: los vehículos, intervenciones, gastos, documentos, clientes y órdenes del otro espacio siguen dando 404. Ver §3.13.

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
| POST | `/api/v1/auth/forgot-password` | `ForgotPasswordInput` | **204 siempre, exista o no la cuenta** · 422 solo si el email falta o no tiene formato · 429 a partir de la 6.ª petición en un minuto desde la misma IP. Ver §3.1.1 |
| POST | `/api/v1/auth/reset-password` | `ResetPasswordInput` | 204 (cierra todas las sesiones de la cuenta; no inicia sesión) · 422 `errors.token` / `errors.password` / `errors.email` · 429 igual que el anterior. Ver §3.1.1 |

Validación de registro: `name` 2–100; `email` válido, único (case-insensitive, se guarda en minúsculas); `password` ≥ 8 con confirmación; `account_type` personal|workshop; `workshop_name` obligatorio si workshop (2–100).

### 3.1.1 Recuperar la contraseña

E1‑6 · D17 = A (decidida por Alberto el 24/10/2026) · [ADR‑0006](../arquitectura/ADR-0006-recuperar-contrasena.md).

**Flujo**
1. En la pantalla `/recuperar`, la SPA pide `GET /sanctum/csrf-cookie` y envía `POST /auth/forgot-password { email }`.
2. La API normaliza el email (minúsculas y sin espacios, como en el login).
   - **Si existe una cuenta**, el broker de contraseñas de Laravel (`Password::sendResetLink`) crea un token y envía el correo.
   - **Si no existe, no hace nada.**
   - En los dos casos responde **204**, sin cuerpo.
   - La SPA muestra siempre el mismo texto: "Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 60 minutos."
3. El correo, con asunto y texto en español:
   - lleva el enlace `{FRONTEND_URL}/restablecer?token={token}&email={email codificado para URL}`;
   - dice que caduca en 60 minutos y que, si no lo has pedido tú, puedes ignorarlo.

   `FRONTEND_URL` sale de `config('app.frontend_url')`, con valor por defecto `http://localhost:5173`. El enlace apunta a la SPA, nunca a la API (`ResetPassword::createUrlUsing`).
4. La pantalla `/restablecer` lee `token` y `email` de la URL, pide la contraseña nueva dos veces y envía `POST /auth/reset-password`. Con 204, navega a `/entrar` con el aviso: "Contraseña cambiada. Entra con la nueva; hemos cerrado las sesiones abiertas."

**Token**
- Lo crea el broker de Laravel y lo guarda **hasheado** en `password_reset_tokens`. La tabla ya existe en la migración de usuarios; en la BD el token nunca está en claro.
- **Caduca a los 60 minutos** (`config/auth.php`: `passwords.users.expire = 60`).
- **Es de un solo uso**: un restablecimiento correcto lo borra. Si se pide otro enlace, sustituye al anterior: solo vale el último.
- El broker no envía más de un correo por minuto a la misma cuenta (`passwords.users.throttle = 60`). Si se pide antes, la API no envía nada y **responde igualmente 204**: el estado `RESET_THROTTLED` del broker no se distingue de un envío correcto, ni tampoco `INVALID_USER`.

**Al restablecer con éxito** (en una transacción):
- se guarda el hash de la contraseña nueva y se rota `remember_token`, así que las cookies "Recordarme" dejan de valer;
- se borra el token;
- **se cierran todas las sesiones abiertas de la cuenta**: se borran las filas de `sessions` con ese `user_id` (el driver de sesión es `database`), incluida la del navegador actual si tuviera una;
- **no se inicia sesión**: el usuario entra con la contraseña nueva desde `/entrar`.

**Errores**

| Caso | Respuesta |
|------|-----------|
| `email` vacío o sin formato de email (en los dos endpoints) | 422 `errors.email`, mensaje en español |
| `password` con menos de 8 o más de 255 caracteres, o con una confirmación distinta (mismas reglas que el registro) | 422 `errors.password` |
| `token` vacío | 422 `errors.token` |
| Token incorrecto, caducado o ya usado, **o** email sin cuenta | 422 `errors.token = ["El enlace para cambiar la contraseña no es válido o ha caducado. Pide uno nuevo."]`: **el mismo mensaje en todos estos casos** |
| Más de 5 peticiones por minuto desde la misma IP, con un contador por endpoint (`throttle:5,1`) | 429 con cabecera `Retry-After` y `message` en español. Cuenta todas las peticiones, exista o no la cuenta, así que tampoco revela nada |

Para que el tiempo de respuesta no delate si la cuenta existe (el broker hashea el token con bcrypt), se recomienda calcular un hash de relleno cuando la cuenta no existe. Ver ADR‑0006.

**Sanctum y CSRF**
- Las dos rutas son públicas, fuera de `auth:sanctum`, como `login`: no necesitan sesión iniciada ni la crean.
- Como llegan desde el dominio de la SPA, pasan por el middleware *stateful* de Sanctum y **exigen CSRF**. La SPA llama antes a `GET /sanctum/csrf-cookie` (`ensureCsrfCookie()`, igual que en el login) y envía `X-XSRF-TOKEN`.
- Sin ese token la API responde 419, y el cliente HTTP ya lo renueva y reintenta una vez.

**Rutas de la SPA**
- `/recuperar` (formulario del email) y `/restablecer?token=…&email=…` (contraseña nueva) son rutas de invitado, como `/entrar` (`GuestOnly`). Con una sesión abierta redirigen a la app, donde la contraseña se cambia desde Ajustes (`PUT /me/password`).
- Si a `/restablecer` le falta `token` o `email`, no muestra el formulario: explica que el enlace está incompleto y ofrece "Pedir un enlace nuevo", que lleva a `/recuperar`.
- Ante un 422 en `errors.token`, la SPA muestra el mensaje con el mismo enlace a `/recuperar`.
- `LoginPage` muestra el enlace "¿Has olvidado tu contraseña?", que lleva a `/recuperar`.
- La SPA no carga recursos de terceros, así que el token de la URL no se filtra por la cabecera `Referer`. El token no se guarda en `localStorage` ni se escribe en la consola.

**Correo solo en local (D17 = A)**
- `MAIL_MAILER=log` es el valor por defecto de `config/mail.php`. Laravel escribe el correo completo en `storage/logs/laravel.log`, sin servicio externo.
- Para pasar a un servicio real basta con cambiar la configuración del mailer: el código no cambia.

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
| DELETE | `/api/v1/vehicles/{v}` | manage | Solo si está archivado (409 si no). Borra en cascada su historial y archivos. En personal, cancela sus solicitudes de reparación abiertas y avisa al taller (§3.13.4). En un taller, la copia enlazada de otro vehículo solo pierde el enlace |
| GET | `/api/v1/vehicles/{v}/summary` | view | `Resource<VehicleSummary>`, `?from&to` (def. año en curso) |
| GET | `/api/v1/vehicles/{v}/zones` | view | `{ data: ZoneStatus[] }` — siempre las 10 zonas en el orden del enum |
| GET | `/api/v1/vehicles/{v}/journal` | view | `{ data: JournalDay[] }`, `?from&to` (def. últimos 30 días), días sin eventos omitidos, desc |
| GET | `/api/v1/vehicles/{v}/report` | view | `Resource<VehicleReport>` |

Validación: `make` 1–60, `model` 1–80, `year` 1900…(año actual + 1), `color_hex` `^#[0-9A-Fa-f]{6}$`, `plate` se normaliza (mayúsculas, sin espacios ni guiones) y es única por espacio entre no archivados, `vin` 17 caracteres `[A-HJ-NPR-Z0-9]` única por espacio, `purchase_mileage`/`current_mileage` enteros 0–2.000.000, `customer_id` debe ser del mismo espacio y **solo en talleres** (422 en personal); si ese cliente está anonimizado, 422 `errors.customer_id = ["Este cliente está anonimizado: crea uno nuevo."]` (§3.10.1).

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

### 3.4.1 Origen de cada lectura

E7‑1. `MileageLog.source_id` es el id del registro que generó la lectura. Se guarda en la columna `mileage_logs.source_id`, que ya existía y ya rellenaban los servicios; hasta ahora no se devolvía.

| `source` | `source_id` apunta a | Ciclo de vida de la lectura |
|----------|----------------------|-----------------------------|
| `manual` | `null` | Se crea con `POST /mileage`. Son las únicas que se borran con `DELETE /mileage/{log}` |
| `vehicle_created` | El propio vehículo (`= vehicle_id`) | Se crea al dar de alta el vehículo con `current_mileage` |
| `maintenance` | `MaintenanceRecord.id` | Se crea o actualiza al guardar una intervención con km. Archivar la intervención **no** borra la lectura (sigue siendo un dato real), así que el origen puede ser una intervención archivada |
| `expense` | `Expense.id` | Se crea o actualiza al guardar un gasto con km, y se borra con el gasto. El gasto vinculado a una intervención (D3‑A) **no** tiene lectura propia: la única es la de la intervención |
| `work_order` | `WorkOrder.id` | Se crea con `mileage_in` y se borra con la orden. Si la orden cambia de vehículo, la lectura pasa al nuevo. La intervención que se crea al entregar la orden **no** genera otra lectura |
| `reminder` | `Reminder.id` (completado) | Se crea al completar el recordatorio indicando km. **Nuevo:** borrar el recordatorio (`DELETE /reminders/{r}`) borra su lectura y recalcula `current_mileage`, igual que con gastos y órdenes |

Reglas:
1. **Mismo vehículo, siempre.** `source_id` es de un registro del mismo vehículo y, por tanto, del mismo espacio: nunca apunta a otro espacio. Lo garantizan los servicios, que solo crean lecturas a partir de registros de ese vehículo.
2. **Nunca huérfano.** Borrar el origen borra su lectura (tabla anterior). Puede que ya haya lecturas huérfanas: las de recordatorios borrados antes de este cambio. Una migración de datos las pasa a `source = manual`, `source_id = null` y `note = "Recordatorio eliminado"`. Así siguen contando y se pueden borrar.
3. **Depende del rol, como `revenue`.** Si el usuario no puede ver gastos (rol `mechanic` en un taller), las lecturas `expense` llegan con `source_id = null`; el `source` sí llega. Vale para `GET /vehicles/{v}/mileage` y para `VehicleReport.mileage_logs`.
4. **El enlace no da acceso a nada.** Al seguirlo, el endpoint de destino aplica su propia autorización: 404 si es de otro espacio, 403 si el rol no alcanza.
5. **Cuándo enlaza la SPA.** Enlaza cuando `source_id` no es null y `source` es `maintenance`, `expense`, `work_order` o `reminder`. Con `manual`, con `vehicle_created` o con `source_id = null`, el origen se muestra como texto.

### 3.5 Intervenciones

| Método | Ruta | Permiso | Notas |
|--------|------|---------|-------|
| GET | `/api/v1/vehicles/{v}/maintenance` | view | `Paginated<MaintenanceRecord>`. Orden `service_date` desc, desempate `mileage` desc. Query: `type`, `zone`, `year`, `search` (título, taller, descripción), `archived=0|1` |
| POST | `/api/v1/vehicles/{v}/maintenance` | operate | `MaintenanceInput` → 201 |
| GET | `/api/v1/maintenance/{r}` | view | con `items` |
| PATCH | `/api/v1/maintenance/{r}` | operate | Si llega `items`, **reemplaza** todas las líneas |
| POST | `/api/v1/maintenance/{r}/archive` · `/restore` | operate | |

Validación: `title` 2–120, `service_date` no futura, importes ≥ 0 y ≤ 999.999,99 con 2 decimales, `items` máx. 50, `quantity` > 0.

**D3‑A — Sin doble conteo:** en espacios **personales**, al guardar una intervención con `total_cost` > 0 se crea/actualiza en la misma transacción un gasto vinculado (`category = repair` si `type ∈ {repair, breakdown, bodywork}`, `inspection` si `type = inspection`, si no `maintenance`; misma fecha, km e importe; `description` = título). Si `total_cost` pasa a null/0, el gasto vinculado se elimina. Al archivar, el gasto vinculado deja de contar (se elimina; al restaurar se recrea). **Todos los totales de gasto salen solo de `expenses`.** En talleres no se generan gastos: la cifra económica es el importe de las órdenes entregadas (D12 = A: CarCare no emite facturas).

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
| DELETE | `/api/v1/reminders/{r}` | operate | 204. Si se completó con km, borra también su lectura (`source = reminder`) y recalcula `current_mileage` (§3.4.1) |
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
| GET/PATCH | `/api/v1/customers/{c}` | view / operate · PATCH ⇒ 409 si está anonimizado ("Este cliente está anonimizado: sus datos ya no se pueden editar.") |
| DELETE | `/api/v1/customers/{c}` | manage · 409 si tiene órdenes abiertas; sus vehículos quedan con `customer = null`; las frases de actividad que lo nombran se reescriben sin su nombre (§3.10.1) |
| GET | `/api/v1/customers/{c}/vehicles` | view · `{ data: Vehicle[] }` |
| POST | `/api/v1/customers/{c}/export` | manage · 200 `Resource<CustomerExport>` (§3.10.1) |
| POST | `/api/v1/customers/{c}/anonymize` | manage · sin cuerpo · 200 `Resource<Customer>` · 409 si ya está anonimizado o tiene órdenes abiertas (§3.10.1) |

### 3.10.1 Derechos RGPD del cliente

E11‑6 · [ADR‑0005](../arquitectura/ADR-0005-rgpd-cliente-taller.md).

**Permisos.** Solo owner y manager (`manage`):
- mechanic ⇒ 403;
- un cliente de otro espacio ⇒ 404;
- en los espacios personales no hay clientes ⇒ 404.

**Exportar: `POST /api/v1/customers/{c}/export`**
- **Por qué POST y no GET:** deja rastro en la actividad, y no debe repetirse por cachés, recargas ni reintentos automáticos. En la SPA es una mutación, no una consulta.
- Responde 200 `Resource<CustomerExport>`, con la cabecera `Cache-Control: no-store`. Sin paginar. Contiene:
  - `generated_at`;
  - `workspace` (`id`, `name`): el taller que guarda los datos;
  - `customer`, con todos sus campos;
  - `vehicles`: todos los que tienen `customer_id = c`, archivados incluidos, con la forma `Vehicle`;
  - `work_orders`: todas las que tienen `customer_id = c`, en cualquier estado, con sus `items` y ordenadas por `received_at` descendente.
- No incluye las intervenciones, los gastos ni los documentos de los vehículos: son datos técnicos del coche, no datos de contacto del cliente (ADR‑0005).
- La SPA guarda `data` como archivo `cliente-{id}-{AAAA-MM-DD}.json` (Blob y descarga), sin una segunda petición.
- También funciona con un cliente anonimizado: exporta lo que queda.
- Registra la actividad `customer.exported`, **sin el nombre** en la frase: "Ana exportó los datos de un cliente".

**Anonimizar: `POST /api/v1/customers/{c}/anonymize`** (sin cuerpo)
- Hace todo en una transacción:
  - `name = "Cliente anonimizado"`;
  - `email`, `phone`, `tax_id` y `notes` pasan a null;
  - `anonymized_at` = ahora.

  Los valores antiguos se sobrescriben y no se copian a ninguna otra tabla.
- Además, en la misma transacción:
  - reescribe sin el nombre las frases de actividad de ese cliente (`entity_type = customer`, `entity_id = c`; hoy solo `customer.created`), p. ej. "Ana dio de alta a un cliente (anonimizado)";
  - registra `customer.anonymized`: "Ana anonimizó los datos de un cliente".
- Responde 200 `Resource<Customer>`, ya anonimizado.
- **Se conserva:**
  - el cliente, con el mismo `id`;
  - su relación con sus vehículos y sus órdenes;
  - todo el historial técnico: vehículos (con matrícula y VIN), lecturas de km, intervenciones, órdenes con líneas e importes, y documentos.

  Las órdenes y los vehículos muestran `customer: { name: "Cliente anonimizado", phone: null }`. La analítica sigue sumando sus órdenes; en `by_customer` aparece con ese nombre.
- **Es irreversible**: no hay ningún endpoint para deshacerlo. Antes de llamar a la API, la SPA pide una confirmación explícita en un diálogo de peligro, que dice:
  - qué se borra y qué se conserva;
  - que no se puede deshacer;
  - que conviene exportar antes.
- **Errores:**
  - 409 "Este cliente ya está anonimizado." si `anonymized_at` no es null;
  - 409 "No se puede anonimizar un cliente con órdenes de trabajo abiertas. Entrégalas o cancélalas antes." Es la misma regla que para eliminar.
- **Un cliente ya anonimizado:**
  - `PATCH` ⇒ 409;
  - no se puede asignar a ningún vehículo: `customer_id` ⇒ 422 (§3.3);
  - `DELETE` sigue permitido, con permiso manage;
  - se pueden abrir órdenes nuevas para sus vehículos, y el cliente de esas órdenes será el anonimizado;
  - se sigue mostrando en `GET /customers` y en las búsquedas, con su nombre nuevo;
  - la SPA lo marca con "Anonimizado" (`anonymized_at`) y oculta "Editar" y "Anonimizar".
- **Lo que no cubre** (la SPA lo advierte en la confirmación):
  - los textos libres que el taller haya escrito en órdenes o vehículos (título, síntoma, diagnóstico, apodo);
  - los archivos adjuntos, como una factura en PDF con su nombre.

  Esos datos se revisan y se editan o se borran a mano.

**Eliminar (`DELETE /customers/{c}`, cambio):** además de lo que ya hacía, reescribe sin el nombre las frases de actividad del cliente, igual que al anonimizar. Así, borrar a un cliente no deja su nombre en el registro de actividad.

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

Cada acción de escritura relevante registra un `Activity` (sin secretos ni datos personales sensibles en `metadata`): `vehicle.created|updated|archived|restored|deleted`, `mileage.recorded`, `maintenance.created|updated|archived`, `expense.created|updated|deleted`, `reminder.created|completed|dismissed`, `document.uploaded|deleted`, `customer.created|exported|anonymized`, `work_order.created|updated|status_changed`, `member.added|removed|role_changed` y, desde E16, `repair_request.created|cancelled|accepted|rejected`, `repair_quote.sent|accepted|rejected` y `directory_profile.updated` (§3.13.9). `summary` en español listo para mostrar.

**Autor en la frase, según el tipo de espacio** (hallazgo M5 del informe de UX del 23/10):
- **`workshop`:** la frase empieza por el nombre de quien hizo la acción, p. ej. "Ana movió OT‑2026‑0003 a «Listo»".
- **`personal`:** la frase **no lleva el nombre** del usuario. En un espacio de una sola persona, "Lucía Demo registró…" sobra. Se usa la segunda persona y siempre la misma forma: "Anotaste 54.000 km en Kia Sportage", "Registraste la intervención «Cambio de aceite» en Kia Sportage", "Añadiste un gasto de 45,00 € (Combustible) en Kia Sportage".
- `Activity.user` sigue llegando igual en los dos tipos (la forma no cambia). La SPA no lo muestra en los espacios personales.
- Las frases ya guardadas no se reescriben: la demo se regenera con `migrate:fresh --seed`.

Datos del cliente en la actividad (§3.10.1):
- Las frases nunca llevan el email, el teléfono, el NIF ni las notas del cliente.
- El nombre solo aparece en `customer.created`, y se reescribe sin él al anonimizar o eliminar al cliente.
- `customer.exported` y `customer.anonymized` no lo llevan nunca.

### 3.13 Directorio de talleres, solicitudes de reparación y notificaciones

E16 · [ADR‑0007](../arquitectura/ADR-0007-solicitudes-a-talleres.md). Es la **única vía entre un espacio personal y un taller**. Todo lo demás sigue aislado: §2 y ADR‑0002.

#### 3.13.1 Endpoints

| Método | Ruta | Quién | Cuerpo → respuesta |
|--------|------|-------|--------------------|
| GET | `/api/v1/workshops` | autenticado | `Paginated<DirectoryWorkshop>`, solo `listed = true`, por nombre ascendente. `?search=` (nombre o ciudad, contiene, sin distinguir mayúsculas), `?service=` (un `WorkshopService`) |
| GET | `/api/v1/workshops/{id}` | autenticado | `Resource<DirectoryWorkshop>` · 404 si no existe, no es un taller o no está en el directorio |
| GET | `/api/v1/workspaces/{ws}/directory-profile` | view (solo `workshop`; en `personal`, 404) | `Resource<DirectoryProfile>`. Si nunca se guardó: `listed = false`, `services = []`, el resto null |
| PUT | `/api/v1/workspaces/{ws}/directory-profile` | **own** (manager y mechanic ⇒ 403) | `DirectoryProfileInput` → `Resource<DirectoryProfile>` |
| GET | `/api/v1/workspaces/{ws}/repair-requests` | `personal`: owner (las **enviadas**) · `workshop`: view (las **recibidas**) | `Paginated<RepairRequest>`, `created_at` descendente. `?status=` (lista separada por comas, u `open` = `pending,accepted,quoted`), `?work_order_id=` (solo `workshop`: la solicitud de la que viene una orden) |
| POST | `/api/v1/workspaces/{ws}/repair-requests` | owner del espacio `personal` (en `workshop`, 404) | `RepairRequestInput` → 201 `Resource<RepairRequest>` con `status = pending` |
| GET | `/api/v1/repair-requests/{r}` | las dos partes | `Resource<RepairRequest>` |
| PATCH | `/api/v1/repair-requests/{r}` | solicitante | `RepairRequestUpdateInput` → `Resource<RepairRequest>` · 409 si está cerrada |
| POST | `/api/v1/repair-requests/{r}/cancel` | solicitante | sin cuerpo → `Resource<RepairRequest>` |
| POST | `/api/v1/repair-requests/{r}/accept` | **manage** del taller | `AcceptRepairRequestInput` → `Resource<RepairRequest>` |
| POST | `/api/v1/repair-requests/{r}/reject` | **manage** del taller | `RejectRepairRequestInput` → `Resource<RepairRequest>` |
| POST | `/api/v1/repair-requests/{r}/quotes` | **manage** del taller | `RepairQuoteInput` → 201 `Resource<RepairRequest>` (con la versión nueva la primera en `quotes`) |
| POST | `/api/v1/repair-requests/{r}/quote/accept` | solicitante | `QuoteDecisionInput` → `Resource<RepairRequest>` con `status = converted` y `work_order` |
| POST | `/api/v1/repair-requests/{r}/quote/reject` | solicitante | `QuoteDecisionInput` → `Resource<RepairRequest>` con `status = accepted` |
| GET | `/api/v1/repair-requests/{r}/history` | las dos partes | `{ data: SharedHistoryEntry[] }` · 403 si `history_available = false` |
| GET | `/api/v1/notifications` | autenticado (las suyas) | `Paginated<AppNotification>`, `created_at` descendente, `per_page` 20 por defecto y 50 como máximo. `?unread=1` |
| GET | `/api/v1/notifications/count` | autenticado | `Resource<NotificationCount>` |
| POST | `/api/v1/notifications/read` | autenticado | `MarkNotificationsReadInput` → 204. Sin `ids`, todas. Los ids que no son suyos se ignoran |

**Las dos partes de una solicitud**, que resuelve `RepairRequestPolicy` en el servidor:
- **solicitante:** el owner del espacio personal que la envió (`requester_workspace_id`);
- **taller:** cualquier miembro del espacio destinatario (`workshop_workspace_id`): owner, manager o mechanic.

`perspective` vale `requester` si el usuario es el solicitante; si no, `workshop`.

**Códigos:**
- **404:** cualquier usuario que no sea una de las dos partes, en todas las rutas `/repair-requests/{r}…`.
- **403:**
  - una parte pide una acción de la otra, por ejemplo el taller pide `cancel` o el particular pide `accept`;
  - el mecánico intenta decidir: `accept`, `reject` o `quotes`.

#### 3.13.2 Directorio

- `DirectoryProfileInput`:
  - `listed` es obligatorio;
  - `city` es obligatoria si `listed = true` (2–80);
  - `address` ≤ 160;
  - `phone` ≤ 30 y `^[0-9 +()-]{6,30}$`;
  - `services`: sin repetir y solo valores de `WorkshopService`;
  - `opening_hours` ≤ 200.

  Si `listed = true` llega sin ciudad: 422 `errors.city`.
- El nombre público es `Workspace.name`, que se edita con `PATCH /workspaces/{ws}`. No se guarda dos veces.
- Desactivar `listed` saca al taller del directorio y bloquea las solicitudes **nuevas**. Las abiertas siguen su curso.
- El directorio solo lista talleres de CarCare. No hay datos externos ni inventados.
- Actividad del taller: `directory_profile.updated` ("Ana actualizó el perfil del directorio").

#### 3.13.3 Crear una solicitud

Validación de `RepairRequestInput` (422 con el campo):
- `vehicle_id`:
  - un vehículo del **mismo espacio personal**;
  - no archivado ("Este vehículo está archivado.").
- `workshop_id`:
  - un taller con `listed = true` ("Este taller no está en el directorio.");
  - del que el usuario **no es miembro** ("No puedes enviar una solicitud a un taller del que formas parte.").
- `title` 3–120 y `description` 10–2000.
- `zone` es un `Zone` o null.
- `preferred_date`: desde hoy hasta hoy + 180 días.
- `mileage`:
  - entero entre 0 y 2.000.000;
  - **≥ `current_mileage` del vehículo** ("No puede ser menor que el último kilometraje anotado (84.200 km)."). No admite `confirm_mileage_drop`: si la última lectura está mal, se corrige en el diario.
- `contact_phone`: el mismo formato que el teléfono del directorio.
- `share_history`: booleano, `false` por defecto.

Reglas:
- **Copia fija del coche.** Al crear se copian `make`, `model`, `year`, `fuel_type`, `body_type`, `color_hex` y `plate` del vehículo a la solicitud. Es lo único que el taller ve del coche (`RepairRequestVehicle`). Editar el vehículo después no cambia la copia.
- **Los km no crean una lectura** en el garaje: son un dato declarado para el taller. Si la solicitud se convierte en orden, pasan a ser `mileage_in` de la orden, y esa lectura se registra en el vehículo del taller (§3.4.1).
- **Límites anti‑spam:**
  - **429** "Has enviado 5 solicitudes en las últimas 24 horas. Vuelve a intentarlo mañana." si el usuario ya ha creado 5 en las últimas 24 horas (se cuenta en la base de datos);
  - **409** "Ya tienes una solicitud abierta para este vehículo en este taller." si ya hay una `pending`, `accepted` o `quoted` para la misma pareja vehículo‑taller.

  Pedir presupuesto a **varios talleres** a la vez para el mismo coche está permitido.
- Avisa al owner y a los managers del taller: `repair_request.received`.

#### 3.13.4 Estados y transiciones

| Acción | Quién | Desde | Hacia | Además |
|--------|-------|-------|-------|--------|
| Aceptar sin presupuesto | manage del taller | `pending` | `accepted` | `responded_at`. Avisa: `repair_request.accepted` |
| Aceptar con presupuesto | manage del taller | `pending` | `quoted` | Crea la versión 1. `responded_at`. Avisa: `repair_quote.sent` ("…aceptó tu solicitud y te envió un presupuesto…") |
| Enviar presupuesto | manage del taller | `accepted`, `quoted` | `quoted` | Versión n+1. Si había una `sent`, pasa a `superseded`. Avisa: `repair_quote.sent` |
| Rechazar | manage del taller | `pending`, `accepted`, `quoted` | `rejected` | `reason` obligatorio (5–500) en `reject_reason`. Una versión `sent` pasa a `superseded`. `closed_at`. Avisa: `repair_request.rejected` |
| Aceptar el presupuesto | solicitante | `quoted` | `converted` | Conversión (§3.13.6). `closed_at`. Avisa: `repair_quote.accepted` |
| Rechazar el presupuesto | solicitante | `quoted` | `accepted` | La versión pasa a `rejected`, con `client_reason` si llega (≤ 500). Avisa: `repair_quote.rejected` |
| Cancelar | solicitante | `pending`, `accepted`, `quoted` | `cancelled` | Una versión `sent` pasa a `superseded`. `closed_at`. Avisa: `repair_request.cancelled` |
| Compartir o retirar el historial | solicitante | `pending`, `accepted`, `quoted` | (igual) | `PATCH share_history` |
| Borrar el vehículo (§3.3) | solicitante | `pending`, `accepted`, `quoted` | `cancelled` | Automático, en la transacción del borrado. Avisa: `repair_request.cancelled` |

Errores:
- **409 cuando el estado de partida no está en la tabla.** Mensajes:
  - solicitud cerrada: "Esta solicitud ya está cerrada."
  - cancelar una convertida: "Esta solicitud ya es la orden OT‑2026‑0031. Para cancelarla, llama al taller."
  - aceptar dos veces: "Esta solicitud ya tiene respuesta."
- **409 al decidir sobre un presupuesto:**
  - `quote_id` no es la versión `sent` de esa solicitud: "El taller ha enviado un presupuesto nuevo. Revísalo antes de responder.";
  - la versión está caducada: "El presupuesto caducó el 10/11/2026. Pide al taller uno nuevo." Rechazar una versión caducada sí está permitido.
- **422:** `quote_id` falta o no es un entero; `reason` falta al rechazar; cualquier error de `RepairQuoteInput`, con las claves `quote.items.0.unit_price`… en `accept` y `items.0.unit_price`… en `quotes`.
- **Concurrencia:** cada transición bloquea la fila de la solicitud (`lockForUpdate`) dentro de una transacción. Dos clics a la vez dan una transición y un 409.

**Textos de estado en la SPA:**

| Estado | Lo ve el particular | Lo ve el taller |
|--------|---------------------|-----------------|
| `pending` | "Enviada" | "Nueva" |
| `accepted` | "Aceptada · presupuesto pendiente" | "Aceptada · falta el presupuesto" |
| `quoted` | "Presupuesto recibido" | "Presupuesto enviado" |
| `rejected` | "Rechazada" | "Rechazada" |
| `cancelled` | "Cancelada" | "Cancelada por el cliente" |
| `converted` | "En el taller · OT‑…" | "Orden OT‑…" |

#### 3.13.5 Presupuesto

- `RepairQuoteInput`:
  - `items`: 1–50 líneas. Cada una con `kind`, `name` (1–120), `part_number` (≤ 60), `quantity` > 0 con 2 decimales y **`unit_price` obligatorio** (≥ 0 y ≤ 999.999,99, string con 2 decimales);
  - `tax_rate` entre 0 y 100, por defecto `settings.tax_rate` del taller;
  - `valid_days` entre 1 y 90, por defecto 15;
  - `note` ≤ 1000.
- Totales con las mismas reglas que las órdenes (§3.11): `total` de línea = `quantity × unit_price`, `subtotal = Σ`, `tax_amount` con redondeo *half‑up* a 2 decimales y `total = subtotal + tax_amount`. Todo en DECIMAL y como string en el JSON.
- **Versiones inmutables.** No hay `PATCH` de un presupuesto: para cambiarlo, se envía otro. Las líneas se guardan en una columna JSON de `repair_quotes`. En la respuesta, cada línea lleva `total` y no lleva `id`.
- `valid_until` = fecha de `sent_at` (zona horaria de la app) + `valid_days`. `is_expired` = `status = sent` y hoy > `valid_until`. Se calcula al leer, sin tareas programadas.
- **Rótulo obligatorio en la SPA:** "Presupuesto (no es una factura)" (D12 = A). Ningún texto de E16 dice "factura".

#### 3.13.6 Conversión en orden

Al aceptar el cliente la versión vigente, todo en **una transacción**:

1. **Cliente del taller.**
   - Se reutiliza el `customer_id` de la última solicitud convertida de ese usuario en ese taller, si el cliente existe y no está anonimizado.
   - Si no, se crea un cliente con:
     - `name` = nombre del solicitante;
     - `email` = su email;
     - `phone` = `contact_phone`;
     - `tax_id` y `notes` a null.

   **Nunca se enlaza por email** con un cliente dado de alta a mano (ADR‑0007).
2. **Vehículo del taller.** Por orden de preferencia:
   - (a) el vehículo no archivado del taller con `source_vehicle_id` = el vehículo del particular;
   - (b) el vehículo no archivado del taller con la misma matrícula normalizada; se le pone `source_vehicle_id` si no lo tenía y no se le cambia el cliente;
   - (c) uno nuevo con la copia fija, `customer_id` = el cliente del punto 1, `source_vehicle_id` = el vehículo del particular y `current_mileage` null.

   `source_vehicle_id` es una columna interna y no sale en el JSON.
3. **Orden** con las reglas de §3.11:
   - `title` = `title` de la solicitud;
   - `complaint` = `description`;
   - `diagnosis` = null;
   - `priority = normal`;
   - `mileage_in` = `mileage`, que crea la lectura `work_order` en el vehículo del taller;
   - `tax_rate` e `items`, copiados del presupuesto;
   - `customer` = el cliente del punto 1;
   - `status = received`.
4. La versión pasa a `accepted`. La solicitud pasa a `converted` y guarda `customer_id` y `work_order_id`, que son columnas internas.

**El particular ve la orden** solo dentro de su solicitud (`RepairRequest.work_order`: número, estado y fechas). `GET /work-orders/{o}` le sigue dando 404.
- Si el taller borra la orden (solo es posible en `received` o `cancelled`), `work_order` pasa a null y la solicitud sigue `converted`. La SPA dice "El taller ha eliminado la orden".
- Cuando la orden pasa a `ready`, se avisa al particular: `repair_request.order_ready`. Ningún otro cambio de estado de la orden avisa.

#### 3.13.7 Qué ve el taller y historial compartido

- **El taller ve:**
  - la copia fija del coche;
  - los km declarados;
  - asunto, descripción, zona y fecha preferida;
  - nombre y email del solicitante, y `contact_phone`;
  - el historial, si se comparte.

  No ve nunca el apodo, el VIN, los gastos, los documentos ni los recordatorios, y `vehicle_id` le llega a null.
- **Historial** (`GET /repair-requests/{r}/history`):
  - las intervenciones **no archivadas** del vehículo del particular, por `service_date` descendente y como máximo 50;
  - solo los campos de `SharedHistoryEntry`: **sin importes, descripciones, líneas ni documentos**.
- `history_available` = `share_history` **y** estado `pending`, `accepted` o `quoted` **y** el vehículo sigue existiendo. Si es false: 403 "El cliente no comparte su historial con el taller."
- Lo pueden pedir las dos partes. El particular lo usa para ver exactamente lo que ve el taller.
- **Texto del consentimiento en el formulario.** Va junto a la casilla y se envía tal cual:

  > "Taller X verá tu nombre, tu email, el teléfono que indiques, estos datos del coche (marca, modelo, año, combustible, carrocería, color y matrícula) y los km. Si aceptas su presupuesto, te dará de alta como cliente suyo.
  > ☐ Compartir también el historial de intervenciones (fecha, tipo, zona, título, km y taller; nunca importes ni notas) mientras la solicitud esté abierta. Puedes retirarlo cuando quieras."

#### 3.13.8 Notificaciones en la app

- **Almacenamiento.** Tabla `notifications` estándar de Laravel (canal `database`), con `data = { kind, summary, workspace_id, repair_request_id }`. Sin correo.
- **Destinatarios:**
  - de los eventos del taller, la persona que envió la solicitud;
  - de los eventos del particular, **el owner y los managers** del taller en ese momento.

  Nunca quien hizo la acción. El mecánico no las recibe.
- **Frases** (`summary`). Nunca llevan el nombre, el email ni el teléfono del particular:

  | `kind` | Frase |
  |--------|-------|
  | `repair_request.received` | "Nueva solicitud para Seat Ibiza (1234ABC): «Ruido al frenar»" |
  | `repair_request.cancelled` | "El cliente canceló la solicitud de Seat Ibiza (1234ABC)" |
  | `repair_request.accepted` | "Taller Demo aceptó tu solicitud para Seat Ibiza. El presupuesto llegará después" |
  | `repair_request.rejected` | "Taller Demo rechazó tu solicitud para Seat Ibiza" |
  | `repair_quote.sent` | "Taller Demo te envió un presupuesto para Seat Ibiza". Si es al aceptar: "Taller Demo aceptó tu solicitud y te envió un presupuesto para Seat Ibiza" |
  | `repair_quote.accepted` | "El cliente aceptó el presupuesto de Seat Ibiza (1234ABC): se abrió OT‑2026‑0031" |
  | `repair_quote.rejected` | "El cliente rechazó el presupuesto v1 de Seat Ibiza (1234ABC)" |
  | `repair_request.order_ready` | "Tu Seat Ibiza está listo en Taller Demo (OT‑2026‑0031)" |

  Si el vehículo no tiene matrícula, se omite el paréntesis.
- `workspace_id` es el espacio del destinatario desde el que se abre la solicitud: el personal para el particular y el taller para su equipo. La SPA navega a `/app/{workspace_id}/solicitudes/{repair_request_id}` y la marca como leída.
- **En la interfaz:**
  - campana con contador en la cabecera de los dos modos;
  - `GET /notifications/count` cada 60 s, **solo con la pestaña visible**: con TanStack Query, `refetchInterval: 60_000` y sin `refetchIntervalInBackground`;
  - al volver a la pestaña, se refresca.
- Al borrar la cuenta, se borran sus notificaciones: la tabla polimórfica no tiene clave foránea. Si la solicitud de una notificación ya no existe, abrirla da 404 y la SPA dice "Esta solicitud ya no existe".

#### 3.13.9 Actividad

Además de las notificaciones, se registran estas actividades (§3.12):

| Espacio | `action` | Frase | Autor |
|---------|----------|-------|-------|
| personal | `repair_request.created` | "Enviaste una solicitud a Taller Demo para Kia Sportage" | — |
| personal | `repair_request.cancelled` | "Cancelaste la solicitud a Taller Demo para Kia Sportage" | — |
| personal | `repair_quote.accepted` | "Aceptaste el presupuesto de Taller Demo para Kia Sportage" | — |
| personal | `repair_quote.rejected` | "Rechazaste el presupuesto de Taller Demo para Kia Sportage" | — |
| workshop | `repair_request.accepted` / `repair_request.rejected` | "Ana aceptó la solicitud de Seat Ibiza (1234ABC)" | quien decide |
| workshop | `repair_quote.sent` | "Ana envió el presupuesto v2 de Seat Ibiza (1234ABC)" | quien lo envía |
| workshop | `repair_quote.accepted` / `repair_quote.rejected` | "El cliente aceptó el presupuesto v1 de Seat Ibiza (1234ABC)" | `user = null` |
| workshop | `customer.created`, en la conversión | "Se dio de alta al cliente Lucía Demo desde una solicitud" (se reescribe al anonimizar, §3.10.1) | `user = null` |
| workshop | `work_order.created`, en la conversión | "Se abrió OT‑2026‑0031 desde una solicitud" | `user = null` |
| workshop | `directory_profile.updated` | "Ana actualizó el perfil del directorio" | quien lo guarda |

En los espacios personales, `vehicle_id` es el vehículo del particular. En el taller es null, salvo en `work_order.created`. Las acciones del particular **no** se registran con su nombre en la actividad del taller: llevan `user = null` y la frase dice "El cliente".

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
- **Directorio y solicitudes (E16, §3.13).**
  - **Talleres en el directorio.** Hay 4: "Taller Demo", con ciudad Lleida y todos los servicios menos `bodywork`, y otros 3 talleres ficticios con su propio owner (`taller2@`, `taller3@` y `taller4@carcare.test`, con contraseña `password`): "Talleres Ejemplo Norte" (Lleida), "Neumáticos Prueba" (Tarragona) y "Carrocerías Ficticia" (Barcelona).
  - **Datos de esos talleres.** Las direcciones son claramente inventadas ("C/ Inventada, 12"). El teléfono es null, salvo el de Taller Demo, que es "973 000 000".
  - **Solicitudes de `demo@`.** Tiene 4, con un vehículo distinto para cada pareja abierta:
    - una `pending` a Taller Demo, para enseñar aceptar y rechazar;
    - una `quoted` a Taller Demo, con la v1 vigente, para enseñar la aceptación y la conversión;
    - una `converted` antigua, con su orden ya entregada en Taller Demo;
    - una `rejected` por "Carrocerías Ficticia", con motivo.
  - **Notificaciones.** Hay notificaciones sin leer para `taller@` y `gerente@` (la solicitud nueva) y para `demo@` (el presupuesto recibido).
  - El seeder se puede volver a ejecutar sin duplicar nada.

## 6. Historial de cambios

| Fecha | Cambio | Aprobado por |
|-------|--------|--------------|
| 2026-10-21 | Versión inicial: espacios personal/taller, zonas 3D, diario, órdenes de trabajo | Arquitecto (sesión de arranque) |
| 2026-10-24 | **Tarea 27 (E7‑1), origen de cada lectura** (§3.4.1). Nuevo `MileageLog.source_id`: id del registro de origen, siempre del mismo vehículo. Es null en las manuales y, para el rol mechanic, en las lecturas de gastos. Borrar un recordatorio borra su lectura (§3.7). Migración de datos para las lecturas huérfanas. Aditivo | Arquitecto |
| 2026-10-24 | **Tarea 28 (E1‑6), recuperar la contraseña** (§3.1.1). Nuevos `POST /auth/forgot-password` y `POST /auth/reset-password`, y tipos `ForgotPasswordInput` y `ResetPasswordInput`. Detalles: 204 exista o no la cuenta; token hasheado, de un solo uso y que caduca a los 60 min; 429 a partir de la 6.ª petición en un minuto por IP; cierra todas las sesiones y no inicia sesión; CSRF como en el login; correo solo en el log. Rutas de la SPA: `/recuperar` y `/restablecer`. [ADR‑0006](../arquitectura/ADR-0006-recuperar-contrasena.md). Aditivo | Arquitecto (D17 = A, decidida por Alberto el 24/10) |
| 2026-10-24 | **Tarea 29 (E11‑6), derechos RGPD del cliente** (§3.10.1). Nuevos `Customer.anonymized_at`, tipo `CustomerExport` y `POST /customers/{c}/export` y `/anonymize` (manage). Cambios de reglas: PATCH de un cliente anonimizado ⇒ 409; asignar a un vehículo un cliente anonimizado ⇒ 422; anonimizar o eliminar reescribe la actividad sin el nombre. Nuevas actividades `customer.exported` y `customer.anonymized`. [ADR‑0005](../arquitectura/ADR-0005-rgpd-cliente-taller.md). Aditivo | Arquitecto |
| 2026-10-24 | **Autor de la actividad en los espacios personales** (§3.12, hallazgo M5 de UX). En `personal`, `Activity.summary` no lleva el nombre del usuario y usa la segunda persona ("Anotaste 54.000 km en Kia Sportage"). En `workshop` sigue con el nombre. La forma JSON no cambia | Arquitecto (a petición de disenador-ux) |
| 2026-10-24 | **Textos según D12 = A**: el contrato y los comentarios de `types.ts` ya no dicen "facturación"; ahora dicen "importe de las órdenes entregadas" e "importes y analítica". Solo cambia el texto | Arquitecto (petición 12 de frontend-react) |
| 2026-10-26 | **Tarea 32 (E16), solicitudes de reparación a talleres** (§3.13, [ADR‑0007](../arquitectura/ADR-0007-solicitudes-a-talleres.md)).<br>• **Rutas nuevas:** 18. Directorio (`/workshops`), perfil del directorio (`/workspaces/{ws}/directory-profile`, solo el owner lo edita), solicitudes (`/workspaces/{ws}/repair-requests` y `/repair-requests/{r}/…`) y notificaciones (`/notifications`, `/count` y `/read`).<br>• **Tipos nuevos:** `WorkshopService`, `DirectoryProfile(Input)`, `DirectoryWorkshop(Ref)`, `RepairRequest*`, `RepairQuote*`, `QuoteLineItemInput`, `QuoteDecisionInput`, `SharedHistoryEntry`, `NotificationKind`, `AppNotification`, `NotificationCount` y `MarkNotificationsReadInput`.<br>• **Reglas nuevas:**<br>– estados y transiciones de la solicitud, con 409 y 422;<br>– presupuesto en versiones inmutables, "no es una factura";<br>– la orden se crea al aceptar el cliente el presupuesto;<br>– copia fija de 7 datos del coche;<br>– historial compartido solo con consentimiento, sin importes y mientras la solicitud esté abierta;<br>– límites anti‑spam: 5 al día (429) y 1 abierta por pareja vehículo‑taller (409);<br>– actividades y notificaciones sin el nombre del particular.<br>• **Cambios en reglas existentes:**<br>– §2: única excepción al aislamiento;<br>– §3.3: borrar un vehículo personal cancela sus solicitudes abiertas;<br>– §3.12: actividades nuevas;<br>– §5: demo del directorio.<br>• **Columna interna** `vehicles.source_vehicle_id`, que no sale en el JSON.<br>Ningún tipo existente cambia: aditivo | Arquitecto (alcance pedido por Alberto el 24/10) |

> **Efecto en los tests del backend (24/10).** `ContractShapeTest` compara las claves de cada interfaz de `types.ts` con `tests/Support/Contract.php`. Hasta que el paso 2 de las tareas 27 y 29 añada `source_id` a `mileageLog()` y `anonymized_at` a `customer()`, fallan los casos `MileageLog` y `Customer` del test "las especificaciones tienen las mismas claves que las interfaces de types.ts". Es el aviso previsto del *contract-first*, no una regresión de otra tarea.
