# 1. Especificación de requisitos

*Versión 1 · 21/10/2026 · Autor: agente `documentador-tfg` · Estado: **borrador de análisis** (oleada 1).*

> **Fuentes.** Contrato de la API v1 ([`docs/api/contrato-v1.md`](../api/contrato-v1.md)) y sus tipos ([`frontend/src/api/types.ts`](../../frontend/src/api/types.ts)); ADR‑0001…0004 ([`docs/arquitectura/`](../arquitectura/)); backlog del MVP ([`CarCare/02_backlog/backlog-mvp.md`](../../CarCare/02_backlog/backlog-mvp.md)); documentación original (`Car_Care_Documentacion/02_Requisitos_y_modulos.md`, `04_Arquitectura_y_datos.md`).
>
> **Qué no es este documento.** No describe lo que ya funciona: a 21/10/2026 el backend y el frontend se están construyendo en paralelo contra el contrato. El estado de implementación de cada requisito se seguirá en la columna *Estado* cuando existan pruebas que lo demuestren (ver [07‑plan-de-pruebas.md](07-plan-de-pruebas.md)).

## 1.1 Alcance y convenciones

CarCare ofrece **dos modos sobre la misma base de datos** ([ADR‑0002](../arquitectura/ADR-0002-espacios-de-trabajo.md)):

- **Particular** — espacio de trabajo de tipo `personal` («Mi garaje»): garaje propio, kilometraje, gastos, historial, recordatorios, documentos, analítica e informe.
- **Taller / flota** — espacio de tipo `workshop`: clientes, flota, órdenes de trabajo en tablero kanban, elevadores en un taller 3D, equipo con roles y facturación.

Ambos comparten la **experiencia 3D** del vehículo ([ADR‑0004](../arquitectura/ADR-0004-vehiculo-3d-procedural.md)).

**Identificadores.** `RF-nn` (funcional) y `RNF-nn` (no funcional), con guion ASCII para que se puedan buscar. Las historias del backlog se citan como `E3-6` (en el backlog aparecen con guion no separable, `E3‑6`).

**Columnas de las tablas de requisitos funcionales.**

| Columna | Significado |
|---------|-------------|
| Modo | **P** = particular · **T** = taller · **P/T** = ambos |
| Prioridad | MoSCoW: `Must` · `Should` · `Could`. Si la historia existe en el backlog, se copia su prioridad. Si no existe (funciones de taller, 3D y recordatorios añadidas por ADR‑0002/0004 y por el contrato v1), la prioridad es una **propuesta del documentador, pendiente de validar por `producto`** y se marca con †. |
| Permiso | Capacidad mínima en el espacio: `view`, `operate`, `manage`, `own` (contrato §2). |
| Endpoints | Trazabilidad al contrato. Todas las rutas cuelgan de `/api/v1` salvo `/sanctum/csrf-cookie`. |
| Historia | Historia del backlog que lo origina, o «—» si aún no existe. |

**Permisos por rol** (contrato §2):

| Capacidad | owner | manager | mechanic |
|-----------|:-----:|:-------:|:--------:|
| `view`: ver todo el espacio | ✔ | ✔ | ✔ |
| `operate`: crear/editar vehículos, intervenciones, km, recordatorios, documentos, órdenes, clientes | ✔ | ✔ | ✔ |
| `manage`: archivar/eliminar vehículos y clientes, gastos, facturación/analítica, ajustes, miembros | ✔ | ✔ | ✘ |
| `own`: eliminar el espacio de taller | ✔ | ✘ | ✘ |

En un espacio `personal` solo existe el `owner`.

## 1.2 Requisitos funcionales

### Módulo SIS · Sistema

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-01 | El sistema expone una comprobación de salud que responde `{ "status": "ok" }`. | — | Must | público | `GET /health` | E0-1 |
| RF-02 | El sistema dispone de datos de demostración claramente ficticios (usuario particular con 2 vehículos y ~18 meses de historial; taller con 4 elevadores, 3 miembros, ~12 clientes, ~20 vehículos y ~30 órdenes), cargables con un comando y que **abortan en producción**. | P/T | Must | — | `php artisan db:seed --class=DemoSeeder` (contrato §5) | E6-1 |

