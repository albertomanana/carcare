# 15. Anexos

## Anexo A. Índice de la API

Rutas reales de la API a 26/10/2026, obtenidas con `php artisan route:list --path=api --except-vendor --json` sobre el árbol de trabajo de ese día (que incluye el commit `f1265b6` de las tareas 27, 28 y 29). Son **72 rutas**, todas bajo el prefijo `/api/v1`; 60 de ellas llevan un recurso en la URL y son las que comprueba `IsolationTest` (capítulo 8). A estas se suma `GET /sanctum/csrf-cookie`, que publica Laravel Sanctum y no aparece en el listado porque se excluyen las rutas de paquetes.

Este anexo es un **índice**. Las formas JSON de cada petición y respuesta, los códigos de error y las reglas de negocio están en el contrato, [`docs/api/contrato-v1.md`](../../api/contrato-v1.md), y en sus tipos, `frontend/src/api/types.ts`.

**Columna "Permiso".** *Pública*: sin sesión. *Sesión*: basta con haber iniciado sesión. Una capacidad entre comillas invertidas (`view`, `operate`, `manage`, `own`) es la que comprueba el *middleware* `can` de la ruta sobre el recurso de la URL, según el rol del usuario en el espacio de ese recurso (capítulo 6, §6.3). `viewWorkshop` y `operateWorkshop` son `view` y `operate` exigiendo además que el espacio sea un taller; `removeMember` permite a un gerente o al propietario quitar a otro miembro y a cualquier miembro salir del taller. "(5/min)" indica el límite de peticiones del *middleware* `throttle`.

**Cómo regenerarlo.** El script [`docs/tfg/herramientas/anexo_api.py`](../herramientas/anexo_api.py) produce estas tablas a partir del JSON de `route:list`. Si aparece una ruta nueva sin descripción, la marca como `PENDIENTE` para que no pase desapercibida.

### Salud y autenticación (6 rutas)

*Tabla 15.1. API: salud y autenticación.*

| Método | Ruta | Controlador | Permiso | Uso |
|--------|------|-------------|---------|-----|
| POST | `/api/v1/auth/forgot-password` | `Auth\PasswordResetController@forgot` | Pública (5/min) | Pedir el enlace de recuperación |
| POST | `/api/v1/auth/login` | `Auth\AuthController@login` | Pública | Inicio de sesión (5 intentos por minuto, en `LoginRequest`) |
| POST | `/api/v1/auth/logout` | `Auth\AuthController@logout` | Sesión | Cierre de sesión |
| POST | `/api/v1/auth/register` | `Auth\AuthController@register` | Pública | Registro; crea el espacio personal |
| POST | `/api/v1/auth/reset-password` | `Auth\PasswordResetController@reset` | Pública (5/min) | Fijar una contraseña nueva con el enlace |
| GET | `/api/v1/health` | `HealthController` | Pública | Comprobación de salud |

### Cuenta del usuario (4 rutas)

*Tabla 15.2. API: cuenta del usuario.*

| Método | Ruta | Controlador | Permiso | Uso |
|--------|------|-------------|---------|-----|
| GET | `/api/v1/me` | `MeController@show` | Sesión | Usuario actual |
| PATCH | `/api/v1/me` | `MeController@update` | Sesión | Editar nombre y email |
| DELETE | `/api/v1/me` | `MeController@destroy` | Sesión | Baja de la cuenta |
| PUT | `/api/v1/me/password` | `MeController@password` | Sesión | Cambiar la contraseña |

### Espacios de trabajo y miembros (20 rutas)

*Tabla 15.3. API: espacios de trabajo, miembros y vistas del espacio.*

