# Informe · arquitecto · contrato del origen de las lecturas de km, recuperación de contraseña y RGPD del cliente

> Encargo: paso 1 de las tareas 27, 28 y 29 de `docs/equipo/AUTOPILOTO.md`. Empezado el 23/10 a las 23:40, cortado por el límite de uso y terminado el 24/10. El nombre del archivo es el que fijó la sesión principal. Estado: **terminado**. La sesión principal hizo el commit de los cambios de contrato (abe4df3).

## 1. Objetivo

Diseñar y escribir en el contrato (`docs/api/contrato-v1.md` y `frontend/src/api/types.ts`), con cambios solo aditivos y con el typecheck en verde:
- **Tarea 27 (E7‑1).** Cada lectura de km enlaza con su registro de origen.
- **Tarea 28 (E1‑6, D17 = A).** Recuperar la contraseña, con el correo solo en el log.
- **Tarea 29 (E11‑6).** Exportar y anonimizar un cliente del taller.

## 2. Qué encontré en el código real (solo lectura de `backend/`)

- **`mileage_logs.source_id` ya existe**: es nullable y tiene índice `(source, source_id)`. `MileageService` lo rellena para todos los orígenes:
  - vehículo: `vehicle->id`;
  - intervención, gasto, orden o recordatorio: el id de ese registro;
  - lectura manual: null.

  Solo faltaba devolverlo (`MileageLogResource`).
- **Hay una lectura huérfana posible.** `ReminderService::delete` borra el recordatorio, pero no su lectura (`source = reminder`). Queda un `source_id` que no apunta a nada, y esa lectura no se puede borrar, porque `DELETE /mileage` solo admite las manuales. Con gastos y órdenes sí se borra (`removeForSource`).
- **El gasto vinculado (D3‑A)** se crea sin pasar por `ExpenseService`, así que no genera una segunda lectura. **La intervención que nace al entregar una orden** tampoco: la única lectura es la de `work_order`.
- **La actividad `customer.created`** guarda el nombre del cliente en `summary` ("dio de alta al cliente {nombre}"). Eliminar o anonimizar al cliente lo dejaría ahí.
- **Recuperar la contraseña**:
  - la tabla `password_reset_tokens` ya existe;
  - `config/auth.php` tiene `expire = 60` y `throttle = 60`;
  - `mail.default` vale `log` por defecto;
  - las sesiones se guardan en la tabla `sessions`, con `user_id`;
  - los tests usan `MAIL_MAILER=array` y `SESSION_DRIVER=array`;
  - la SPA ya tiene `ensureCsrfCookie()` y reintenta una vez ante un 419.
- **`ContractShapeTest` lee `types.ts`** y compara las claves de cada interfaz con `tests/Support/Contract.php`. Por eso, cualquier campo nuevo en una interfaz existente hace fallar ese caso hasta que el backend actualiza `Contract.php`.

## 3. Decisiones y razones

### Tarea 27 · `MileageLog.source_id: ID | null` (§3.4.1)
- **Es lo más coherente con los datos reales.** La columna ya existía. Un objeto `source_ref` resuelto en el servidor añadiría consultas polimórficas, justo cuando backend-laravel está optimizando consultas (tarea 19).
- **Invariantes:**
  - es siempre del mismo vehículo, y por tanto nunca de otro espacio;
  - nunca queda huérfano: **borrar un recordatorio borra su lectura**, como ya pasa con gastos y órdenes, y una migración de datos repara las huérfanas que ya existan.
- **Depende del rol**, con el mismo precedente que `revenue`: para un mechanic, las lecturas `expense` llegan con `source_id = null`. Así, la autorización se resuelve en el servidor y la SPA no muestra un enlace que daría 403.
- **Con `vehicle_created`** se devuelve el `vehicle_id` tal como está guardado, sin casos especiales. La SPA no lo enlaza.

### Tarea 28 · `POST /auth/forgot-password` y `POST /auth/reset-password` (§3.1.1, ADR‑0006)
- **Broker de contraseñas de Laravel**, sin dependencias nuevas: token hasheado, que caduca a los 60 minutos y es de un solo uso. Pedir otro enlace sustituye al anterior.
- **No revela si un email tiene cuenta:**
  - pedir el enlace da 204 siempre;
  - `INVALID_USER` y `RESET_THROTTLED` responden igual que un envío correcto;
  - un token incorrecto, caducado o usado, o un email sin cuenta, dan el mismo 422 en `errors.token`.
- **Límite de intentos**: 429 a partir de la 6.ª petición en un minuto desde la misma IP (`throttle:5,1`). Cuenta todas las peticiones, exista o no la cuenta.
- **Al restablecer se cierran todas las sesiones y se rota `remember_token`**, como recomendó la sesión principal. No se inicia sesión: se vuelve a `/entrar`.
- **CSRF igual que en el login**: las rutas son públicas pero *stateful*.
- **Rutas de la SPA:** `/recuperar` y `/restablecer?token=…&email=…`, las dos `GuestOnly`.
- **El enlace del correo** se construye con `config('app.frontend_url')`, que tiene valor por defecto, así que no hace falta tocar `.env`.

### Tarea 29 · exportar y anonimizar (§3.10.1, ADR‑0005)
- **Las dos son `POST` con permiso `manage`.**
  - Exportar es POST porque deja rastro en la actividad y no debe repetirse por cachés ni por reintentos automáticos de React Query.
  - Responde `Resource<CustomerExport>` (cliente, vehículos y órdenes) con `Cache-Control: no-store`.