### Módulo AUT · Autenticación y cuenta

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-03 | Un visitante puede **registrarse** con nombre (2–100), email único (se guarda en minúsculas) y contraseña (≥ 8, con confirmación), eligiendo tipo de cuenta `personal` o `workshop` (en este caso, con nombre del taller). Siempre se crea su espacio personal; si elige taller, además un espacio `workshop` del que es `owner`. Al terminar queda con la sesión iniciada. | P/T | Must | público | `GET /sanctum/csrf-cookie`, `POST /auth/register` | E1-1 |
| RF-04 | Un usuario puede **iniciar sesión**. Ante credenciales erróneas recibe un mensaje genérico («Las credenciales no son correctas.»). Tras 5 intentos por minuto (email + IP) se bloquea temporalmente (429). | P/T | Must | público | `GET /sanctum/csrf-cookie`, `POST /auth/login` | E1-2 |
| RF-05 | Un usuario puede **cerrar sesión**; la sesión se invalida y el token CSRF se regenera, de modo que volver atrás no muestra datos privados. | P/T | Must | autenticado | `POST /auth/logout` | E1-2 |
| RF-06 | La aplicación **protege las rutas privadas**: sin sesión la API responde 401 y la SPA redirige al login y, tras entrar, vuelve a la ruta pedida. La SPA recupera la sesión al recargar. | P/T | Must | autenticado | `GET /me` | E1-3 |
| RF-07 | Un usuario puede **editar su perfil** (nombre, email). | P/T | Must | autenticado | `PATCH /me` | E1-4 |
| RF-08 | Un usuario puede **cambiar su contraseña** indicando la actual. | P/T | Must | autenticado | `PUT /me/password` | E1-4 |
| RF-09 | Un usuario puede **eliminar su cuenta** confirmando con su contraseña; se borra su espacio personal y los talleres de los que es único `owner`. | P/T | Should | autenticado | `DELETE /me` | E1-7 |
| RF-10 | Un usuario puede **recuperar su contraseña** por email con enlace de un solo uso y caducidad. **Pendiente: no tiene endpoint en el contrato v1.** | P/T | Should | público | — (falta en contrato) | E1-6 |

### Módulo ESP · Espacios de trabajo y equipo

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-11 | Un usuario ve **los espacios a los que pertenece** con su rol en cada uno y puede cambiar de espacio activo; la interfaz se adapta al tipo (cabina del coche en `personal`, centro de control en `workshop`). | P/T | Must † | autenticado | `GET /workspaces`, `GET /workspaces/{ws}` | — |
| RF-12 | Un usuario puede **crear un espacio de taller** (pasa a ser su `owner`). | T | Must † | autenticado | `POST /workspaces` | — |
| RF-13 | Un gestor puede **editar los ajustes del taller**: nombre, número de elevadores (1–12) e IVA por defecto (0–100). | T | Must † | manage | `PATCH /workspaces/{ws}` | — |
| RF-14 | El propietario puede **eliminar un espacio de taller**; un espacio personal no se puede eliminar por esta vía (409). | T | Could † | own | `DELETE /workspaces/{ws}` | — |
| RF-15 | Un gestor puede **gestionar los miembros**: listarlos, añadir por email a un usuario ya registrado con rol `manager` o `mechanic` (422 si no existe la cuenta), cambiar su rol y quitarlo. Nunca se puede degradar ni quitar al último `owner` (409). Un miembro puede salir del espacio por sí mismo. En un espacio personal no se pueden añadir miembros (409). | T | Must † | view (listar) · manage (resto) | `GET/POST /workspaces/{ws}/members`, `PATCH/DELETE /workspaces/{ws}/members/{user}` | — |
| RF-16 | Cada operación se **autoriza según el rol** del usuario en el espacio del recurso (tabla de §1.1). El mecánico no ve facturación (`revenue: null`) y recibe 403 en analítica y gastos. | P/T | Must | — | Todos | E1-5 |

### Módulo VEH · Garaje y vehículos

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-17 | Un miembro puede **dar de alta un vehículo** con marca y modelo obligatorios y, opcionalmente, apodo, versión, año, combustible, cambio, motor, carrocería, color, matrícula, VIN, fecha y km de compra y km actuales. Si indica km actuales se crea la primera lectura (`vehicle_created`). En talleres puede asociarse a un cliente del mismo espacio (en personal, 422). Matrícula normalizada y única por espacio entre no archivados; VIN de 17 caracteres válido y único por espacio. | P/T | Must | operate | `POST /workspaces/{ws}/vehicles` | E2-1 |
| RF-18 | Un miembro puede **listar los vehículos** del espacio con búsqueda (marca, modelo, apodo, matrícula, VIN, cliente), filtro de archivados, filtro por cliente y orden (recientes, nombre, km). Cada vehículo incluye contadores (intervenciones, recordatorios pendientes/vencidos/próximos, orden abierta). | P/T | Must | view | `GET /workspaces/{ws}/vehicles` | E2-2 |
| RF-19 | Un miembro puede **ver la ficha** de un vehículo; los datos no informados aparecen como «Sin indicar», nunca inventados. | P/T | Must | view | `GET /vehicles/{v}` | E2-3 |
| RF-20 | Un miembro puede **editar un vehículo**; el kilometraje actual no se edita aquí (solo mediante lecturas, RF-23). | P/T | Must | operate | `PATCH /vehicles/{v}` | E2-4 |
| RF-21 | Un gestor puede **archivar y restaurar** un vehículo: el archivado sale del selector y del dashboard pero conserva su historial. | P/T | Must | manage | `POST /vehicles/{v}/archive`, `POST /vehicles/{v}/restore` | E2-5 |
| RF-22 | Un gestor puede **eliminar definitivamente** un vehículo **archivado** (409 si no lo está), con borrado en cascada de su historial y ficheros. | P/T | Could | manage | `DELETE /vehicles/{v}` | E2-7 |