| Método | Ruta | Controlador | Permiso | Uso |
|--------|------|-------------|---------|-----|
| GET | `/api/v1/workspaces` | `WorkspaceController@index` | Sesión | Espacios del usuario con su rol |
| POST | `/api/v1/workspaces` | `WorkspaceController@store` | Sesión | Crear un taller |
| GET | `/api/v1/workspaces/{workspace}` | `WorkspaceController@show` | `view` | Ver un espacio |
| PATCH | `/api/v1/workspaces/{workspace}` | `WorkspaceController@update` | `manage` | Ajustes del taller |
| DELETE | `/api/v1/workspaces/{workspace}` | `WorkspaceController@destroy` | `own` | Eliminar un taller |
| GET | `/api/v1/workspaces/{workspace}/activity` | `WorkspaceOverviewController@activity` | `view` | Registro de actividad |
| GET | `/api/v1/workspaces/{workspace}/analytics` | `WorkspaceOverviewController@analytics` | `manage` | Analítica del espacio |
| GET | `/api/v1/workspaces/{workspace}/bays` | `Workshop\WorkOrderController@bays` | `viewWorkshop` | Ocupación de los elevadores |
| GET | `/api/v1/workspaces/{workspace}/customers` | `Workshop\CustomerController@index` | `viewWorkshop` | Listar clientes |
| POST | `/api/v1/workspaces/{workspace}/customers` | `Workshop\CustomerController@store` | `operateWorkshop` | Alta de cliente |
| GET | `/api/v1/workspaces/{workspace}/dashboard` | `WorkspaceOverviewController@dashboard` | `view` | Panel de inicio o centro de control |
| GET | `/api/v1/workspaces/{workspace}/members` | `MemberController@index` | `view` | Listar miembros |
| POST | `/api/v1/workspaces/{workspace}/members` | `MemberController@store` | `manage` | Añadir un miembro ya registrado |
| PATCH | `/api/v1/workspaces/{workspace}/members/{user}` | `MemberController@update` | `manage` | Cambiar el rol de un miembro |
| DELETE | `/api/v1/workspaces/{workspace}/members/{user}` | `MemberController@destroy` | `removeMember` | Quitar un miembro o salir del taller |
| GET | `/api/v1/workspaces/{workspace}/reminders` | `WorkspaceOverviewController@reminders` | `view` | Agenda de recordatorios |
| GET | `/api/v1/workspaces/{workspace}/vehicles` | `VehicleController@index` | `view` | Listar vehículos |
| POST | `/api/v1/workspaces/{workspace}/vehicles` | `VehicleController@store` | `operate` | Alta de vehículo |
| GET | `/api/v1/workspaces/{workspace}/work-orders` | `Workshop\WorkOrderController@index` | `viewWorkshop` | Listar órdenes (tablero) |
| POST | `/api/v1/workspaces/{workspace}/work-orders` | `Workshop\WorkOrderController@store` | `operateWorkshop` | Crear una orden |

### Vehículos y su seguimiento (32 rutas)

*Tabla 15.4. API: vehículos, kilometraje, intervenciones, gastos, recordatorios y documentos.*

