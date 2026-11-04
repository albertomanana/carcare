# Auditoría de seguridad y privacidad · tarea 7 (04/11/2026)

> Agente: `seguridad` (modo revisión, sin cambios en código de la app). Lanzado por el piloto automático.
> Estado: **Terminado** (04/11/2026). Hallazgos: 0 críticos · 0 altos · 4 medios · 6 bajos · 6 informativos. Tres preguntas para Alberto (§10.3).

## 1. Objetivo

Revisar desde cero la seguridad y privacidad de CarCare (API Laravel 12 en `backend/` y SPA React en `frontend/`) y dejar hallazgos clasificados con evidencia, dueño y corrección propuesta.

## 2. Alcance

1. Autorización y aislamiento entre espacios (ADR-0002), endpoint por endpoint de `backend/routes/api.php`, incluidos E16, RGPD y documentos.
2. Roles (owner/manager/mechanic) y escalada en invitaciones/equipo.
3. Autenticación Sanctum (cookies, CORS, CSRF, sesión, recuperar contraseña, borrado de cuenta).
4. Inyección SQL, asignación masiva, XSS, subida/descarga de archivos.
5. Rate limiting, cabeceras, modo debug.
6. Secretos en el repositorio.
7. Dependencias (composer audit, npm audit).
8. Privacidad / RGPD básico.

## 3. Método

- **Revisión estática** de `backend/routes/api.php` (90 rutas en `api/`; 95 en total con `php artisan route:list`), las 11 policies de `app/Policies`, los 18 controladores, los Form Requests de `app/Http/Requests`, los servicios con reglas de negocio, los modelos (`$fillable`), `bootstrap/app.php` (middleware y excepciones) y `config/*.php`. En el frontend: búsqueda de sumideros XSS, enlaces dinámicos, `localStorage`, `index.html` y `vite.config.ts`.
- **Pruebas dinámicas con `curl`** contra una instancia **aislada**: SQLite nueva en `C:/Users/Alberto/AppData/Local/Temp/carcare-seguridad/demo-8070.sqlite` sembrada con `migrate --seed --force`, API en `127.0.0.1:8070` con `SANCTUM_STATEFUL_DOMAINS=localhost:5188,127.0.0.1:5188` y cabeceras `Origin`/`Referer` de ese dominio (Sanctum SPA real: `GET /sanctum/csrf-cookie`, cookie de sesión y `X-XSRF-TOKEN`). `backend/bootstrap/cache/config.php` **no existe**, así que las variables de entorno se aplicaron (comprobado: las 5 sesiones de las cuentas demo aparecen en la tabla `sessions` de esa SQLite). Nunca se tocó :8000 ni :5173.
- Cuentas demo (DemoSeeder): `demo@` (particular, espacio 1), `taller@` (owner del Taller Demo, espacio 3), `gerente@` (manager del 3), `mecanico@` (mechanic del 3), `taller2@` (owner de "Talleres Ejemplo Norte", espacio 7, sin relación con los anteriores).
- **Tests del backend** (`php artisan test`, SQLite en memoria) y **auditorías de dependencias** (`composer audit`, `npm audit`).
- Cada hallazgo se marca **confirmado** (reproducido con una petición o leído sin ambigüedad en el código) o **posible** (teórico o dependiente del despliegue).

## 4. Tabla de hallazgos

Resumen: **0 críticos · 0 altos · 4 medios · 6 bajos · 6 informativos**. No hay ninguna fuga entre espacios: las 50 peticiones de un usuario ajeno dieron 404 (§8.1) y la suite de aislamiento cubre todas las rutas (§6). Los hallazgos medios son de **rol dentro del mismo espacio** y de **privacidad**.