### Módulo KM · Kilometraje (seguimiento diario)

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-23 | Un miembro puede **registrar una lectura de kilometraje** (fecha no futura, km entero ≥ 0, nota opcional). Si el valor es menor que una lectura de fecha anterior o igual, o mayor que una de fecha posterior, la API responde 422 con el último valor coherente y solo la acepta si se reenvía con `confirm_mileage_drop: true` (**control de retrocesos**). | P/T | Must | operate | `POST /vehicles/{v}/mileage` | E2-6, E3-7 |
| RF-24 | Un miembro puede **consultar el historial de lecturas** (descendente por fecha y km) con su origen (`manual`, `vehicle_created`, `maintenance`, `expense`, `work_order`, `reminder`). | P/T | Must | view | `GET /vehicles/{v}/mileage` | — |
| RF-25 | Un miembro puede **eliminar una lectura manual**; las lecturas generadas por otros registros no se eliminan por esta vía. Tras borrar se recalcula el kilometraje actual. | P/T | Should † | operate | `DELETE /mileage/{log}` | — |
| RF-26 | El sistema mantiene el **kilometraje actual derivado**: `current_mileage` es la lectura más reciente por fecha (desempate: mayor km) y `mileage_updated_at` su fecha. Cualquier dato con km (intervención, gasto, orden, recordatorio completado) crea su lectura con `source` y `source_id`. | P/T | Must | — | Implícito en todos los POST/PATCH con km | E3-7 |

### Módulo INT · Intervenciones (mantenimiento, reparaciones, averías)

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-27 | Un miembro puede **registrar una intervención** con tipo (mantenimiento, reparación, avería, inspección, neumáticos, carrocería, otro), zona del vehículo, tipo de servicio opcional (aceite, revisión, ITV…), título (2–120), fecha no futura, km, taller, descripción e importes (piezas, mano de obra, total; ≥ 0, ≤ 999.999,99, 2 decimales). El km sigue la regla de RF-23. | P/T | Must | operate | `POST /vehicles/{v}/maintenance` | E3-1 |
| RF-28 | Una intervención admite un **desglose en líneas** (pieza, mano de obra, fluido, otro) con nombre, referencia, cantidad > 0 y precio unitario; máximo 50 líneas; el total de cada línea lo calcula el servidor. Al editar, si llegan líneas, **reemplazan** a las anteriores. | P/T | Must | operate | `POST /vehicles/{v}/maintenance`, `PATCH /maintenance/{r}` | E3-2 |
| RF-29 | En espacios **personales**, una intervención con `total_cost > 0` **genera o actualiza un gasto vinculado** en la misma transacción (categoría `repair` si el tipo es reparación/avería/carrocería, `inspection` si es inspección y `maintenance` en el resto; misma fecha, km e importe; descripción = título). Si el total pasa a 0 o nulo, el gasto se elimina. En talleres no se generan gastos. **Todos los totales de gasto salen solo de la tabla de gastos.** | P | Must | operate | `POST /vehicles/{v}/maintenance`, `PATCH /maintenance/{r}` | E3-6 ([ADR‑0003](../arquitectura/ADR-0003-gasto-vinculado.md)) |
| RF-30 | Un miembro puede **consultar el historial** del vehículo como línea temporal (fecha desc., desempate km desc.) con filtros por tipo, zona, año, búsqueda (título, taller, descripción) y archivados. | P/T | Must | view | `GET /vehicles/{v}/maintenance` | E3-3 |
| RF-31 | Un miembro puede **ver el detalle** de una intervención con sus líneas, su gasto vinculado (si existe), la orden de trabajo de origen (si existe) y el número de documentos. | P/T | Must | view | `GET /maintenance/{r}` | E3-4 |
| RF-32 | Un miembro puede **editar, archivar y restaurar** una intervención. Al archivar, su gasto vinculado deja de contar (se elimina); al restaurar, se recrea. | P/T | Must | operate | `PATCH /maintenance/{r}`, `POST /maintenance/{r}/archive`, `POST /maintenance/{r}/restore` | E3-5 |