| Método | Ruta | Controlador | Permiso | Uso |
|--------|------|-------------|---------|-----|
| DELETE | `/api/v1/documents/{document}` | `DocumentController@destroy` | `operate` | Borrar un documento |
| GET | `/api/v1/documents/{document}/download` | `DocumentController@download` | `view` | Descargar o previsualizar |
| PATCH | `/api/v1/expenses/{expense}` | `ExpenseController@update` | `manage` | Editar un gasto manual |
| DELETE | `/api/v1/expenses/{expense}` | `ExpenseController@destroy` | `manage` | Borrar un gasto manual |
| GET | `/api/v1/maintenance/{maintenanceRecord}` | `MaintenanceController@show` | `view` | Detalle de una intervención |
| PATCH | `/api/v1/maintenance/{maintenanceRecord}` | `MaintenanceController@update` | `operate` | Editar una intervención |
| POST | `/api/v1/maintenance/{maintenanceRecord}/archive` | `MaintenanceController@archive` | `operate` | Archivar una intervención |
| POST | `/api/v1/maintenance/{maintenanceRecord}/restore` | `MaintenanceController@restore` | `operate` | Restaurar una intervención |
| DELETE | `/api/v1/mileage/{mileageLog}` | `MileageController@destroy` | `operate` | Borrar una lectura manual |
| PATCH | `/api/v1/reminders/{reminder}` | `ReminderController@update` | `operate` | Editar un recordatorio |
| DELETE | `/api/v1/reminders/{reminder}` | `ReminderController@destroy` | `operate` | Borrar un recordatorio |
| POST | `/api/v1/reminders/{reminder}/complete` | `ReminderController@complete` | `operate` | Completarlo (crea el siguiente si es recurrente) |
| POST | `/api/v1/reminders/{reminder}/dismiss` | `ReminderController@dismiss` | `operate` | Descartarlo |
| GET | `/api/v1/vehicles/{vehicle}` | `VehicleController@show` | `view` | Ficha del vehículo |
| PATCH | `/api/v1/vehicles/{vehicle}` | `VehicleController@update` | `operate` | Editar el vehículo |
| DELETE | `/api/v1/vehicles/{vehicle}` | `VehicleController@destroy` | `manage` | Eliminar un vehículo archivado |
| POST | `/api/v1/vehicles/{vehicle}/archive` | `VehicleController@archive` | `manage` | Archivar |
| GET | `/api/v1/vehicles/{vehicle}/documents` | `DocumentController@index` | `view` | Listar documentos |
| POST | `/api/v1/vehicles/{vehicle}/documents` | `DocumentController@store` | `operate` | Subir un documento |
| GET | `/api/v1/vehicles/{vehicle}/expenses` | `ExpenseController@index` | `manage` | Listar gastos |
| POST | `/api/v1/vehicles/{vehicle}/expenses` | `ExpenseController@store` | `manage` | Registrar un gasto |
| GET | `/api/v1/vehicles/{vehicle}/journal` | `VehicleController@journal` | `view` | Diario por días |
| GET | `/api/v1/vehicles/{vehicle}/maintenance` | `MaintenanceController@index` | `view` | Historial de intervenciones |
| POST | `/api/v1/vehicles/{vehicle}/maintenance` | `MaintenanceController@store` | `operate` | Registrar una intervención |
| GET | `/api/v1/vehicles/{vehicle}/mileage` | `MileageController@index` | `view` | Lecturas de km con su origen |
| POST | `/api/v1/vehicles/{vehicle}/mileage` | `MileageController@store` | `operate` | Nueva lectura de km |
| GET | `/api/v1/vehicles/{vehicle}/reminders` | `ReminderController@index` | `view` | Listar recordatorios |
| POST | `/api/v1/vehicles/{vehicle}/reminders` | `ReminderController@store` | `operate` | Crear un recordatorio |
| GET | `/api/v1/vehicles/{vehicle}/report` | `VehicleController@report` | `view` | Datos del informe del vehículo |
| POST | `/api/v1/vehicles/{vehicle}/restore` | `VehicleController@restore` | `manage` | Restaurar |
| GET | `/api/v1/vehicles/{vehicle}/summary` | `VehicleController@summary` | `view` | Resumen de gastos y coste por km |
| GET | `/api/v1/vehicles/{vehicle}/zones` | `VehicleController@zones` | `view` | Estado de las 10 zonas |

### Taller: clientes y órdenes (10 rutas)

*Tabla 15.5. API: clientes y órdenes de trabajo del taller.*

| Método | Ruta | Controlador | Permiso | Uso |
|--------|------|-------------|---------|-----|
| GET | `/api/v1/customers/{customer}` | `Workshop\CustomerController@show` | `view` | Ficha del cliente |
| PATCH | `/api/v1/customers/{customer}` | `Workshop\CustomerController@update` | `operate` | Editar el cliente |
| DELETE | `/api/v1/customers/{customer}` | `Workshop\CustomerController@destroy` | `manage` | Borrar el cliente (sin órdenes abiertas) |
| POST | `/api/v1/customers/{customer}/anonymize` | `Workshop\CustomerController@anonymize` | `manage` | Anonimizarlo (RGPD) |
| POST | `/api/v1/customers/{customer}/export` | `Workshop\CustomerController@export` | `manage` | Exportar sus datos en JSON (RGPD) |
| GET | `/api/v1/customers/{customer}/vehicles` | `Workshop\CustomerController@vehicles` | `view` | Vehículos del cliente |
| GET | `/api/v1/work-orders/{workOrder}` | `Workshop\WorkOrderController@show` | `view` | Detalle de la orden |
| PATCH | `/api/v1/work-orders/{workOrder}` | `Workshop\WorkOrderController@update` | `operate` | Editar la orden y sus líneas |
| DELETE | `/api/v1/work-orders/{workOrder}` | `Workshop\WorkOrderController@destroy` | `manage` | Borrar una orden recibida o cancelada |
| POST | `/api/v1/work-orders/{workOrder}/status` | `Workshop\WorkOrderController@status` | `operate` | Cambiar el estado (entregar crea la intervención) |