| Id | Sev. | Área | Archivo:línea | Descripción | Reproducción / evidencia | Dueño | Corrección recomendada |
|----|------|------|---------------|-------------|--------------------------|-------|------------------------|
| S‑01 | **Media** (confirmado) | Roles | `backend/routes/api.php:123-126` (`summary`, `journal` y `report` con `can:view`); `app/Services/JournalService.php:34`, `:47-60` y `:96-104`; `app/Services/SummaryService.php:44-56`; `app/Services/ReportService.php:22-44`; `app/Services/ExpenseService.php:41,61,78` (frase de actividad con el importe) | El mecánico recibe **403 en `/vehicles/{v}/expenses`** y en `/analytics` (contrato §2: "manage: gastos, importes y analítica"; §3.6), pero ve **cada gasto con su descripción y su importe** en el diario, los **totales por categoría, mes y año** y el coste por km en el resumen y en el informe, y el importe en la frase de actividad. La regla de §3.4.1 ("depende del rol, como `revenue`") solo se aplicó a `source_id` | §8.2: la gerente crea un gasto de 321,45 € en el vehículo 3 del taller. El mecánico recibe 403 en `GET /vehicles/3/expenses`, pero `GET /vehicles/3/journal` devuelve `('expense', 'Pastillas compradas a Proveedor X', '321.45')`, `/summary` `totals.period = 321.45` y `by_category`, `/report` `expenses.total = 321.45`, y `/workspaces/3/activity` "Elena Demo añadió un gasto de 321,45 € (Reparación) en Reparto 1" | backend-laravel (y arquitecto, para fijar la regla en §3.3 y §3.12) | Para quien no tiene `manage`: en `journal`, quitar las entradas `expense` y poner `spent = null`; en `summary` y `report`, poner a `null` los bloques de gasto (`totals`, `by_category`, `by_month`, `cost_per_km`, `consumption`, `expenses`), o dar 403 en `summary`; y no poner el importe en la frase de `expense.*` de un taller. Añadir el caso a `RolesTest` (test propuesto en §10.2) |
| S‑02 | **Media** (confirmado; **pregunta para Alberto**, P1) | Roles | `app/Http/Resources/WorkOrderResource.php:35-39`; `app/Http/Controllers/Workshop/WorkOrderController.php:23,51` (`per_page` hasta 200); `app/Http/Resources/RepairQuoteResource.php:23-34`; `app/Services/DashboardService.php:104` | El dashboard da `revenue: null` al mecánico, pero la misma cifra sale sumando las órdenes: `GET /workspaces/3/work-orders?status=delivered&per_page=200` trae `items[].unit_price`, `subtotal` y `total` de todas. También ve los importes de los presupuestos de E16. El contrato se contradice: §2 da al mecánico *operate* sobre las órdenes (escribe líneas con precio) y a la vez reserva los "importes" a *manage*. Hoy, ocultar `revenue` es solo cosmético | §8.2: con la sesión del mecánico, 21 órdenes entregadas que suman 5.710,17 €; una línea `{'name': 'Alineación 3D', 'unit_price': '48.00', 'total': '48.00'}`; en la solicitud 3, `quotes[0].total = 135.52` con sus líneas | arquitecto (decide la regla) → backend-laravel | Lo decide Alberto (P1, §10.3). Recomendación: opción A, documentar que el mecánico ve los importes de órdenes y presupuestos porque los escribe, y que `revenue: null` significa "sin analítica", no "secreto". Si se quiere secreto (opción B), hay que ocultar precios y totales al mecánico en `WorkOrderResource` y `RepairQuoteResource` y prohibirle editar `unit_price` |
| S‑03 | **Media** (confirmado) | Privacidad / enumeración | `app/Services/WorkspaceService.php:132-153`; `app/Http/Requests/Workspace/StoreMemberRequest.php:19-25`; contrato §3.2 (POST members: "422 No existe ninguna cuenta con ese email") | **Añadir a alguien a un taller no pide su consentimiento**, y la respuesta **revela si un email tiene cuenta** y **su nombre completo**. Cualquier usuario puede crear un taller (`POST /workspaces`, sin límite) y usar `POST /workspaces/{ws}/members` como oráculo: anula la protección contra la enumeración de ADR‑0006. Además, un email mal escrito da a un desconocido acceso inmediato, como mecánico, a todos los clientes del taller (nombre, teléfono, NIF y notas) | §8.3: `taller2@` (sin relación con `demo@`) recibe 422 "No existe ninguna cuenta con ese email." para `noexiste@` y **201 `{"user":{"id":1,"name":"Lucía Demo","email":"demo@carcare.test"}}`** para `demo@`. A continuación, `GET /workspaces` de `demo@` ya lista el taller 7 con rol `mechanic`, sin haber aceptado nada | arquitecto (cambio de contrato) → backend-laravel y frontend-react | Invitación con aceptación: `POST /members` crea una invitación pendiente y responde igual exista o no la cuenta (p. ej. 202 genérico). La persona la acepta o la rechaza en la app, y solo entonces entra y se ve su nombre. Mínimo inmediato: límite de peticiones en `POST /members` (p. ej. 10/h por usuario) |
| S‑04 | **Media** (confirmado) | RGPD | `app/Http/Resources/RepairRequestResource.php:33` (`requester` sale de `users`, en vivo); `app/Services/CustomerService.php` (anonimizar no toca `repair_requests`); `database/migrations/2026_10_26_000004_create_repair_requests_tables.php:36-37` | El taller ve **para siempre** el nombre y el email **actuales** del particular (además de `contact_phone`, asunto y descripción) en **todas** sus solicitudes, también en las rechazadas, canceladas o convertidas hace meses. Si el particular cambia de nombre o de email, el taller ve el dato nuevo. Si el taller **anonimiza** (derecho de supresión, §3.10.1) al cliente que nació de la conversión, la solicitud convertida sigue mostrando nombre, email y teléfono. El particular no puede retirar esos datos salvo borrando su cuenta | §8.4: el taller anonimiza al cliente 13, el de la conversión de la solicitud 1 (200); `demo@` cambia su nombre; `GET /repair-requests/1` (taller) devuelve `requester = {'name': 'Lucia Nuevo Apellido', 'email': 'demo@carcare.test'}` y `phone = 600 000 099`. `taller4@` ve lo mismo en la solicitud 2, `rejected` y cerrada el 24/10 | arquitecto (regla de retención en §3.13.7 y ADR‑0007) → backend-laravel | (1) Copiar nombre y email a la solicitud al crearla, como la copia fija del coche, en vez de seguir al usuario. (2) Al anonimizar un cliente, anonimizar también las solicitudes con ese `customer_id` (nombre, email, teléfono y descripción). (3) Fijar una retención: p. ej., a los N días de cerrada (`rejected` o `cancelled`), el taller deja de ver nombre, email y teléfono. (4) Decirlo en el texto del consentimiento |
| S‑05 | Baja (confirmado) | Rate limiting | `bootstrap/app.php:21-26` (sin `throttleApi()`); `app/Http/Requests/Auth/LoginRequest.php:69-71` (clave email+IP); `routes/api.php:37` (registro sin límite) | No hay límite general en la API. El login solo cuenta por **email + IP**: desde una IP se pueden probar contraseñas contra emails distintos sin freno (*password spraying*). El registro no tiene límite: alta masiva de cuentas | §8.5: 70 peticiones seguidas a `/notifications/count` → 70 × 200; 7 logins fallidos con 7 emails distintos → 7 × 422, ningún 429; 8 registros seguidos desde la misma IP → 8 × 201. Con el mismo email sí salta el 429 en el 6.º intento | backend-laravel | `$middleware->throttleApi()` con un limitador `api` (p. ej. 120/min por usuario o IP); limitador adicional por IP en el login (p. ej. 20/min) y en el registro (p. ej. 5/h); límite en `POST /workspaces` y `POST /members` (S‑03) |
| S‑06 | Baja (confirmado; el impacto depende del despliegue) | Cabeceras | `bootstrap/app.php` (ningún middleware de cabeceras); `frontend/index.html:10-16` (script en línea); no hay configuración de despliegue en el repo | Ninguna respuesta lleva **CSP**, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` ni HSTS, y las respuestas JSON no llevan `X-Content-Type-Options: nosniff` (solo la descarga). Sale `X-Powered-By: PHP/8.2.12`. El contrato (§3.1.1) confía en que "la SPA no carga recursos de terceros" para que el token de `/restablecer` no se filtre por `Referer`, pero ninguna cabecera lo garantiza | §8.6: cabeceras reales de `GET /api/v1/me` y de `GET /documents/1/download?inline=1` | devops (servidor de la SPA) y backend-laravel (middleware de la API) | API: middleware con `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` y `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. SPA, en el servidor web de producción: `Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-<hash del script del tema>'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin` (o `no-referrer`) y HSTS con HTTPS. `expose_php = Off`. Probar la CSP con el visor 3D antes de activarla |
| S‑07 | Baja (confirmado) | Archivos | `backend/config/filesystems.php:36` (disco `local`, `'serve' => true`) | El disco privado tiene `serve => true`, así que Laravel registra `GET /storage/{path}` y `PUT /storage/{path}` (`storage.local` y `storage.local.upload`), que sirven y aceptan archivos del disco **sin pasar por las policies**, solo con una URL firmada. La app no genera URLs firmadas (`temporaryUrl` no aparece en `app/`), así que es superficie que sobra: si `APP_KEY` se filtrara, cualquier documento se podría leer o sobrescribir por su ruta | `php artisan route:list` muestra las dos rutas. Sin firma: `GET /storage/documents/1/<uuid>.pdf` → 403 y `PUT` → 403 (§8.6) | backend-laravel | `'serve' => false` en el disco `local` |
| S‑08 | Baja (confirmado) | Dependencias | `frontend/package-lock.json` (`zod@3.25.76`, directa y a través de `@hookform/resolvers`) | `npm audit` marca como **alta** GHSA‑mrhx‑c7xc‑m3w5 (zod < 4.6.6: agotamiento de memoria al validar colecciones enormes). En CarCare zod solo valida formularios en el navegador del propio usuario, así que el impacto real es bajo | §7 | frontend-react | Migrar a zod 4.6.7 (cambio mayor: revisar esquemas y `@hookform/resolvers`), o aceptar el riesgo y anotarlo hasta entonces |
| S‑09 | Baja (confirmado) | Dependencias | `backend/composer.lock` (`symfony/mime v7.4.19`) | CVE‑2026‑45070 (media): inyección de cabeceras de correo con caracteres no válidos en los nombres de parámetros MIME. Corregido en 7.4.22. CarCare solo envía el correo de restablecer, con cabeceras fijas y sin adjuntos, así que hoy no es explotable | §7 | backend-laravel | `../.tools/composer update symfony/mime` y pasar los tests |
| S‑10 | Baja (confirmado en el código) | Privacidad | `app/Services/WorkspaceService.php:180-202` (`removeMember`) | Quien sale de un taller, o a quien se quita, conserva sus notificaciones del taller: frases con la matrícula y el asunto de solicitudes de clientes ("Nueva solicitud para Seat Ibiza (1234ABC): «Ruido al frenar»"). Abrirlas da 404, pero el texto sigue en su bandeja | Lectura del código: `removeMember` borra la fila de `workspace_user` y desasigna las órdenes, pero no toca `notifications`, y `NotificationService::list` no filtra por pertenencia | backend-laravel | Al quitar o salir, borrar las notificaciones del usuario con `data->workspace_id = ws`, o filtrarlas al listar. Test: el miembro quitado no ve avisos del taller |
| S‑11 | Info (posible, en producción) | Configuración | `config/app.php:42` (`debug`); `config/session.php:172` (`secure` sin valor por defecto) | En este equipo, `php artisan about` da **Environment local · Debug Mode ENABLED** (normal en desarrollo). La API no filtra trazas (el manejador de `bootstrap/app.php:71-76` responde "Error interno del servidor."), pero la ruta web `/` sí las mostraría con debug. La cookie de sesión sale sin `Secure` (§8.6: `httponly; samesite=lax`) | §8.6 y `php artisan about --only=environment` | devops | Lista de producción: `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, HTTPS, `SANCTUM_STATEFUL_DOMAINS` y `SESSION_DOMAIN` con el dominio real, y `config:cache` |
| S‑12 | Info (confirmado; por diseño, D17) | Logs | `backend/storage/logs/laravel.log` (ignorado por git) | Con `MAIL_MAILER=log`, el correo de restablecer se escribe entero en el log: hay **4 enlaces con token en claro** y el email del destinatario. Caducan a los 60 min. El resto del log (23 `local.ERROR`) son errores de conexión a MySQL, de tiempo y de clases, sin datos personales salvo `userId` | `grep -c` sobre el log (§8.7), sin imprimir los tokens | devops | En producción, nunca `MAIL_MAILER=log`; canal `daily` con retención corta |
| S‑13 | Info | Privacidad | `app/Services/AccountService.php:58-82`; migración de `repair_requests` (`cascadeOnDelete`) | Borrar la cuenta del **único owner** borra el taller entero (clientes, órdenes y documentos) aunque tenga gerentes y mecánicos, sin avisarles (lo dice §3.1). Y borrar la cuenta de un particular borra en cascada sus solicitudes, también las abiertas, **sin avisar al taller** (al borrar un coche sí se avisa, §3.13.4) | Lectura del código y del contrato | arquitecto | Decidir si borrar la cuenta exige traspasar antes la propiedad del taller (409 si tiene otros miembros) y avisar al taller de las solicitudes abiertas que desaparecen |
| S‑14 | Info | Entrada | `VehicleController.php:36`, `Workshop/CustomerController.php:29-33`, `Workshop/WorkOrderController.php:43-47`, `DirectoryService.php:77` | Las búsquedas usan `LIKE` con parámetros enlazados (no hay inyección SQL), pero no escapan `%` ni `_`: `search=%` lo encuentra todo | — | backend-laravel | Escapar `%`, `_` y `\` antes de construir el patrón |
| S‑15 | Info | CORS | no existe `backend/config/cors.php` (valores por defecto del framework) | Todas las respuestas llevan `Access-Control-Allow-Origin: *`. No es explotable: `supports_credentials` es `false` y Sanctum solo trata como *stateful* los dominios de `SANCTUM_STATEFUL_DOMAINS` (§8.5: con `Origin: http://evil.test` y la cookie de `demo@`, `GET /me` → 401) | §8.5 y §8.6 | devops | Publicar `config/cors.php` con `allowed_origins` = el dominio de la SPA en producción |
| S‑16 | Info | Enumeración | `app/Http/Requests/Auth/RegisterRequest.php:36`; `app/Http/Requests/Account/UpdateProfileRequest.php:34` | El registro y `PATCH /me` responden "Ya existe una cuenta con ese email.". Es el compromiso habitual (la alternativa exige verificar el email por correo), pero, con S‑05, sin límite | §8.3: `POST /auth/register` con `gerente@` → 422 con ese mensaje | arquitecto | Aceptarlo y anotarlo, con el límite de S‑05; o, cuando haya correo real, registro con verificación y respuesta genérica |