### Módulo GAS · Gastos y analítica

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-33 | El propietario (o un gestor en talleres) puede **registrar un gasto** con categoría (combustible, mantenimiento, reparación, seguro, impuestos, inspección, aparcamiento, peajes, limpieza, multas, otros), importe > 0, fecha no futura, descripción y km opcionales. Los datos de repostaje (cantidad, unidad `l`/`kwh`/`kg`, depósito lleno) solo se aceptan en combustible; la unidad por defecto es `kwh` en eléctricos y `l` en el resto. | P (T: manage) | Must | manage | `POST /vehicles/{v}/expenses` | E4-1 |
| RF-34 | Se pueden **listar y filtrar gastos** por periodo y una o varias categorías. Los gastos vinculados se identifican como «desde intervención» con enlace a ella. | P (T: manage) | Must | manage | `GET /vehicles/{v}/expenses` | E4-2, E3-6 |
| RF-35 | Se pueden **editar y eliminar gastos manuales**; los vinculados responden 409 («Este gasto se gestiona desde su intervención.»). | P (T: manage) | Must | manage | `PATCH /expenses/{e}`, `DELETE /expenses/{e}` | E4-5 |
| RF-36 | Un miembro puede consultar el **resumen del vehículo** para un periodo: total del periodo, mes y año; comparación con el periodo anterior (solo si tuvo gastos); totales por categoría; serie de 12 meses (incluidos los meses a 0); últimas intervenciones; recordatorios próximos. **Filtros y cifras/gráficos cambian a la vez.** | P/T | Must | view | `GET /vehicles/{v}/summary?from&to` | E4-3, E4-6, E5-2, E5-4 |
| RF-37 | El **coste por kilómetro** solo se muestra si en el periodo hay ≥ 2 lecturas separadas ≥ 500 km **y** ≥ 30 días; si no, se muestra el motivo exacto («Necesitas al menos dos lecturas…»). | P | Must | view | `GET /vehicles/{v}/summary` (`cost_per_km`) | E4-4 |
| RF-38 | El sistema calcula el **consumo medio por el método lleno‑a‑lleno** cuando hay ≥ 2 repostajes con depósito lleno y km; si no, indica qué falta. | P | Should † | view | `GET /vehicles/{v}/summary` (`consumption`) | — (idea I5) |
| RF-39 | La ficha muestra **«desde el último…»** cambio de aceite, revisión e ITV registrados, con días y km transcurridos, o «Sin registros» con acción para añadirlo. | P/T | Must | view | `GET /vehicles/{v}/summary` (`since_last`) | E5-5 |
| RF-40 | Un gestor puede consultar la **analítica del espacio** para un periodo (por defecto 12 meses): en personal, gasto total por mes, vehículo y categoría; en taller, facturación de órdenes entregadas, ticket medio, días medios en taller y facturación por cliente. | P/T | Should † | manage | `GET /workspaces/{ws}/analytics?from&to` | — |

### Módulo REC · Recordatorios y vencimientos

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-41 | Un miembro puede **crear, editar y eliminar recordatorios** por fecha y/o km (al menos uno; 422 si ninguno), con tipo (ITV, seguro, impuesto, aceite, revisión, neumáticos, frenos, distribución, batería, personalizado), zona (por defecto según el tipo), notas y **recurrencia** opcional en meses y/o km. | P/T | Should † | operate | `POST /vehicles/{v}/reminders`, `PATCH/DELETE /reminders/{r}` | — (plan v1: fase 2) |
| RF-42 | El sistema calcula, al serializar, el **estado** de cada recordatorio pendiente: `overdue` (fecha pasada o km superados), `soon` (≤ 30 días o ≤ 1.000 km), `unknown` (solo km y el vehículo no tiene kilometraje) u `ok`; además días y km restantes y un **progreso** según los intervalos del usuario (no desgaste medido). Los listados se ordenan por urgencia. | P/T | Should † | view | `GET /vehicles/{v}/reminders?status=` | — |
| RF-43 | Un miembro puede **completar** un recordatorio indicando fecha y km opcionales (el km crea una lectura `reminder`). Si es **recurrente** y no se indica lo contrario, se crea el siguiente a partir de la fecha y km de completado. | P/T | Should † | operate | `POST /reminders/{r}/complete` | — |
| RF-44 | Un miembro puede **descartar** un recordatorio. | P/T | Should † | operate | `POST /reminders/{r}/dismiss` | — |
| RF-45 | Un miembro ve la **agenda del espacio**: recordatorios pendientes de todos los vehículos con el vehículo incluido, ordenados por urgencia y filtrables por estado. En talleres sirve como «alertas de flota». | P/T | Should † | view | `GET /workspaces/{ws}/reminders?state=` | — |