## Anexo B. Decisiones de arquitectura (ADR)

Cada ADR recoge el contexto, las opciones consideradas, la decisión y sus consecuencias. El capítulo 6 (§6.2) explica cómo se reflejan en el diseño.

*Tabla 15.6. Decisiones de arquitectura del proyecto.*

| ADR | Decisión | Estado a 26/10/2026 |
|-----|----------|---------------------|
| [ADR‑0001](../../arquitectura/ADR-0001-api-rest-y-spa.md) | API REST con Laravel y SPA con React en un monorepo | Aceptada el 21/10. Revisable si la guía de Ilerna impone otra cosa (D1) |
| [ADR‑0002](../../arquitectura/ADR-0002-espacios-de-trabajo.md) | Espacios de trabajo particular y taller sobre el mismo modelo, con roles | Aceptada el 21/10 |
| [ADR‑0003](../../arquitectura/ADR-0003-gasto-vinculado.md) | Una intervención con coste genera un gasto vinculado, sin doble conteo | Aceptada el 21/10 |
| [ADR‑0004](../../arquitectura/ADR-0004-vehiculo-3d-procedural.md) | Vehículo en 3D procedural propio, con silueta 2D de respaldo | Aceptada el 21/10 |
| [ADR‑0005](../../arquitectura/ADR-0005-rgpd-cliente-taller.md) | Derechos RGPD del cliente del taller: exportar en JSON y anonimizar en lugar de borrar | Aceptada el 24/10. API implementada y probada (commit `f1265b6`); pantalla en curso (tarea 29, paso 3) |
| [ADR‑0006](../../arquitectura/ADR-0006-recuperar-contrasena.md) | Recuperar la contraseña con el *broker* de Laravel y el correo en el registro | Aceptada el 24/10. API implementada y probada (commit `f1265b6`); pantallas en curso (tarea 28, paso 3) |
| [ADR‑0007](../../arquitectura/ADR-0007-solicitudes-a-talleres.md) | Solicitudes de reparación de un particular a un taller: directorio, presupuesto, orden y notificaciones (E16) | Aceptada el 26/10, todavía sin confirmar en el repositorio. Sin código: contrato (§3.13), backend y pantallas pendientes (tareas 32‑35) |

## Anexo C. Glosario

Términos tal como se usan en esta memoria y en el código; entre paréntesis, el identificador en la API cuando existe. El glosario ampliado de la fase de planificación ([`docs/tfg/08-glosario.md`](../08-glosario.md), 21/10/2026) define más términos; donde no coincida con este anexo, prevalece este anexo, que se ha contrastado con el código del 26/10/2026.

*Tabla 15.7. Glosario.*