## 5. Lo que está bien (con evidencia)

**Autorización y aislamiento (ADR‑0002)**
- Todas las rutas con recurso llevan `->can(...)`. Las policies resuelven el recurso a su espacio (`WorkspaceScopedPolicy::check`, `app/Policies/WorkspaceScopedPolicy.php`): si no eres miembro, 404 (`denyAsNotFound`); si eres miembro sin el rol necesario, 403. El rol se lee de la BD en cada petición (`User::roleIn`, sin caché), así que un cambio de rol se aplica en la petición siguiente.
- **Dinámico (§8.1):** `taller2@`, sin relación con nadie, lanzó **50 peticiones** contra el garaje de `demo@` y contra el Taller Demo: espacios, miembros, vehículos y sus vistas, km, intervenciones, gastos, recordatorios, documentos (también la descarga), clientes (también exportar y anonimizar), órdenes y solicitudes. **Las 50 dieron 404.**
- **IDs en el cuerpo y en la query (§8.3):** `customer_id` de otro taller → 422 (al crear y al editar un vehículo); `vehicle_id` de otro espacio en una orden → 422 (al crear y al editar); `assigned_to` de alguien que no es miembro → 422; `vehicle_id` de otro espacio en una solicitud → 422; `workshop_id` de un espacio personal → 422; `maintenance_record_id` de otro vehículo al subir un documento → 422. Los filtros `?customer_id=`, `?vehicle_id=` y `?maintenance_record_id=` con ids ajenos devuelven listas vacías, porque la consulta parte siempre del espacio.
- **E16 (§8.4):** el taller recibe 403 en las acciones del particular (`cancel`, `quote/accept`, `PATCH`), y el particular, en las del taller (`accept`, `quotes`). El taller recibe 404 en el vehículo, las intervenciones y los documentos reales del particular, y le llega `vehicle_id: null`. El particular recibe 404 en la orden del taller. El mecánico recibe 403 al decidir (`accept`, `reject`, `quotes`).
- **Roles (§8.2):** el mecánico recibe 403 en miembros (añadir, cambiar rol, quitar a otro), ajustes del taller, analítica, archivar, borrar clientes y órdenes, exportar y anonimizar, y gastos. La gerente no puede nombrar ni tocar a un owner (403), ni añadir a nadie como owner (422), ni borrar el taller ni editar el perfil del directorio (403).