### Módulo 3D · Zonas y experiencia 3D

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-46 | El sistema ofrece el **mapa de zonas** de un vehículo: siempre las 10 zonas (Motor, Transmisión, Frenos, Neumáticos, Suspensión y dirección, Eléctrico y batería, Carrocería, Interior y climatización, Escape, General) con estado = peor estado de sus recordatorios pendientes (`basis = reminders`); si solo hay historial, `unknown` con `basis = records`; si no hay nada, `unknown` con `basis = none`. Incluye última intervención, nº de registros y siguiente recordatorio por zona. La interfaz lo etiqueta siempre **«según tus intervalos, no medido»**. | P/T | Must † | view | `GET /vehicles/{v}/zones` | — ([ADR‑0004](../arquitectura/ADR-0004-vehiculo-3d-procedural.md)) |
| RF-47 | La ficha muestra el **vehículo en 3D**, generado por código según su carrocería (9 tipos) y teñido con su color, sin marcas ni logotipos. En modo *inspección* permite orbitar y **seleccionar zonas**, que muestran la información de RF-46. | P/T | Must † | view | `GET /vehicles/{v}`, `GET /vehicles/{v}/zones` | — |
| RF-48 | El usuario puede activar una **vista «rayos X» ilustrativa** (carrocería translúcida y componentes simplificados), rotulada como ilustración. | P/T | Should † | view | — (solo cliente) | — |
| RF-49 | Si el navegador no dispone de WebGL, o el usuario prefiere movimiento reducido, se muestra una **alternativa 2D** (silueta SVG) y toda la información de zonas está disponible en **HTML accesible** (lista navegable por teclado). | P/T | Must † | view | `GET /vehicles/{v}/zones` | — |
| RF-50 | El formulario de vehículo muestra una **vista previa** que cambia de carrocería y color en vivo. | P/T | Could † | operate | — (solo cliente) | — |
| RF-51 | El taller dispone de una **escena 3D del taller**: nave con los elevadores numerados (según `bays_count`), los coches de las órdenes abiertas en su elevador y una zona de espera; al seleccionar un elevador u orden se abre su detalle. Tiene equivalente en HTML (lista de elevadores). | T | Should † | view | `GET /workspaces/{ws}/bays`, `GET /workspaces/{ws}/work-orders?status=open` | — |
| RF-52 | La página pública de bienvenida incluye una **escena 3D de portada** coreografiada con el desplazamiento, con alternativa estática. | — | Could † | público | — (solo cliente) | — |

### Módulo DOC · Documentos

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-53 | Un miembro puede **subir un documento** (PDF, JPEG, PNG o WebP; ≤ 10 MB; tipo MIME real comprobado) con título, tipo (factura, seguro, ITV, permiso de circulación, manual, foto, otro), intervención del mismo vehículo opcional y fecha de caducidad opcional. | P/T | Should † | operate | `POST /vehicles/{v}/documents` (multipart) | — (plan v1: fase 2) |
| RF-54 | Un miembro puede **listar** los documentos de un vehículo filtrando por tipo o por intervención. | P/T | Should † | view | `GET /vehicles/{v}/documents` | — |
| RF-55 | Un miembro puede **descargar o previsualizar** un documento solo a través de una ruta autenticada (nunca pública), como adjunto o en línea para PDF e imágenes. | P/T | Should † | view | `GET /documents/{d}/download[?inline=1]` | — |
| RF-56 | Un miembro puede **eliminar** un documento; se borra también el fichero. | P/T | Should † | operate | `DELETE /documents/{d}` | — |

### Módulo SEG · Seguimiento: dashboard, diario, informe y actividad

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-57 | El **dashboard personal** muestra los vehículos (el seleccionado como protagonista), gasto del mes, del año y de los últimos 12 meses, recordatorios vencidos/próximos, actividad reciente, accesos rápidos (añadir intervención, gasto, km) con el vehículo preseleccionado y estados vacíos con guía. Todas las cifras proceden de datos persistidos. | P | Must | view | `GET /workspaces/{ws}/dashboard`, `GET /vehicles/{v}/summary` | E5-1…E5-7 |
| RF-58 | El **diario del vehículo** agrupa por día (desc.) lecturas, gastos, intervenciones, recordatorios completados y documentos, con km recorridos (solo si hay lecturas suficientes) y gasto del día; omite días sin eventos. | P/T | Should † | view | `GET /vehicles/{v}/journal?from&to` | — |
| RF-59 | Un miembro puede generar el **informe del vehículo** (ficha, historial, gastos por categoría y año, lecturas, recordatorios pendientes y documentos) con su **fecha de generación**. *El formato final de exportación (impresión/PDF) está pendiente de definir por el frontend.* | P/T | Should † | view | `GET /vehicles/{v}/report` | — (idea I2) |
| RF-60 | Cada acción de escritura relevante queda en un **registro de actividad** (sin secretos ni datos sensibles), consultable por espacio y por vehículo, con una frase en español lista para mostrar. | P/T | Should † | view | `GET /workspaces/{ws}/activity?vehicle_id=` | — |

### Módulo TAL · Taller: clientes, órdenes de trabajo y elevadores