| Término | Definición |
|---------|------------|
| ADR | *Architecture decision record*: documento breve que fija una decisión de arquitectura, sus alternativas y sus consecuencias. |
| Aislamiento | Garantía de que un usuario nunca ve ni modifica datos de un espacio al que no pertenece. Un recurso ajeno responde 404, no 403, para no revelar que existe. |
| Anonimizar (`anonymize`) | Sustituir los datos personales de un cliente del taller conservando el historial técnico de sus vehículos (ADR‑0005). Deja la fecha en `anonymized_at`. |
| API REST | Interfaz de programación sobre HTTP en la que cada URL es un recurso y el método indica la operación. |
| Archivar | Ocultar un vehículo o una intervención de los listados sin borrarlo, con posibilidad de restaurarlo. |
| Capacidad (`view`, `operate`, `manage`, `own`) | Permiso abstracto que exige una operación: ver, operar, gestionar y poseer. Cada rol tiene un conjunto acumulativo de capacidades (capítulo 6, §6.3). |
| Carga diferida (*lazy loading*) | Descargar el código de una pantalla o de three.js solo cuando se necesita. |
| Centro de control | Panel de inicio de un taller: contadores, órdenes por estado, elevadores, prometidas para hoy y retrasadas. |
| Contrato de la API | Documento (`docs/api/contrato-v1.md`) y tipos (`frontend/src/api/types.ts`) que fijan cada forma JSON antes de escribir el código. |
| Coste por kilómetro | Gasto dividido entre los km recorridos. Solo se calcula con dos o más lecturas separadas al menos 500 km y 30 días; si no, se explica qué falta. |
| CSRF | *Cross‑site request forgery*. Sanctum lo evita con una cookie `XSRF-TOKEN` que el cliente devuelve en una cabecera. |
| DECIMAL | Tipo numérico exacto de SQL con el que se guarda el dinero. En el JSON viaja como cadena para no perder precisión. |
| Datos de demostración | Cuatro cuentas ficticias que crea `DemoSeeder`, de forma aditiva e idempotente (capítulo 7, §7.7). |
| Directorio de talleres | Lista de talleres de CarCare que aceptan solicitudes de particulares. Diseñado en ADR‑0007; no implementado. |
| Elevador (`bay`) | Puesto de trabajo numerado del taller; admite una sola orden abierta a la vez. |
| Espacio de trabajo (`workspace`) | Contenedor de todos los datos. Puede ser `personal` (el garaje de un particular) o `workshop` (un taller o flota) (ADR‑0002). |
| Gasto vinculado | Gasto que se crea o actualiza automáticamente desde una intervención con coste en un espacio personal. Solo se edita desde la intervención (ADR‑0003). |
| Idempotente | Que ejecutarlo varias veces produce el mismo resultado que ejecutarlo una. |
| Intervención (`maintenance_record`) | Mantenimiento, reparación, inspección u otra operación hecha a un vehículo, con sus líneas de detalle. |
| Kilometraje actual | Km de la lectura más reciente por fecha (a igual fecha, la mayor). Se deriva de las lecturas, no se edita a mano. |
| Lectura de kilometraje (`mileage_log`) | Registro del cuentakilómetros en una fecha, con su origen (manual, alta, intervención, gasto, orden o recordatorio) y, si procede, el identificador del registro de origen (`source_id`). |
| Lleno a lleno | Método de cálculo del consumo entre dos repostajes con el depósito lleno. |
| Mapa de zonas | Diez zonas del vehículo cuyo estado se calcula a partir de los recordatorios; se rotula "según tus intervalos, no medido". |
| Orden de trabajo (`work_order`) | Trabajo de un taller sobre un vehículo, numerado `OT-AAAA-nnnn`, con estado, líneas, IVA y elevador. |
| *Policy* | Clase de Laravel que decide si un usuario puede hacer una operación sobre un modelo. |
| Recordatorio (`reminder`) | Aviso por fecha, por km o por ambos. Si es recurrente, al completarlo se crea el siguiente. |
| Resumen imprimible | Documento de una orden de trabajo para el cliente, rotulado "No es una factura" (D12 = A). El mecánico lo imprime sin precios. |
| Rol (`owner`, `manager`, `mechanic`) | Propietario, gerente y mecánico. Determina las capacidades de un miembro en un espacio. |
| Sanctum (modo SPA) | Paquete de Laravel que autentica una SPA del mismo dominio con la cookie de sesión. |
| *Seeder* | Clase que carga datos en la base de datos. |
| Silueta SVG | Dibujo 2D del vehículo que sustituye al 3D sin WebGL o mientras carga. |
| Solicitud de reparación | Petición de un particular a un taller del directorio, que el taller acepta, presupuesta o rechaza (E16, ADR‑0007). No implementada. |
| SPA | *Single‑page application*: aplicación web que carga una vez y cambia de pantalla sin recargar. |
| SUS | *System Usability Scale*: cuestionario de 10 preguntas que da una puntuación de usabilidad de 0 a 100 (Brooke, 1996). |
| Tablero kanban | Vista de las órdenes en columnas por estado. |
| WebGL | API del navegador para dibujar gráficos 3D con la tarjeta gráfica. |