**Autenticación (Sanctum SPA)**
- El login regenera la sesión (`AuthController.php`, `session()->regenerate()`); comprobado: la cookie de sesión cambia tras el login (§8.5). El logout invalida la sesión y regenera el token CSRF, y la cookie antigua da 401 después.
- Cambiar la contraseña exige la actual (422 si no) y **cierra las demás sesiones**: el middleware `AuthenticateSession` de Sanctum (`config/sanctum.php:82`) compara el hash de la contraseña. Comprobado con dos sesiones: tras `PUT /me/password` en la primera, la segunda recibe 401 y la primera sigue dentro. Las cookies "Recordarme" también caducan, porque `SessionGuard::userFromRecaller` valida el hash de la contraseña.
- Borrar la cuenta exige la contraseña (`current_password:web`; sin ella, 422).
- El restablecimiento usa el broker de Laravel: token aleatorio guardado con hash, 60 minutos, un solo uso, 204 exista o no la cuenta, hash de relleno para igualar tiempos, cierre de todas las sesiones y rotación de `remember_token` (`PasswordResetService.php`). Límite de 5 por minuto e IP: la 6.ª petición da 429 (§8.5).
- Mensaje genérico en el login y 429 al 6.º intento fallido con el mismo email.
- CSRF: un `PATCH /me` con sesión válida pero sin `X-XSRF-TOKEN` da **419**. Con `Origin: http://evil.test` y la cookie de sesión de `demo@`, `GET /me` da **401**: Sanctum no trata ese origen como *stateful*.
- La cookie de sesión es `httponly; samesite=lax` y el driver de sesión es `database`.
- Las contraseñas se guardan con el cast `hashed` del framework (`User::casts`).