| ID | Requisito | Modo | Prior. | Permiso | Endpoints | Historia |
|----|-----------|------|--------|---------|-----------|----------|
| RF-61 | Un miembro del taller puede **gestionar clientes** (nombre, email, teléfono, NIF, notas): alta, búsqueda (nombre, email, teléfono, NIF), consulta y edición; ver sus vehículos. Un gestor puede eliminar un cliente sin órdenes abiertas (409 si las tiene); sus vehículos quedan sin cliente. En espacios personales estas rutas responden 404. | T | Must † | view · operate · manage (borrar) | `GET/POST /workspaces/{ws}/customers`, `GET/PATCH/DELETE /customers/{c}`, `GET /customers/{c}/vehicles` | — |
| RF-62 | Un miembro puede **crear una orden de trabajo** para un vehículo del taller con título, síntoma, diagnóstico, prioridad, elevador, mecánico asignado (miembro del espacio), km de entrada, fecha prometida, IVA y líneas. Se numera `OT-{año}-{nnnn}` correlativo por espacio y año **sin huecos**, nace en estado `received` y copia el cliente del vehículo. El km de entrada crea una lectura `work_order` (en talleres un retroceso se acepta sin confirmación, pero se registra). | T | Must † | operate | `POST /workspaces/{ws}/work-orders` | — |
| RF-63 | Un miembro ve las órdenes en un **tablero kanban** por estado, con filtros (estado o `open`, vehículo, cliente, asignado, búsqueda por número, título, matrícula o cliente) y marca de **retraso** (fecha prometida pasada sin estar lista, entregada ni cancelada). | T | Must † | view | `GET /workspaces/{ws}/work-orders` (hasta 200 por página) | — |
| RF-64 | Un miembro puede **cambiar el estado** de una orden entre `received`, `diagnosing`, `waiting_parts`, `in_progress` y `ready` libremente; `delivered` y `cancelled` son finales (409 a partir de ahí). Al pasar a `ready` se fija la fecha de finalización; pasar a `ready`, `delivered` o `cancelled` libera el elevador salvo que se indique otro. | T | Must † | operate | `POST /work-orders/{o}/status` | — |
| RF-65 | Al **entregar** una orden se crea, en la misma transacción, una **intervención en el historial del vehículo** (tipo reparación, zona general, título, diagnóstico como descripción, fecha de entrega, km de entrada, nombre del taller, total y líneas copiadas) enlazada con la orden. | T | Must † | operate | `POST /work-orders/{o}/status` (`delivered`) | — |
| RF-66 | Un **elevador** solo puede tener **una orden abierta**: asignar uno ocupado responde 409 («El elevador 2 está ocupado por OT-2026-0004»). Se puede consultar la ocupación de todos los elevadores. | T | Must † | view · operate | `GET /workspaces/{ws}/bays`, `PATCH /work-orders/{o}`, `POST /work-orders/{o}/status` | — |
| RF-67 | El sistema **calcula los importes** de la orden: subtotal = Σ líneas; IVA = subtotal × tipo / 100 redondeado *half‑up* a 2 decimales; total = subtotal + IVA. El tipo por defecto es el del espacio. | T | Must † | — | `POST/PATCH work-orders` | — |
| RF-68 | Un miembro puede **editar** una orden no final; un gestor puede **eliminarla** solo si está en `received` o `cancelled`. | T | Must † | operate · manage | `GET/PATCH/DELETE /work-orders/{o}` | — |
| RF-69 | El **dashboard del taller** muestra contadores (vehículos, clientes, órdenes abiertas y retrasadas, recordatorios vencidos), órdenes por estado, ocupación de elevadores, órdenes prometidas para hoy, retrasadas, facturación del mes/año/12 meses (**oculta al mecánico**), alertas de flota y actividad reciente. | T | Must † | view | `GET /workspaces/{ws}/dashboard` | — |

### Resumen de cobertura

| Módulo | RF | Must | Should | Could | Sin endpoint en contrato |
|--------|----|------|--------|-------|--------------------------|
| SIS | RF-01…02 | 2 | 0 | 0 | 0 |
| AUT | RF-03…10 | 6 | 2 | 0 | 1 (RF-10) |
| ESP | RF-11…16 | 5 | 0 | 1 | 0 |
| VEH | RF-17…22 | 5 | 0 | 1 | 0 |
| KM | RF-23…26 | 3 | 1 | 0 | 0 |
| INT | RF-27…32 | 6 | 0 | 0 | 0 |
| GAS | RF-33…40 | 6 | 2 | 0 | 0 |
| REC | RF-41…45 | 0 | 5 | 0 | 0 |
| 3D | RF-46…52 | 3 | 2 | 2 | 3 solo cliente (RF-48, 50, 52) |
| DOC | RF-53…56 | 0 | 4 | 0 | 0 |
| SEG | RF-57…60 | 1 | 3 | 0 | 0 |
| TAL | RF-61…69 | 9 | 0 | 0 | 0 |
| **Total** | **69** | **46** | **19** | **4** | |

## 1.3 Requisitos no funcionales