## Anexo D. Decisiones del producto citadas

El registro completo está en [`CarCare/03_decisiones/registro-decisiones.md`](../../../CarCare/03_decisiones/registro-decisiones.md). Estas son las que cita la memoria:

*Tabla 15.8. Decisiones del producto citadas en la memoria.*

| Decisión | Asunto | Estado a 26/10/2026 |
|----------|--------|---------------------|
| D1 | Normativa oficial del TFG de Ilerna | Pendiente: no se tiene la guía |
| D2 | Forma de la aplicación: API REST y SPA separadas | Aceptada provisionalmente el 21/10 (ADR‑0001) |
| D9 | Orden de recorte si el calendario no da | Pendiente (recomendación: B como contingencia) |
| D12 | Facturación en el modo taller | A: se calculan los importes, pero no se emiten facturas; resumen "no es una factura" (24/10) |
| D13 | Puente entre el taller y el particular | Pendiente; E16 (ADR‑0007) cubre una parte |
| D14 | Despliegue de la demostración para la defensa | Pendiente (capítulo 9) |
| D15 | Versiones del entorno con soporte caducado | Pendiente (recomendación: B, actualizar Node ahora y PHP y Laravel según el calendario) |
| D16 | Modelo exacto del coche y logotipos de marca | No: réplica procedural por carrocería (23/10) |
| D17 | Envío de correos | A: correo solo en local, en el registro (24/10) |

## Anexo E. Informes del equipo usados como fuente

Las cifras y afirmaciones sobre el estado del sistema que no salen directamente del código salen de estos informes, en [`docs/equipo/informes/`](../../equipo/informes/):

*Tabla 15.9. Informes del equipo citados.*

| Fecha | Agente | Informe |
|-------|--------|---------|
| 21/10/2026 | `producto` | [Backlog y decisiones](../../equipo/informes/2026-10-21-producto-backlog-y-decisiones.md) |
| 23/10/2026 | `backend-laravel` | [API v1](../../equipo/informes/2026-10-23-backend-laravel-api-v1.md) |
| 23/10/2026 | `backend-laravel` | [Datos de demostración y rendimiento](../../equipo/informes/2026-10-23-backend-laravel-demo-y-rendimiento.md) |
| 23/10/2026 | `arquitecto` | [Contrato del origen del km, RGPD y recuperación de contraseña](../../equipo/informes/2026-10-23-arquitecto-contrato-km-rgpd.md) |
| 23/10/2026 | `experto-3d` | [Rendimiento del 3D](../../equipo/informes/2026-10-23-experto-3d-rendimiento.md) |
| 23/10/2026 | `frontend-react` | [Analítica](../../equipo/informes/2026-10-23-frontend-react-analitica.md) y [modo taller](../../equipo/informes/2026-10-23-frontend-react-taller.md) |
| 23/10/2026 | `disenador-ux` | [Simplificación de la interfaz](../../equipo/informes/2026-10-23-disenador-ux-simplificacion.md) |
| 23/10/2026 | `producto` | [Mapa de huecos del backlog](../../equipo/informes/2026-10-23-producto-mapa-de-huecos.md) |
| 25/10/2026 | sesión principal | [Cierre y evidencias](../../equipo/informes/2026-10-25-sesion-principal-cierre.md) |
| 24‑26/10/2026 | `documentador-tfg` | [Memoria del TFG](../../equipo/informes/2026-10-24-documentador-tfg-memoria.md) |

> [PENDIENTE: tarea 10 — añadir los informes de integración (tarea 5), E2E y accesibilidad (tarea 6), seguridad (tarea 7) y los de `frontend-react` del 26/10 cuando estén cerrados.]

## Anexo F. Capturas de pantalla

La lista de capturas previstas está en el capítulo 11 (§11.5).

> [PENDIENTE: tarea 10 — capturas tras la simplificación de la interfaz.]