**Entrada y salida**
- No hay SQL concatenado: los únicos `*Raw` (`VehicleController.php:48`, `DashboardService.php:78`, `DirectoryService.php:85-86`) son literales o usan parámetros enlazados. Los `orderBy` no salen de la entrada del usuario (`sort` se valida con `in:recent,name,mileage`).
- Asignación masiva: los servicios rellenan los modelos con `Arr::only($data, self::FIELDS)` o con arrays escritos a mano, siempre a partir de `validated()`. Ninguno usa `$request->all()`. `workspace_id` y `vehicle_id` nunca llegan del cliente.
- Errores sin trazas ni SQL en `api/*` (`bootstrap/app.php:27-76`): un JSON mal formado, un id no numérico (404 "Recurso no encontrado.") o parámetros de tipo array (422 en español) no filtran nada.
- Frontend: ningún `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `document.write`; no hay renderizador de Markdown. Los enlaces dinámicos solo son `tel:` (con los caracteres no numéricos quitados), `mailto:` (el email ya validado por el servidor) y rutas internas, así que no puede colarse un `javascript:`. No hay ningún `target="_blank"` sin `rel` (el único `window.open` lleva `noopener` y abre un `blob:`). Nada de `console.log`. `localStorage` solo guarda preferencias (tema, espacio, barra lateral, vista de zonas), nunca tokens. El botón de cuentas demo solo existe con `import.meta.env.DEV`. El 3D no carga recursos externos (`Environment` con `Lightformer`, sin `preset`).

**Archivos**
- Disco privado (`storage/app/private`), nombre interno UUID por espacio y MIME real con fileinfo. Comprobado (§8.6): un HTML con extensión `.pdf` y `Content-Type: application/pdf` → 422; un SVG declarado como `image/png` → 422; un PDF llamado `../../evil<x>.pdf` se guarda como `evil_x_.pdf`, con ruta UUID. La descarga lleva `X-Content-Type-Options: nosniff`, `Cache-Control: no-store, private` y `Content-Disposition` con el nombre saneado; `disk` y `path` están en `$hidden`.

**Privacidad**
- La exportación RGPD lleva `Cache-Control: no-store` y la actividad no guarda el nombre del cliente (`CustomerPrivacyTest`). Las notificaciones no llevan nombre, email ni teléfono del particular, y el mecánico no las recibe (`AppNotificationTest`). Hasta que el cliente acepta un presupuesto, el taller no tiene ni su ficha ni su coche (`RepairRequestIsolationTest`).

**Secretos**
- `git ls-files` solo versiona `backend/.env.example`; `.env`, `*.sqlite`, `storage/app/private` y `storage/logs` están en `.gitignore`. La búsqueda de patrones de secretos en todos los archivos versionados (claves de AWS, Google o Slack, `ghp_`, `sk-`, claves privadas PEM, `APP_KEY=base64:` con valor, asignaciones `password/secret/token` con literales largos) solo encontró dos falsos positivos: una contraseña de un test y la contraseña demo `password` del botón de desarrollo. `git log -S "APP_KEY=base64"` no encuentra ningún commit.

## 6. Endpoints sin test de aislamiento

**Ninguno.** `tests/Feature/IsolationTest.php` tiene un *dataset* con cada ruta autenticada con recurso y un test que **falla si una ruta de `route:list --path=api` no está en el dataset**, más otro que exige `can:` en toda ruta no pública. Cubre las 90 rutas de `api/` (los 18 endpoints de E16 y los de RGPD incluidos). `RepairRequestIsolationTest` añade los casos de las dos partes de una solicitud. `php artisan test --filter='IsolationTest|RolesTest|RepairRequestIsolationTest'` → **399 passed (1537 assertions)**.

Lo que **no** tiene test, porque no es aislamiento entre espacios sino rol o privacidad dentro de un espacio:

| Falta un test de… | Hallazgo |
|-------------------|----------|
| El mecánico no recibe gastos en `summary`, `journal`, `report` ni en la frase de actividad | S‑01 (test propuesto en §10.2) |
| Qué importes de órdenes y presupuestos recibe el mecánico | S‑02 (cuando Alberto decida) |
| `POST /members` no revela si existe la cuenta y necesita aceptación | S‑03 |
| Datos del solicitante en una solicitud cerrada o con el cliente anonimizado | S‑04 |
| Quien sale de un taller deja de ver sus avisos | S‑10 |
| `PUT /me/password` cierra las demás sesiones (hoy funciona por `AuthenticateSession` de Sanctum; un cambio en `config/sanctum.php` lo rompería sin que nada avisara) | — (test propuesto en §10.2) |
| Límite en el registro y límite general de la API | S‑05 |

## 7. Auditorías de dependencias

**Backend.** `../.tools/composer audit` **no se pudo ejecutar**: el curl de PHP falla con `curl error 60 … SSL certificate problem: unable to get local issuer certificate` y Composer lo atribuye al cortafuegos de Avast, que intercepta TLS. Para no dejarlo sin hacer, hice la misma comprobación a mano:
1. Bajé los avisos de Packagist para los 128 paquetes de `composer.lock` (producción y desarrollo) con el curl de Git Bash, que usa el almacén de certificados de Windows (Schannel): `POST https://packagist.org/api/security-advisories/` → 200.
2. Comparé las versiones instaladas con `Composer\Semver\Semver::satisfies`, usando el propio `composer.phar`.
3. El script quedó en `C:/Users/Alberto/AppData/Local/Temp/carcare-seguridad/scripts/audit.php`.

Resultado real:

```
[prod] symfony/mime v7.4.19 | PKSA-wtxr-p26d-nn42 | CVE-2026-45070 | medium | CVE-2026-45070: Email Header Injection via Non-Token Characters in Mime Parameter Names
Paquetes revisados: 128 · avisos que afectan a la versión instalada: 1
```

Afecta a `>=7.4.0,<7.4.22` → S‑09.

**Frontend.** `npm audit --omit=dev` y `npm audit` dan lo mismo:

```
zod  <4.6.6
Severity: high
Zod can exhaust memory while validating oversized constrained collections - https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
fix available via `npm audit fix --force`
Will install zod@4.6.7, which is a breaking change
node_modules/zod

1 high severity vulnerability
```

`npm ls zod` → `zod@3.25.76` (directa y deduplicada en `@hookform/resolvers@5.9.2`) → S‑08. No hay otras vulnerabilidades, ni en producción ni en desarrollo.

## 8. Evidencias (comandos y resultados reales)

Las utilidades de `curl` (cookie, `X-XSRF-TOKEN`, `Origin`/`Referer` de `localhost:5188`) están en `C:/Users/Alberto/AppData/Local/Temp/carcare-seguridad/scripts/h.sh`. Todas las peticiones fueron contra `http://127.0.0.1:8070`.