| ID | Categoría | Requisito | Cómo se verifica | Fuente |
|----|-----------|-----------|------------------|--------|
| RNF-01 | Seguridad · autenticación | Sesión con **Laravel Sanctum en modo SPA** (cookie de sesión HttpOnly + token `X-XSRF-TOKEN`); nada de tokens en `localStorage`. Contraseñas con el *hashing* del framework. Regeneración de sesión al iniciar y cerrar sesión. Límite de 5 intentos de login por minuto (email + IP). | Pruebas feature de login, logout, 401 y 429 | Contrato §1, §3.1; ADR‑0001 |
| RNF-02 | Seguridad · **aislamiento** | Todo recurso se resuelve `recurso → vehículo → espacio → miembros`. Un recurso de un espacio ajeno responde **404** (no se revela su existencia), nunca 403. Las tablas hijas no duplican `user_id`. **Hay un test de aislamiento por endpoint.** | Suite de aislamiento (una prueba por endpoint) | Contrato §1, §2; ADR‑0002; E1-5 |
| RNF-03 | Seguridad · autorización | Control de acceso basado en roles (owner/manager/mechanic) aplicado **en el servidor** mediante Policies/Gates; el frontend solo oculta controles por comodidad, nunca por seguridad. Rol insuficiente dentro de un espacio propio ⇒ 403. | Pruebas feature por rol | Contrato §2 |
| RNF-04 | Seguridad · entradas y salidas | Validación en cliente (React Hook Form + Zod) **y** en servidor (Form Requests). Errores uniformes `{ message, errors }` en español, **sin trazas ni SQL**. Protección CSRF, consultas parametrizadas (Eloquent) y escape de salida (React). | Pruebas 422 y de formato de error; revisión de seguridad (oleada 3) | Contrato §1; doc. original 04 §6 |
| RNF-05 | Seguridad · ficheros | Documentos en **disco privado** (`storage/app/private/documents/{workspace}/{uuid}.{ext}`), nunca en `public/`; máx. 10 MB; MIME real permitido (PDF, JPEG, PNG, WebP); nombre interno UUID; nombre original saneado; descarga solo por controlador autorizado con `X-Content-Type-Options: nosniff`. | Pruebas feature de subida/descarga/aislamiento | Contrato §3.9 |
| RNF-06 | Integridad de datos | Dinero en `DECIMAL` y como **string** con 2 decimales en JSON; kilometraje entero ≥ 0 con control de retrocesos; operaciones compuestas en **transacciones** (intervención + gasto vinculado; entrega de orden + intervención); numeración de órdenes sin huecos con bloqueo; claves foráneas con borrado coherente. | Pruebas unitarias de cálculo y feature de transacción | Contrato §1, §3.4, §3.5, §3.11; ADR‑0003 |
| RNF-07 | Veracidad de la información | **Ninguna cifra ni función sin fuente real.** Si falta un dato se dice qué falta y se ofrece la acción que lo resuelve. Sin «health score», desgaste medido, diagnósticos ni integraciones inexistentes. El estado de zonas se rotula siempre «según tus intervalos, no medido» y la vista de rayos X como ilustración. | Pruebas de componente sobre textos y estados «faltan datos»; revisión UX | CLAUDE.md regla 2; doc. original 01 §6 |
| RNF-08 | Rendimiento · 3D | three.js y React Three Fiber en un **chunk diferido** (la aplicación arranca sin descargarlo); **un único `<Canvas>`** por pantalla; `frameloop="demand"` con la escena quieta; *device pixel ratio* limitado; **miniaturas estáticas** en listados (nunca un WebGL por tarjeta); sin descargas externas en tiempo de ejecución (geometría procedural, iluminación con `Lightformer`). Objetivo de fluidez y de tamaño de chunk: **pendiente de fijar** con `experto-3d` y medir en la oleada 3. | Análisis del *build* (chunks), inspección de número de contextos WebGL, medición de FPS | ADR‑0004; CLAUDE.md regla 7; `frontend/vite.config.ts` (`manualChunks`) |
| RNF-09 | Rendimiento · API y datos | Listados paginados (25 por defecto, máx. 100; 200 en el tablero kanban); listados pequeños sin paginar; índices en las columnas de filtrado y orden (p. ej. `(vehicle_id, service_date)`); estados de carga con *skeleton*. | Pruebas feature de paginación; revisión de migraciones | Contrato §1 |
| RNF-10 | Accesibilidad | Conformidad objetivo **WCAG 2.2 nivel AA**: navegación completa por teclado; foco visible y no oculto (2.4.7, 2.4.11); contraste de texto ≥ 4,5:1 y de componentes ≥ 3:1 (1.4.3, 1.4.11); tamaño mínimo de objetivo (2.5.8); autenticación accesible sin pruebas cognitivas, permitiendo pegar contraseñas (3.3.8); estado nunca comunicado solo por color; respeto de `prefers-reduced-motion`; el `<canvas>` 3D tiene nombre accesible y **toda su información existe también en HTML**. | Auditoría axe (0 incidencias críticas/serias), recorrido por teclado, revisión manual | CLAUDE.md regla 6; ADR‑0004; E6-3 |
| RNF-11 | Responsive | Diseño adaptable verificado a **360, 768 y 1280 px** sin desplazamiento horizontal. Para cumplir el criterio WCAG 1.4.10 (*Reflow*) se recomienda verificar también 320 px. Objetivos táctiles de al menos 44 px en móvil. | E2E en varios *viewports*; revisión UX | CLAUDE.md regla 6; plan v1 §4.4 |
| RNF-12 | Privacidad · RGPD | Minimización de datos personales (los clientes de taller solo guardan nombre, contacto, NIF y notas); el usuario puede **exportar** el historial de su vehículo (RF-59) y **eliminar su cuenta** (RF-09); la actividad no guarda datos sensibles en `metadata`; secretos solo en variables de entorno. ⚠️ **Pendiente antes de abrir a terceros:** política de privacidad, base jurídica y plazos de retención, encargo de tratamiento para datos de clientes de talleres. | Revisión del agente `seguridad`; revisión legal (pendiente) | Doc. original 04 §6; riesgo R11 |
| RNF-13 | Mantenibilidad | Desarrollo *contract‑first* (tipos TypeScript y contrato como fuente de verdad); capas separadas (rutas → Form Request → Policy → Controller → Service → Eloquent → Resource); módulo 3D aislado tras una interfaz pública (`frontend/src/three/types.ts`); decisiones registradas como ADR; linters (Laravel Pint, oxlint) y comprobación de tipos (`tsc`); sin dependencias injustificadas. | `npm run lint`, `npm run typecheck`, Pint; revisión de código | ADR‑0001; CLAUDE.md reglas 1 y 8 |
| RNF-14 | Pruebas | Pruebas automatizadas de las reglas de negocio críticas (km, gasto vinculado, coste/km, recordatorios recurrentes, totales de órdenes, elevadores), una prueba de aislamiento por endpoint, pruebas de componentes, E2E de los recorridos principales y auditoría de accesibilidad. **Nunca se declaran resultados sin ejecutarlos.** | Plan de pruebas ([07](07-plan-de-pruebas.md)) | CLAUDE.md regla 9; doc. original 04 §8 |
| RNF-15 | Localización | Interfaz y mensajes de la API en **español**; números, importes y fechas formateados en el cliente con `Intl` (`es-ES`), porque el PHP del entorno no tiene la extensión `intl`; campo `locale` en el usuario para una internacionalización futura. | Pruebas de componente de formato | CLAUDE.md; contrato §1 |
| RNF-16 | Compatibilidad y entorno | Backend en PHP 8.2 + Laravel 12 + MySQL/MariaDB 10.4 (XAMPP); pruebas con SQLite en memoria; frontend en navegadores con soporte de módulos ES; con WebGL para el 3D y degradación a 2D sin él. | Arranque documentado; E2E | ADR‑0001; CLAUDE.md |
| RNF-17 | Propiedad intelectual | Sin modelos 3D, logotipos ni formas de marcas registradas; vehículo procedural propio; tipografías con licencia libre autoalojadas. | Revisión del código 3D y de dependencias | ADR‑0004 |
| RNF-18 | Usabilidad | Ningún control decorativo: cada botón hace lo que promete o no se muestra; confirmación en acciones destructivas; errores junto al campo; estados de carga, vacío y error en cada pantalla. | Pruebas de componente y revisión UX | CLAUDE.md regla 5; doc. original 03 |