- **Anonimizar es irreversible.** Deja el nombre en "Cliente anonimizado" y vacía el resto de datos personales, pero conserva el `id`, los vínculos y el historial técnico. Hay un campo nuevo, `Customer.anonymized_at`, como única fuente de verdad: deducirlo del nombre sería frágil.
- **Errores y reglas:**
  - si ya está anonimizado ⇒ 409;
  - si tiene órdenes abiertas ⇒ 409, la misma regla que para eliminar, porque mientras el coche está en el taller hay que poder llamar al cliente;
  - un `PATCH` posterior ⇒ 409;
  - asignar a un vehículo un cliente anonimizado ⇒ 422.
- **Anonimizar y eliminar reescriben sin el nombre** las frases de actividad de ese cliente. Hay dos actividades nuevas que nunca llevan el nombre.
- **Límites declarados**: los textos libres de órdenes y vehículos y los archivos adjuntos no se tocan.

### Preguntas para Alberto
**Ninguna nueva.** El alcance de las tres tareas ya estaba fijado: criterios de producto y D17 = A.

## 4. Archivos tocados (todos en mi zona, salvo el informe y el tablero, que permite el protocolo)

| Archivo | Cambio |
|---------|--------|
| `frontend/src/api/types.ts` | Nuevos: `ForgotPasswordInput`, `ResetPasswordInput`, `MileageLog.source_id`, `Customer.anonymized_at` y `CustomerExport`. Solo aditivo |
| `docs/api/contrato-v1.md` | Dos filas en §3.1 y la nueva §3.1.1. Regla del `customer_id` anonimizado en §3.3. Nueva §3.4.1. DELETE de recordatorio en §3.7. Cuatro filas en §3.10 y la nueva §3.10.1. Datos del cliente en la actividad (§3.12). Tres filas en el historial y una nota sobre `ContractShapeTest` |
| `docs/arquitectura/ADR-0005-rgpd-cliente-taller.md` | Nuevo |
| `docs/arquitectura/ADR-0006-recuperar-contrasena.md` | Nuevo |
| `docs/equipo/TABLERO.md` | Mi fila y las peticiones 3‑8 |

No he tocado `backend/`, ninguna pantalla, `.env` ni `Car_Care_Documentacion/`. No he hecho commits.

## 5. Encargos

| Petición | Para | Tarea y paso | Depende de |
|----------|------|--------------|------------|
| 3 | backend-laravel | 27, paso 2 | Que termine la 19 |
| 4 | backend-laravel | 28, paso 2 | Que termine la 19 |
| 5 | backend-laravel | 29, paso 2 | Que termine la 19 |
| 6 | frontend-react (particular) | 27, paso 3 (`JournalTab.tsx`) | Petición 3 |
| 7 | frontend-react | 28, paso 3 (dos pantallas en `features/auth/`, el enlace en `LoginPage` y las rutas en `router.tsx`) | Petición 4 |
| 8 | frontend-react (taller) | 29, paso 3 (`CustomerDetailPage.tsx`, etiqueta en la lista y selector de cliente) | Petición 5 y tarea 25 |

Tests que pido al backend, además de los del tablero:
- **Tarea 27:**
  - forma con `source_id` en `GET /mileage` y en `VehicleReport`;
  - la migración de huérfanas convierte una lectura `reminder` sin recordatorio en `manual` con su nota.
- **Tarea 28:**
  - se rota `remember_token`;
  - el enlace de la notificación empieza por `config('app.frontend_url').'/restablecer?token='`;
  - el email se normaliza (mayúsculas y espacios).
- **Tarea 29:**
  - la exportación incluye los vehículos archivados y las órdenes de todos los estados;
  - la cabecera `Cache-Control` lleva `no-store`;
  - `CustomerExport` está en `Contract::interfaces()`.

## 6. Evidencias

| Comando | Resultado |
|---------|-----------|
| `cd frontend && npm run typecheck` (al terminar `types.ts` y otra vez al final) | `tsc -b`, **código de salida 0**, sin errores |
| `cd frontend && npx --no-install oxlint src/api/types.ts` | **Código de salida 0** (el lint del proyecto es `oxlint`. Lancé por error `npx eslint` y devolvió 2: no es la herramienta del proyecto) |
| Simulación de la expresión regular de `ContractShapeTest` sobre `types.ts` (script PHP en el scratchpad; no he ejecutado nada en `backend/`) | `MileageLog` ya incluye `source_id` y `Customer` ya incluye `anonymized_at`. Así que, hasta las peticiones 3 y 5, el test marca 2 casos en rojo. La sesión principal lo confirmó tras el commit abe4df3 |
| `git diff --stat` | `contrato-v1.md` +163 líneas; `types.ts` +47; `TABLERO.md` actualizado |

## 7. Limitaciones y pendientes

- **No he ejecutado los tests del backend**, para no interferir con backend-laravel. La cifra de 2 fallos sale de la simulación y de lo que comprobó la sesión principal.
- **Propuesta para más adelante:** que `PUT /me/password` cierre también las demás sesiones, para que se comporte igual que el restablecimiento. No lo he metido para no ampliar el alcance.
- **Otra zona:** la sesión principal puede añadir ADR‑0005 y ADR‑0006 al resumen de `CLAUDE.md`, y producto, al registro de decisiones.
- **Seguridad (tarea 7)** tendrá que hacer una segunda pasada sobre los endpoints nuevos (ya está anotado en la cola).