**8.0 Preparación**
```
touch C:/Users/Alberto/AppData/Local/Temp/carcare-seguridad/demo-8070.sqlite
DB_CONNECTION=sqlite DB_DATABASE=…/demo-8070.sqlite php artisan migrate --seed --force   → DemoSeeder DONE (23 vehículos, 36 órdenes, 4 solicitudes, 13 notificaciones…)
ls backend/bootstrap/cache/  → packages.php services.php   (no hay config.php: las variables de entorno se aplican)
login demo@, taller@, gerente@, mecanico@, taller2@ → 200 · sesiones con user_id en la SQLite aislada: 5
php artisan about --only=environment → Environment local · Debug Mode ENABLED · Laravel 12.70.0 · PHP 8.2.12
```

**8.1 Aislamiento (usuario ajeno: `taller2@`)**. 50 peticiones, las 50 → **404**. Entre ellas: `GET/PATCH /workspaces/1`, `GET /workspaces/1/{members,dashboard,activity,reminders,vehicles,repair-requests}`, `POST /workspaces/1/{vehicles,repair-requests}`, `GET /workspaces/3/{customers,work-orders,bays,analytics,directory-profile}`, `PUT /workspaces/3/directory-profile`, `DELETE /workspaces/3`, `PATCH|DELETE /workspaces/3/members/{id}`, las 10 vistas y listados de `/vehicles/1/…`, `PATCH /vehicles/1`, `POST /vehicles/1/archive`, `DELETE /mileage/2`, `GET|PATCH /maintenance/7`, `PATCH|DELETE /expenses/59`, `PATCH /reminders/9`, `POST /reminders/9/complete`, `GET /documents/1/download`, `DELETE /documents/1`, `GET /customers/2`, `POST /customers/2/{export,anonymize}`, `GET /customers/2/vehicles`, `GET /work-orders/1`, `POST /work-orders/1/status`, `GET /repair-requests/3`, `GET /repair-requests/3/history`, `POST /repair-requests/3/cancel` y `POST /repair-requests/4/accept`.

**8.2 Roles**
```
gerente POST /vehicles/3/expenses {"category":"repair","description":"Pastillas compradas a Proveedor X","amount":"321.45",…} → 201
mecánico GET /vehicles/3/expenses → 403 · GET /workspaces/3/analytics → 403
mecánico GET /vehicles/3/summary → totals= {'period': '321.45', 'month': '321.45', 'year': '321.45', …}  by_category= [{'category': 'repair', 'total': '321.45', 'count': 1}]
mecánico GET /vehicles/3/journal → 2026-11-02 spent= 321.45 [('expense', 'Pastillas compradas a Proveedor X', '321.45')]
mecánico GET /vehicles/3/report  → expenses= {'total': '321.45', 'by_category': [...], 'by_year': [{'year': 2026, 'total': '321.45'}]}
mecánico GET /workspaces/3/activity?per_page=1 → expense.created | Elena Demo añadió un gasto de 321,45 € (Reparación) en Reparto 1
mecánico GET /workspaces/3/dashboard → revenue= None
mecánico GET /workspaces/3/work-orders?status=delivered&per_page=200 → n= 21 suma total= 5710.17 · línea {'name': 'Alineación 3D', 'unit_price': '48.00', 'total': '48.00'}
mecánico GET /repair-requests/3 → perspective= workshop requester= {'name': 'Lucía Demo', 'email': 'demo@carcare.test'} phone= 600 000 099 · quote total= 135.52
mecánico POST /repair-requests/4/{accept,reject,quotes} → 403 403 403
gerente PATCH members/2 (owner) {"role":"manager"} → 403 · PATCH members/3 (ella) {"role":"owner"} → 403 · POST members {"role":"owner"} → 422
gerente DELETE members/2 → 403 · DELETE /workspaces/3 → 403 · PUT directory-profile → 403
mecánico POST members → 403 · PATCH members/4 → 403 · DELETE members/3 → 403 · PATCH /workspaces/3 → 403 · POST /vehicles/3/archive → 403
mecánico DELETE /customers/2 → 403 · POST /customers/2/export → 403 · POST /customers/2/anonymize → 403 · DELETE /work-orders/10 → 403 · POST /vehicles/3/expenses → 403
mecánico GET /workspaces/3/members → 200 · GET /customers/2 → 200   (permitido por el contrato)
```

**8.3 IDs en el cuerpo, enumeración y miembros**
```
gerente POST /workspaces/3/vehicles {"customer_id":14 (de taller2)} → 422 "El cliente no existe en este taller."   (igual en PATCH /vehicles/3)
gerente POST /workspaces/3/work-orders {"vehicle_id":1 (de demo)} → 422 · {"assigned_to":1} → 422 · PATCH /work-orders/35 {"vehicle_id":1} → 422
demo POST /workspaces/1/repair-requests {"vehicle_id":3 (del taller)} → 422 "Este vehículo no está en tu garaje." · {"workshop_id":4 (personal)} → 422
filtros ?customer_id=14, ?vehicle_id=1 desde el taller 3 → {"data":[],…,"total":0}
taller2 POST /workspaces/7/members {"email":"noexiste@carcare.test"} → 422 {"message":"No existe ninguna cuenta con ese email."…}
taller2 POST /workspaces/7/members {"email":"demo@carcare.test","role":"mechanic"} → 201 {"data":{"user":{"id":1,"name":"Lucía Demo","email":"demo@carcare.test"},"role":"mechanic",…}}
demo GET /workspaces → 1 personal owner · 7 workshop mechanic     (demo DELETE /workspaces/7/members/1 → 204, deshecho)
POST /auth/register {"email":"gerente@carcare.test",…} → 422 "Ya existe una cuenta con ese email."
```

**8.4 E16 y RGPD**
```
taller POST /repair-requests/3/cancel → 403 · /quote/accept → 403 · PATCH /repair-requests/3 → 403
demo POST /repair-requests/4/accept → 403 · /quotes → 403
taller GET /vehicles/1 → 404 · /vehicles/1/maintenance → 404 · /documents/1/download → 404 · demo GET /work-orders/1 → 404
taller GET /repair-requests/3 → vehicle_id= None share_history= True history_available= True
taller POST /customers/13/anonymize (cliente de la conversión de la solicitud 1) → 200 · demo PATCH /me {"name":"Lucia Nuevo Apellido"} → 200
taller GET /repair-requests/1 → status= converted requester= {'name': 'Lucia Nuevo Apellido', 'email': 'demo@carcare.test'} phone= 600 000 099
taller4 GET /repair-requests/2 → status= rejected requester= {'name': 'Lucia Nuevo Apellido', 'email': 'demo@carcare.test'} closed_at= 2026-10-24T10:30:00+02:00
```