## 1.4 Huecos y preguntas abiertas detectadas al especificar

Estas cuestiones aparecen al trazar los requisitos contra el contrato v1. No se resuelven aquí: se trasladan al `arquitecto` (dueño del contrato) a través del informe de esta oleada.

1. **RF-10 (recuperar contraseña)** figura en el backlog (E1-6, Should) pero no tiene endpoint en el contrato v1.
2. **RF-43 (completar recordatorio con km)**: `CompleteReminderInput` no incluye `confirm_mileage_drop`, mientras que la regla de §3.4 exige confirmación ante un retroceso. No está definido cómo confirmar un km incoherente al completar.
3. **RF-43 (recurrencia solo por km sin km de completado)**: si un recordatorio solo tiene `recurrence_km` y se completa sin km, el siguiente quedaría sin `due_date` ni `due_mileage`, lo que contradice la validación «al menos uno».
4. **RF-65 (entrega de orden)**: la intervención generada lleva `mileage = mileage_in`; por la regla «cada dato con km crea un `mileage_log`» se crearía una segunda lectura con el mismo km. Falta precisar si se reutiliza la lectura de la orden.
5. **Enlace orden ↔ intervención**: existen `work_orders.maintenance_record_id` y `maintenance_records.work_order_id` (doble referencia). Falta decidir si se guardan ambas columnas o una se deriva.
6. **Prioridades †**: las funciones de taller, 3D, recordatorios y documentos no tienen historias en el backlog; las prioridades marcadas con † son propuestas.