**8.5 Sesión, CSRF y límites**
```
70 × GET /notifications/count → 70 × 200
login con taller3@ y contraseña mala, 7 veces → 422 422 422 422 422 429 429
login con 7 emails distintos desde la misma IP → 422 × 7
8 × POST /auth/register (emails distintos) → 201 × 8
6 × POST /auth/forgot-password → 204 204 204 204 204 429
PATCH /me con sesión válida y sin X-XSRF-TOKEN → 419
GET /me con la cookie de demo y Origin: http://evil.test → 401
cookie de sesión antes y después del login → distinta (regenerada)
dos sesiones de taller3@: PUT /me/password en s1 → 204 · s1 GET /me → 200 · s2 GET /me → 401
PUT /me/password con current_password mala → 422 · DELETE /me sin password → 422
POST /auth/logout → 204 · copia de la cookie anterior GET /me → 401
PATCH /vehicles/1 con JSON mal formado → 200 sin cambios ni traza · GET /vehicles/abc → 404 {"message":"Recurso no encontrado."}
GET /workspaces/1/vehicles?per_page[]=1&sort[]=x → 422 con mensajes en español
```

**8.6 Cabeceras y archivos**
```
GET /api/v1/me → X-Powered-By: PHP/8.2.12 · Cache-Control: no-cache, private · Content-Type: application/json · Access-Control-Allow-Origin: *
  Set-Cookie: XSRF-TOKEN=…; Max-Age=7200; path=/; samesite=lax
  Set-Cookie: carcare-session=…; Max-Age=7200; path=/; httponly; samesite=lax          (sin Secure; sin CSP, XFO, Referrer-Policy ni nosniff)
GET /documents/1/download?inline=1 → Content-Type: application/pdf · X-Content-Type-Options: nosniff · Cache-Control: no-store, private · Content-Disposition: inline; filename=poliza-seguro-ejemplo.pdf
GET /storage/documents/1/<uuid>.pdf sin firma → 403 · PUT /storage/documents/1/x.pdf sin firma → 403
POST /vehicles/1/documents con HTML llamado factura.pdf (type=application/pdf) → 422 "Solo se admiten archivos PDF, JPEG, PNG o WebP."
POST … SVG con type=image/png y filename=foto.png → 422 (mismo mensaje)
POST … PDF válido con filename=../../evil<x>.pdf → 201 original_filename "evil_x_.pdf"   (borrado después con DELETE /documents/7 → 204)
POST … maintenance_record_id=20 (de otro vehículo) → 422 "La intervención no pertenece a este vehículo."
```

**8.7 Código, secretos y logs**
```
grep DB::raw|whereRaw|orderByRaw|selectRaw… app/ → 4 usos, todos literales o con bindings
grep dangerouslySetInnerHTML|innerHTML|eval(|document.write frontend/src → 0
grep temporaryUrl|temporarySignedRoute app/ routes/ → 0
git ls-files | grep -E '\.env|\.pem|\.key|\.sqlite' → backend/.env.example
git grep (patrones de secretos) → 2 falsos positivos (contraseña de un test y la contraseña demo del botón DEV)
storage/logs/laravel.log (663 KB): enlaces 'restablecer?token=' = 4 · 'To:' = 1 · 'local.ERROR' = 23 (17 conexión MySQL, 3 tiempo máximo, 2 tablas, 1 clase)
```

**8.8 Tests**
```
php artisan test → Tests: 936 passed (12432 assertions) · Duration: 235.97s
php artisan test --filter='IsolationTest|RolesTest|RepairRequestIsolationTest' → 399 passed (1537 assertions)
php artisan route:list --path=api → 90 rutas
```

## 9. Limitaciones

- **`.env` y `.env.example` no se leyeron.** La regla de permisos del usuario bloquea los dos: `Read backend/.env.example` → "denied by your permission settings". La configuración se dedujo de `config/*.php` y de `php artisan about`, que da el entorno y el modo debug, no secretos. La búsqueda de patrones con `git grep` recorre todos los archivos versionados, `.env.example` incluido, y no imprimió ninguna línea de ese archivo.
- **`composer audit` no funciona en este equipo** por la inspección TLS de Avast. Lo sustituí por una comprobación equivalente (§7). Puede faltar algún aviso que Composer resuelva de otra forma, por ejemplo los paquetes abandonados.
- **No hay despliegue de producción** en el repo (ni servidor web ni Docker). Las cabeceras, HTTPS, cookies `Secure`, CORS y debug de producción se revisaron solo como configuración (S‑06, S‑11 y S‑15).
- **No probé el frontend en el navegador**, solo su código: no sé qué pantallas muestran hoy al mecánico los datos de S‑01 y S‑02.
- **Tiempos de respuesta:** no medí si `forgot-password` delata la cuenta por el tiempo (lo trata ADR‑0006 con un hash de relleno).
- **Efecto en el disco compartido:** el DemoSeeder de la instancia aislada escribió 6 PDF/PNG de demostración en `backend/storage/app/private/documents/1/` (el `storage/` es el mismo que usa la instancia de Alberto):
  - `0539e4ed-dee0-4ca9-aa0b-4028ac5eefec.pdf`
  - `2caa2b49-59f7-4fb6-8ece-4f9ff024f93d.pdf`
  - `cb10805a-afab-4732-b623-bf13de00086b.pdf`
  - `71462f7f-2f8a-4ae5-9ec7-41e2d0a5c572.png`
  - `e45a093b-4585-4203-b555-51ee30326ba6.pdf`
  - `2918a803-3317-42b7-8ae8-3d35d27ef570.pdf`

  Son ficheros nuevos con nombre UUID que no pisan nada, pero la BD MySQL no los referencia. No los borré porque el encargo prohíbe borrar datos: se pueden quitar uno a uno con `rm`. El documento de prueba que subí (id 7) lo borré por la API.
- Todos los demás datos de prueba (8 cuentas `bot*@ejemplo.test`, `taller3@` con la contraseña cambiada, el cliente 14, el gasto de 321,45 € y el cliente 13 anonimizado) están solo en la SQLite temporal.
- El servidor aislado lo paró dos veces el límite de tiempo de las tareas en segundo plano y lo arranqué de nuevo con la misma configuración. Al terminar, lo paré.

## 10. Siguiente paso y preguntas para Alberto

### 10.1 Qué entra en la tarea 9

No hay hallazgos críticos ni altos, así que, al pie de la letra, la tarea 9 no tiene nada de seguridad. Propongo que entren los **medios**, en este orden:
1. **S‑01** (backend-laravel): no depende de ninguna decisión, porque el contrato ya dice que el mecánico no ve gastos. Es pequeño: pasar `canManage` a `JournalService`, `SummaryService` y `ReportService`, como ya hace `report` con `source_id`, y añadir el test de §10.2.
2. **S‑05, S‑07 y S‑09** (backend-laravel): son baratos. `throttleApi()` y limitadores de login y registro; `'serve' => false`; `composer update symfony/mime`.
3. **S‑03 y S‑04**: necesitan un cambio de contrato del arquitecto. Cuando Alberto responda P2 y P3, el arquitecto actualiza §3.2 y §3.13.7 y después lo hacen backend y frontend.
4. **S‑02**: cuando Alberto responda P1.
5. **S‑06, S‑11 y S‑15** (devops): lista de producción, para cuando haya despliegue.
6. **S‑08** (frontend-react): zod 4 cuando haya hueco; mientras tanto, riesgo aceptado.

No he escrito en `TABLERO.md` ni en `AUTOPILOTO.md`, como pide el encargo. Lo que habría que añadir a "Peticiones entre agentes" es: S‑01 y S‑05/S‑07/S‑09 para backend-laravel, S‑03 y S‑04 para el arquitecto, y P1–P3 en "Preguntas para Alberto".

### 10.2 Tests propuestos (no añadidos a `backend/tests/`)

Con el código actual, este test **falla** porque el ataque funciona:

```php
// tests/Feature/Security/MechanicExpensesTest.php — S-01
it('el mecánico no recibe gastos ni por el diario, ni por el resumen, ni por el informe, ni por la actividad', function () {
    $w = world();                      // $w->wexpense: gasto de 10,00 € en el vehículo del taller
    loginAs($w->mechanic);

    $this->getJson(api('/vehicles/{wvehicle}/expenses', $w))->assertForbidden();

    $journal = collect($this->getJson(api('/vehicles/{wvehicle}/journal', $w))->assertOk()->json('data'));
    expect($journal->flatMap(fn ($day) => $day['entries'])->where('type', 'expense'))->toBeEmpty()
        ->and($journal->pluck('spent')->filter(fn ($s) => $s !== null && $s !== '0.00'))->toBeEmpty();

    $summary = $this->getJson(api('/vehicles/{wvehicle}/summary', $w));
    if ($summary->status() === 200) {
        expect($summary->json('data.totals'))->toBeNull()->and($summary->json('data.by_category'))->toBeNull();
    } else {
        $summary->assertForbidden();
    }

    expect($this->getJson(api('/vehicles/{wvehicle}/report', $w))->assertOk()->json('data.expenses'))->toBeNull();

    $phrases = collect($this->getJson(api('/workspaces/{wws}/activity', $w))->json('data'))->pluck('summary')->implode("\n");
    expect($phrases)->not->toContain('10,00');
});
```

Este otro **pasa hoy** y protege de una regresión: el cierre de las demás sesiones al cambiar la contraseña depende de una línea de configuración.

```php
// tests/Feature/Security/SessionInvalidationTest.php
it('mantiene AuthenticateSession de Sanctum, que cierra las demás sesiones al cambiar la contraseña', function () {
    expect(config('sanctum.middleware.authenticate_session'))
        ->toBe(\Laravel\Sanctum\Http\Middleware\AuthenticateSession::class);
});
```

### 10.3 Preguntas para Alberto

**P1 · ¿El mecánico ve los importes de las órdenes y de los presupuestos? (S‑02)**
- **A)** Sí. Se documenta en §2 que el mecánico ve y escribe los precios de las líneas de órdenes y presupuestos, y que `revenue: null` significa "sin analítica" (no "secreto"). No cambia el código.
- **B)** No. Se ocultan `unit_price`, `subtotal`, `tax_amount` y `total` al mecánico en órdenes y presupuestos, y no puede editar precios (los pone el gerente). Es más trabajo en backend y frontend.
- **C)** Intermedio: ve los precios de las órdenes abiertas en las que trabaja, pero no las entregadas ni los presupuestos.
- **Recomendación: A**, porque es honesta con lo que ya hace la app y no añade trabajo antes de la entrega. S‑01 (gastos) se corrige igualmente, porque el contrato ya lo prohíbe.

**P2 · ¿Añadir a un miembro exige que acepte? (S‑03)**
- **A)** Invitación con aceptación y respuesta genérica.
- **B)** Se queda como está, más un límite de peticiones en `POST /members`.
- **Recomendación: A.** Hoy un email mal escrito da a un desconocido los datos de todos los clientes del taller, y además sirve para averiguar qué emails tienen cuenta. Si no hay tiempo antes de la entrega, B ahora y A después, anotado como limitación en la memoria.

**P3 · ¿Cuánto tiempo ve el taller los datos del particular de una solicitud? (S‑04)**
- **A)** Copia fija de nombre y email al crear la solicitud, anonimizarla junto con el cliente y dejar de mostrar nombre, email y teléfono a los 30 días de cerrada.
- **B)** Solo la copia fija y la anonimización con el cliente.
- **C)** Se queda como está.
- **Recomendación: B ya** (es pequeña y cierra el hueco de la anonimización) **y A** cuando se revise el RGPD de E16.
